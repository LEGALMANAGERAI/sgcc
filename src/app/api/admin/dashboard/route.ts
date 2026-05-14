import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { isSuperAdminSession } from "@/lib/superadmin";

export const dynamic = "force-dynamic";

interface CentroAgregado {
  id: string;
  nombre: string;
  ciudad: string | null;
  departamento: string | null;
  tipo: string | null;
  activo: boolean;
  created_at: string;
  staff_activo: number;
  casos_total: number;
  casos_activos: number;
  audiencias_programadas: number;
  documentos: number;
  storage_mb: number;
  tickets_abiertos: number;
  ultima_actividad: string | null;
}

/**
 * GET /api/admin/dashboard
 *
 * Solo SuperAdmin (env SUPERADMIN_EMAILS). Devuelve KPIs globales del SaaS
 * y métricas por centro suscrito. Lectura cruda con supabaseAdmin: no hay
 * RLS porque el SuperAdmin necesita atravesar todos los tenants.
 *
 * Las agregaciones se hacen en memoria — el volumen actual (decenas de
 * centros, miles de filas hijas) lo soporta sin problema. Si crece se
 * migra a queries SQL agregadas o materialized view.
 */
export async function GET() {
  const session = await auth();
  if (!isSuperAdminSession(session)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const [
    centrosResp,
    staffResp,
    casosResp,
    hearingsResp,
    documentosResp,
    ticketsResp,
  ] = await Promise.all([
    supabaseAdmin
      .from("sgcc_centers")
      .select("id, nombre, ciudad, departamento, tipo, activo, created_at")
      .order("created_at", { ascending: false }),
    supabaseAdmin.from("sgcc_staff").select("center_id, activo"),
    supabaseAdmin.from("sgcc_cases").select("center_id, estado, updated_at"),
    supabaseAdmin.from("sgcc_hearings").select("center_id, estado, fecha_hora"),
    supabaseAdmin.from("sgcc_documents").select("center_id, tamano_bytes"),
    supabaseAdmin.from("sgcc_tickets").select("center_id, estado"),
  ]);

  const centros = (centrosResp.data ?? []) as Array<{
    id: string;
    nombre: string;
    ciudad: string | null;
    departamento: string | null;
    tipo: string | null;
    activo: boolean;
    created_at: string;
  }>;

  const staffRows = (staffResp.data ?? []) as Array<{ center_id: string; activo: boolean }>;
  const casosRows = (casosResp.data ?? []) as Array<{
    center_id: string;
    estado: string | null;
    updated_at: string | null;
  }>;
  const hearingRows = (hearingsResp.data ?? []) as Array<{
    center_id: string;
    estado: string | null;
    fecha_hora: string | null;
  }>;
  const docRows = (documentosResp.data ?? []) as Array<{
    center_id: string;
    tamano_bytes: number | null;
  }>;
  const ticketRows = (ticketsResp.data ?? []) as Array<{
    center_id: string;
    estado: string | null;
  }>;

  // Estados que cuentan como "abiertos / activos". Son listas conservadoras
  // — si un estado nuevo aparece en BD, no lo cuento como cerrado por defecto.
  const ESTADOS_CASO_CERRADO = new Set(["archivado", "cerrado", "anulado"]);
  const ESTADOS_TICKET_CERRADO = new Set(["resuelto", "cerrado"]);
  const ESTADOS_AUDIENCIA_PROG = new Set(["programada", "reprogramada"]);

  const ahora = new Date();
  const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const finHoy = new Date(inicioHoy);
  finHoy.setDate(finHoy.getDate() + 1);

  function indexar<T extends { center_id: string }>(rows: T[]): Map<string, T[]> {
    const m = new Map<string, T[]>();
    for (const r of rows) {
      const arr = m.get(r.center_id) ?? [];
      arr.push(r);
      m.set(r.center_id, arr);
    }
    return m;
  }

  const staffByCenter = indexar(staffRows);
  const casosByCenter = indexar(casosRows);
  const hearingsByCenter = indexar(hearingRows);
  const docsByCenter = indexar(docRows);
  const ticketsByCenter = indexar(ticketRows);

  const centrosAgregados: CentroAgregado[] = centros.map((c) => {
    const staff = staffByCenter.get(c.id) ?? [];
    const casos = casosByCenter.get(c.id) ?? [];
    const hearings = hearingsByCenter.get(c.id) ?? [];
    const docs = docsByCenter.get(c.id) ?? [];
    const tickets = ticketsByCenter.get(c.id) ?? [];

    const storageBytes = docs.reduce((s, d) => s + (Number(d.tamano_bytes) || 0), 0);
    const ultimaActividad = casos.reduce<string | null>((acc, k) => {
      if (!k.updated_at) return acc;
      if (!acc || k.updated_at > acc) return k.updated_at;
      return acc;
    }, null);

    return {
      id: c.id,
      nombre: c.nombre,
      ciudad: c.ciudad,
      departamento: c.departamento,
      tipo: c.tipo,
      activo: c.activo,
      created_at: c.created_at,
      staff_activo: staff.filter((s) => s.activo).length,
      casos_total: casos.length,
      casos_activos: casos.filter((k) => !ESTADOS_CASO_CERRADO.has(k.estado ?? "")).length,
      audiencias_programadas: hearings.filter((h) =>
        ESTADOS_AUDIENCIA_PROG.has(h.estado ?? ""),
      ).length,
      documentos: docs.length,
      storage_mb: Math.round((storageBytes / (1024 * 1024)) * 100) / 100,
      tickets_abiertos: tickets.filter((t) => !ESTADOS_TICKET_CERRADO.has(t.estado ?? "")).length,
      ultima_actividad: ultimaActividad,
    };
  });

  const totalStorageBytes = docRows.reduce(
    (s, d) => s + (Number(d.tamano_bytes) || 0),
    0,
  );

  const audienciasHoy = hearingRows.filter((h) => {
    if (!h.fecha_hora) return false;
    const fh = new Date(h.fecha_hora);
    return fh >= inicioHoy && fh < finHoy;
  }).length;

  const kpis = {
    centros_total: centros.length,
    centros_activos: centros.filter((c) => c.activo).length,
    staff_activo: staffRows.filter((s) => s.activo).length,
    casos_total: casosRows.length,
    casos_activos: casosRows.filter(
      (k) => !ESTADOS_CASO_CERRADO.has(k.estado ?? ""),
    ).length,
    audiencias_hoy: audienciasHoy,
    documentos_total: docRows.length,
    storage_total_mb: Math.round((totalStorageBytes / (1024 * 1024)) * 100) / 100,
    tickets_abiertos: ticketRows.filter(
      (t) => !ESTADOS_TICKET_CERRADO.has(t.estado ?? ""),
    ).length,
  };

  return NextResponse.json({ kpis, centros: centrosAgregados });
}
