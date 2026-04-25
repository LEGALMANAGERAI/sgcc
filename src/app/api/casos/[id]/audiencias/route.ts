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
    .select("id, estado, numero_radicado, materia, center_id, conciliador_id")
    .eq("id", caseId)
    .eq("center_id", centerId)
    .single();

  if (!caso) return NextResponse.json({ error: "Caso no encontrado" }, { status: 404 });

  const body = await req.json();
  const {
    conciliador_id,
    sala_id,
    fecha_hora,
    duracion_min,
    tipo,
    modalidad,
    plataforma_virtual,
    notas_previas,
  } = body;

  if (!fecha_hora) return NextResponse.json({ error: "Fecha y hora requerida" }, { status: 400 });

  const modalidadFinal: "presencial" | "virtual" | "mixta" = modalidad ?? "presencial";
  if (!["presencial", "virtual", "mixta"].includes(modalidadFinal)) {
    return NextResponse.json({ error: "Modalidad inválida" }, { status: 400 });
  }

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
      modalidad: modalidadFinal,
      plataforma_virtual: modalidadFinal === "presencial" ? null : plataforma_virtual ?? null,
      notas_previas: notas_previas ?? null,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Actualizar fecha_audiencia en el caso solo si es la audiencia inicial,
  // para no pisar la fecha original al agregar continuaciones/complementarias.
  const caseUpdate: any = { updated_at: now };
  if ((tipo ?? "inicial") === "inicial") {
    caseUpdate.fecha_audiencia = fecha_hora;
  }
  if (caso.estado === "citado") {
    caseUpdate.estado = "audiencia";
  }
  // Sincronizar conciliador del caso si venía vacío. Así el conciliador que
  // atiende la audiencia puede ver el expediente en su listado y dashboard
  // sin depender de una designación adicional manual. No lo pisamos si ya
  // hay otro conciliador designado (decisión explícita del admin).
  if (conciliador_id && !caso.conciliador_id) {
    caseUpdate.conciliador_id = conciliador_id;
  }
  await supabaseAdmin.from("sgcc_cases").update(caseUpdate).eq("id", caseId);

  // Timeline
  if (caso.estado === "citado") {
    await supabaseAdmin.from("sgcc_case_timeline").insert({
      id: randomUUID(),
      case_id: caseId,
      etapa: "audiencia",
      descripcion: `Audiencia programada para ${new Date(fecha_hora).toLocaleString("es-CO", { timeZone: "America/Bogota" })}`,
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
    const fechaStr = new Date(fecha_hora).toLocaleString("es-CO", { dateStyle: "full", timeStyle: "short", timeZone: "America/Bogota" });
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: caseId } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const { hearing_id, estado, resultado, fecha_continuacion, notas_previas } = body;

  if (!hearing_id) {
    return NextResponse.json({ error: "hearing_id es requerido" }, { status: 400 });
  }

  const now = new Date().toISOString();

  // Update de audiencia: solo columnas que existen en sgcc_hearings
  const updates: Record<string, any> = { updated_at: now };
  if (estado !== undefined) updates.estado = estado;
  if (notas_previas !== undefined) updates.notas_previas = notas_previas;

  // Si está suspendida y hay fecha de continuación, actualizar fecha_hora
  // a la nueva fecha (reprogramación in-place). Se asume hora 09:00 local.
  if (estado === "suspendida" && fecha_continuacion) {
    updates.fecha_hora = `${fecha_continuacion}T09:00:00-05:00`;
  }

  const { error: hearingError } = await supabaseAdmin
    .from("sgcc_hearings")
    .update(updates)
    .eq("id", hearing_id)
    .eq("case_id", caseId);

  if (hearingError) {
    return NextResponse.json({ error: hearingError.message }, { status: 500 });
  }

  // Si hay resultado, guardarlo en sgcc_cases.sub_estado (solo valores permitidos por el CHECK)
  const subEstadosValidos = [
    "acuerdo_total",
    "acuerdo_parcial",
    "no_acuerdo",
    "inasistencia",
    "desistimiento",
  ];
  if (resultado && subEstadosValidos.includes(resultado)) {
    await supabaseAdmin
      .from("sgcc_cases")
      .update({ sub_estado: resultado, updated_at: now })
      .eq("id", caseId);
  }

  // Si suspendida con fecha de continuación, entrada en timeline
  if (estado === "suspendida" && fecha_continuacion) {
    await supabaseAdmin.from("sgcc_case_timeline").insert({
      id: randomUUID(),
      case_id: caseId,
      etapa: "audiencia",
      descripcion: `Audiencia suspendida. Continuación: ${fecha_continuacion}${
        resultado ? `. Resultado: ${resultado}` : ""
      }.`,
      completado: false,
      fecha: now,
      referencia_id: hearing_id,
      created_at: now,
    });
  }

  // Si finalizada, entrada en timeline
  if (estado === "finalizada") {
    const resultLabel: Record<string, string> = {
      acuerdo_total: "Acuerdo total",
      acuerdo_parcial: "Acuerdo parcial",
      no_acuerdo: "No acuerdo",
      inasistencia: "Inasistencia",
      desistimiento: "Desistimiento",
    };
    const desc = resultado
      ? `Audiencia finalizada con resultado: ${resultLabel[resultado] ?? resultado}.`
      : "Audiencia finalizada.";
    await supabaseAdmin.from("sgcc_case_timeline").insert({
      id: randomUUID(),
      case_id: caseId,
      etapa: "audiencia",
      descripcion: desc,
      completado: true,
      fecha: now,
      referencia_id: hearing_id,
      created_at: now,
    });
  }

  return NextResponse.json({ success: true });
}
