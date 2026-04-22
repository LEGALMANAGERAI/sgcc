import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { obtenerActuaciones, type ActuacionRama } from "@/lib/rama-judicial";
import { randomUUID } from "crypto";

export const maxDuration = 60;

/**
 * GET /api/vigilancia
 * Lista procesos vigilados del centro con conteo de actuaciones no leídas.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const estado = searchParams.get("estado");

  let query = supabaseAdmin
    .from("sgcc_watched_processes")
    .select(`
      *,
      rama_id_proceso,
      rama_ultima_actuacion_fecha,
      departamento,
      sujetos_procesales,
      fecha_proceso,
      es_privado,
      caso:sgcc_cases!sgcc_watched_processes_case_id_fkey(id, numero_radicado),
      updates:sgcc_process_updates(id, leida)
    `)
    .eq("center_id", centerId)
    .order("created_at", { ascending: false });

  if (estado) query = query.eq("estado", estado);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Agregar conteo de actuaciones no leídas
  const result = (data ?? []).map((p: any) => {
    const unreadCount = (p.updates ?? []).filter((u: any) => !u.leida).length;
    const totalUpdates = (p.updates ?? []).length;
    const { updates, ...rest } = p;
    return { ...rest, actuaciones_no_leidas: unreadCount, total_actuaciones: totalUpdates };
  });

  return NextResponse.json(result);
}

/**
 * POST /api/vigilancia
 * Agregar nuevo proceso a vigilancia.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const body = await req.json();
  const {
    numero_proceso,
    despacho,
    ciudad,
    case_id,
    partes_texto,
    // Campos opcionales cuando se importa desde Rama Judicial
    rama_id_proceso,
    departamento,
    sujetos_procesales,
    fecha_proceso,
    es_privado,
    rama_ultima_actuacion_fecha,
    // Actuaciones pre-fetched por el buscador (evita doble llamada a Rama)
    actuaciones_prefetch,
  } = body;

  if (!numero_proceso?.trim()) {
    return NextResponse.json({ error: "El número de proceso es requerido" }, { status: 400 });
  }

  // Verificar que no exista ya este proceso en el centro (por número o por rama_id)
  const { data: existingPorNumero } = await supabaseAdmin
    .from("sgcc_watched_processes")
    .select("id")
    .eq("center_id", centerId)
    .eq("numero_proceso", numero_proceso.trim())
    .maybeSingle();

  if (existingPorNumero) {
    return NextResponse.json({ error: "Este proceso ya está siendo vigilado" }, { status: 409 });
  }

  if (rama_id_proceso) {
    const { data: existingPorRama } = await supabaseAdmin
      .from("sgcc_watched_processes")
      .select("id")
      .eq("center_id", centerId)
      .eq("rama_id_proceso", rama_id_proceso)
      .maybeSingle();

    if (existingPorRama) {
      return NextResponse.json(
        { error: "Este proceso de la Rama Judicial ya está siendo vigilado" },
        { status: 409 }
      );
    }
  }

  // Validar case_id si se proporcionó
  if (case_id) {
    const { data: caso } = await supabaseAdmin
      .from("sgcc_cases")
      .select("id")
      .eq("id", case_id)
      .eq("center_id", centerId)
      .single();
    if (!caso) {
      return NextResponse.json({ error: "El caso vinculado no existe" }, { status: 400 });
    }
  }

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("sgcc_watched_processes")
    .insert({
      id: randomUUID(),
      center_id: centerId,
      case_id: case_id || null,
      numero_proceso: numero_proceso.trim(),
      despacho: despacho?.trim() || null,
      ciudad: ciudad?.trim() || null,
      partes_texto: partes_texto?.trim() || null,
      estado: "activo",
      solicitado_por_staff: (session.user as any).id,
      rama_id_proceso: rama_id_proceso ?? null,
      departamento: departamento?.trim?.() || departamento || null,
      sujetos_procesales: sujetos_procesales?.trim?.() || sujetos_procesales || null,
      fecha_proceso: fecha_proceso || null,
      es_privado: typeof es_privado === "boolean" ? es_privado : null,
      rama_ultima_actuacion_fecha: rama_ultima_actuacion_fecha || null,
      created_at: now,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Si viene de Rama Judicial, intentar popular actuaciones de una vez.
  // Best-effort: si falla, el proceso queda creado igual y el usuario puede
  // sincronizar luego desde el modal.
  let actuacionesInsertadas = 0;
  if (rama_id_proceso) {
    let actuaciones: ActuacionRama[] = Array.isArray(actuaciones_prefetch)
      ? (actuaciones_prefetch as ActuacionRama[])
      : [];

    if (actuaciones.length === 0) {
      try {
        actuaciones = await obtenerActuaciones(rama_id_proceso, 50);
      } catch (err: any) {
        console.error(
          `[vigilancia:import] Error obtenerActuaciones idProceso=${rama_id_proceso}:`,
          err?.message
        );
      }
    }

    if (actuaciones.length > 0) {
      const rows = actuaciones
        .filter((a) => a.actuacion)
        .map((a) => ({
          id: randomUUID(),
          watched_process_id: data.id,
          tipo_actuacion: a.actuacion,
          anotacion: a.anotacion || a.actuacion,
          fecha_actuacion: a.fechaActuacion
            ? new Date(a.fechaActuacion).toISOString().split("T")[0]
            : now.split("T")[0],
          detalles: a.fechaFinal
            ? `Término vence: ${String(a.fechaFinal).split("T")[0]}`
            : a.fechaRegistro
              ? `Registrada: ${String(a.fechaRegistro).split("T")[0]}`
              : null,
          leida: false,
          created_at: now,
        }));

      const { error: insertError } = await supabaseAdmin
        .from("sgcc_process_updates")
        .insert(rows);
      if (!insertError) {
        actuacionesInsertadas = rows.length;

        // Actualizar última actuación en el watched_process
        const primera = actuaciones[0];
        await supabaseAdmin
          .from("sgcc_watched_processes")
          .update({
            ultima_actuacion: primera.anotacion || primera.actuacion,
            ultima_actuacion_fecha: primera.fechaActuacion
              ? new Date(primera.fechaActuacion).toISOString().split("T")[0]
              : null,
          })
          .eq("id", data.id);
      } else {
        console.error("[vigilancia:import] insert actuaciones:", insertError.message);
      }
    }
  }

  return NextResponse.json(
    { ...data, actuaciones_insertadas: actuacionesInsertadas },
    { status: 201 }
  );
}
