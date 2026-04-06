import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { notify } from "@/lib/notifications";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: caseId } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("sgcc_hearings")
    .select("*, conciliador:sgcc_staff(nombre), sala:sgcc_rooms(nombre, tipo, link_virtual)")
    .eq("case_id", caseId)
    .order("fecha_hora", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: caseId } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { data: caso } = await supabaseAdmin
    .from("sgcc_cases")
    .select("id, estado, numero_radicado, materia, center_id")
    .eq("id", caseId)
    .eq("center_id", centerId)
    .single();

  if (!caso) return NextResponse.json({ error: "Caso no encontrado" }, { status: 404 });

  const body = await req.json();
  const { conciliador_id, sala_id, fecha_hora, duracion_min, tipo, notas_previas } = body;

  if (!fecha_hora) return NextResponse.json({ error: "Fecha y hora requerida" }, { status: 400 });

  // Verificar disponibilidad del conciliador (sin traslapes)
  if (conciliador_id) {
    const startTime = new Date(fecha_hora);
    const endTime = new Date(startTime.getTime() + (duracion_min ?? 60) * 60 * 1000);

    const { data: conflictos } = await supabaseAdmin
      .from("sgcc_hearings")
      .select("id, fecha_hora, duracion_min")
      .eq("conciliador_id", conciliador_id)
      .neq("estado", "cancelada")
      .gte("fecha_hora", startTime.toISOString())
      .lte("fecha_hora", endTime.toISOString());

    if (conflictos && conflictos.length > 0) {
      return NextResponse.json({
        error: "El conciliador ya tiene una audiencia programada en ese horario",
      }, { status: 409 });
    }
  }

  const now = new Date().toISOString();
  const hearingId = randomUUID();

  const { data: hearing, error } = await supabaseAdmin
    .from("sgcc_hearings")
    .insert({
      id: hearingId,
      case_id: caseId,
      conciliador_id: conciliador_id ?? null,
      sala_id: sala_id ?? null,
      fecha_hora,
      duracion_min: duracion_min ?? 60,
      estado: "programada",
      tipo: tipo ?? "inicial",
      notas_previas: notas_previas ?? null,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Actualizar fecha_audiencia en el caso y estado si estaba en citado
  const caseUpdate: any = {
    fecha_audiencia: fecha_hora,
    updated_at: now,
  };
  if (caso.estado === "citado") {
    caseUpdate.estado = "audiencia";
  }
  await supabaseAdmin.from("sgcc_cases").update(caseUpdate).eq("id", caseId);

  // Timeline
  if (caso.estado === "citado") {
    await supabaseAdmin.from("sgcc_case_timeline").insert({
      id: randomUUID(),
      case_id: caseId,
      etapa: "audiencia",
      descripcion: `Audiencia programada para ${new Date(fecha_hora).toLocaleString("es-CO")}`,
      completado: false,
      fecha: fecha_hora,
      created_at: now,
    });
  }

  // Notificar a las partes (recordatorio de audiencia)
  const { data: caseParties } = await supabaseAdmin
    .from("sgcc_case_parties")
    .select("party:sgcc_parties(id, email)")
    .eq("case_id", caseId);

  const recipients = (caseParties ?? [])
    .map((cp: any) => ({ partyId: cp.party?.id, email: cp.party?.email }))
    .filter((r) => r.email);

  if (recipients.length) {
    const fechaStr = new Date(fecha_hora).toLocaleString("es-CO", { dateStyle: "full", timeStyle: "short" });
    await notify({
      centerId,
      caseId,
      tipo: "recordatorio_audiencia",
      titulo: `Audiencia programada — ${caso.numero_radicado}`,
      mensaje: `Su audiencia de conciliación ha sido programada.\n\nFecha: ${fechaStr}\nDuración estimada: ${duracion_min ?? 60} minutos.`,
      recipients,
      canal: "both",
    });
  }

  return NextResponse.json(hearing, { status: 201 });
}
