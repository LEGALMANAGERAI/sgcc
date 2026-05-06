import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";

const ESTADOS_VALIDOS = new Set([
  "programada",
  "en_curso",
  "suspendida",
  "finalizada",
  "cancelada",
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro asignado" }, { status: 400 });

  const { id } = await params;
  const body = await req.json();

  // Validar que la audiencia exista y pertenezca al centro (vía caso)
  const { data: hearing } = await supabaseAdmin
    .from("sgcc_hearings")
    .select(
      "id, case_id, fecha_hora, duracion_min, conciliador_id, estado, tipo, caso:sgcc_cases!inner(id, center_id)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!hearing || (hearing.caso as any)?.center_id !== centerId) {
    return NextResponse.json({ error: "Audiencia no encontrada" }, { status: 404 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.fecha_hora !== undefined) {
    if (!body.fecha_hora) {
      return NextResponse.json({ error: "Fecha y hora inválida" }, { status: 400 });
    }
    const newFecha = String(body.fecha_hora);
    update.fecha_hora = newFecha;

    // Validar conflictos del conciliador si la audiencia tiene uno asignado.
    const concId = body.conciliador_id ?? hearing.conciliador_id;
    if (concId) {
      const dur = Number.isFinite(body.duracion_min)
        ? body.duracion_min
        : hearing.duracion_min ?? 60;
      const start = new Date(newFecha);
      const end = new Date(start.getTime() + dur * 60 * 1000);
      const { data: conflictos } = await supabaseAdmin
        .from("sgcc_hearings")
        .select("id")
        .eq("conciliador_id", concId)
        .neq("estado", "cancelada")
        .neq("id", id)
        .gte("fecha_hora", start.toISOString())
        .lt("fecha_hora", end.toISOString());

      if (conflictos && conflictos.length > 0) {
        return NextResponse.json(
          { error: "El conciliador ya tiene otra audiencia en ese horario" },
          { status: 409 }
        );
      }
    }
  }

  if (body.duracion_min !== undefined) {
    const n = Number(body.duracion_min);
    if (!Number.isFinite(n)) {
      return NextResponse.json({ error: "Duración inválida" }, { status: 400 });
    }
    update.duracion_min = Math.max(15, Math.min(600, n));
  }

  if (body.estado !== undefined) {
    if (!ESTADOS_VALIDOS.has(String(body.estado))) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }
    update.estado = body.estado;
  }

  if (body.conciliador_id !== undefined) {
    update.conciliador_id = body.conciliador_id || null;
  }
  if (body.sala_id !== undefined) {
    update.sala_id = body.sala_id || null;
  }
  if (body.modalidad !== undefined) {
    if (!["presencial", "virtual", "mixta"].includes(String(body.modalidad))) {
      return NextResponse.json({ error: "Modalidad inválida" }, { status: 400 });
    }
    update.modalidad = body.modalidad;
  }
  if (body.plataforma_virtual !== undefined) {
    update.plataforma_virtual = body.plataforma_virtual || null;
  }
  if (body.notas_previas !== undefined) {
    update.notas_previas = body.notas_previas || null;
  }

  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("sgcc_hearings")
    .update(update)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Si se reprogramó la fecha y la audiencia es la inicial, actualizar el caso.
  if (update.fecha_hora && hearing.tipo === "inicial") {
    await supabaseAdmin
      .from("sgcc_cases")
      .update({ fecha_audiencia: update.fecha_hora, updated_at: new Date().toISOString() })
      .eq("id", hearing.case_id);
  }

  return NextResponse.json({ ok: true });
}
