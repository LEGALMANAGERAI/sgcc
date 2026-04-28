import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { notify } from "@/lib/notifications";
import { randomUUID } from "crypto";
import type { TicketCategoria, TicketPrioridad } from "@/types";

const CATEGORIAS_VALIDAS: TicketCategoria[] = ["soporte", "administrativo", "operativo"];
const PRIORIDADES_VALIDAS: TicketPrioridad[] = ["Normal", "Media", "Alta"];

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const estado = searchParams.get("estado");
  const categoria = searchParams.get("categoria");
  const caseId = searchParams.get("case_id");
  const origen = searchParams.get("origen"); // 'parte' | 'staff' | 'todos' (default todos)

  let query = supabaseAdmin
    .from("sgcc_tickets")
    .select(`
      *,
      solicitante:sgcc_staff!sgcc_tickets_solicitante_staff_id_fkey(id, nombre, email),
      solicitante_party:sgcc_parties!sgcc_tickets_solicitante_party_id_fkey(id, nombres, apellidos, razon_social, email),
      asignado:sgcc_staff!sgcc_tickets_asignado_staff_id_fkey(id, nombre, email),
      respondedor:sgcc_staff!sgcc_tickets_respondido_por_fkey(id, nombre, email),
      caso:sgcc_cases(id, numero_radicado)
    `)
    .eq("center_id", centerId)
    .order("created_at", { ascending: false });

  if (estado) query = query.eq("estado", estado);
  if (categoria) query = query.eq("categoria", categoria);
  if (caseId) query = query.eq("case_id", caseId);
  if (origen === "parte") query = query.not("solicitante_party_id", "is", null);
  else if (origen === "staff") query = query.not("solicitante_staff_id", "is", null);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const solicitanteId = (session.user as any)?.id as string | undefined;
  const body = await req.json();

  const titulo = String(body.titulo ?? "").trim();
  const descripcion = body.descripcion ? String(body.descripcion).trim() : null;
  const categoria = CATEGORIAS_VALIDAS.includes(body.categoria) ? body.categoria : "soporte";
  const prioridad = PRIORIDADES_VALIDAS.includes(body.prioridad) ? body.prioridad : "Normal";
  const asignadoId = body.asignado_staff_id || null;
  const caseId = body.case_id || null;

  if (!titulo) {
    return NextResponse.json({ error: "El título es requerido" }, { status: 400 });
  }

  const ticketId = randomUUID();
  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("sgcc_tickets")
    .insert({
      id: ticketId,
      center_id: centerId,
      case_id: caseId,
      titulo,
      descripcion,
      categoria,
      prioridad,
      estado: "Pendiente",
      solicitante_staff_id: solicitanteId ?? null,
      asignado_staff_id: asignadoId,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notificar a admins del centro y al staff asignado (si existe)
  try {
    const { data: admins } = await supabaseAdmin
      .from("sgcc_staff")
      .select("id, email")
      .eq("center_id", centerId)
      .eq("activo", true)
      .eq("rol", "admin");

    const recipients: Array<{ staffId?: string; email?: string }> = (admins ?? []).map((a) => ({
      staffId: a.id,
      email: a.email ?? undefined,
    }));

    if (asignadoId && !recipients.some((r) => r.staffId === asignadoId)) {
      const { data: asignado } = await supabaseAdmin
        .from("sgcc_staff")
        .select("id, email")
        .eq("id", asignadoId)
        .single();
      if (asignado) recipients.push({ staffId: asignado.id, email: asignado.email ?? undefined });
    }

    if (recipients.length > 0) {
      const solicitanteNombre =
        (session.user as any)?.name ?? (session.user as any)?.email ?? "Un usuario";
      await notify({
        centerId,
        caseId: caseId ?? undefined,
        tipo: "ticket_nuevo",
        titulo: `🎫 Nuevo ticket — ${titulo}`,
        mensaje: `${solicitanteNombre} ha creado un ticket de categoría "${categoria}" con prioridad ${prioridad}.${
          descripcion ? `\n\n${descripcion}` : ""
        }`,
        recipients,
        canal: "both",
      });
    }
  } catch (e) {
    console.error("[TICKETS] Error notificando ticket nuevo:", e);
  }

  return NextResponse.json(data, { status: 201 });
}
