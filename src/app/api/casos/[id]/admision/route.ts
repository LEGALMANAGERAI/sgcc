import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId, addBusinessDays } from "@/lib/server-utils";
import { notify } from "@/lib/notifications";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: caseId } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  // Verificar que el caso pertenece al centro
  const { data: caso } = await supabaseAdmin
    .from("sgcc_cases")
    .select("id, estado, numero_radicado, materia")
    .eq("id", caseId)
    .eq("center_id", centerId)
    .single();

  if (!caso) return NextResponse.json({ error: "Caso no encontrado" }, { status: 404 });
  if (caso.estado !== "solicitud") {
    return NextResponse.json({ error: "El caso no está en estado de solicitud" }, { status: 400 });
  }

  const body = await req.json();
  const { decision, motivo_rechazo, conciliador_id, secretario_id, tarifa_base } = body;

  if (!["admitido", "rechazado"].includes(decision)) {
    return NextResponse.json({ error: "Decisión inválida" }, { status: 400 });
  }

  if (decision === "rechazado" && !motivo_rechazo) {
    return NextResponse.json({ error: "Se requiere motivo de rechazo" }, { status: 400 });
  }

  const now = new Date();
  const fechaAdmision = now.toISOString().split("T")[0];

  // Calcular fecha límite de citación (días hábiles según config del centro)
  let fechaLimiteCitacion: string | null = null;
  if (decision === "admitido") {
    const { data: center } = await supabaseAdmin
      .from("sgcc_centers")
      .select("dias_habiles_citacion")
      .eq("id", centerId)
      .single();

    const dias = center?.dias_habiles_citacion ?? 10;
    fechaLimiteCitacion = addBusinessDays(now, dias).toISOString().split("T")[0];
  }

  // Actualizar caso
  const updateData: any = {
    estado: decision,
    fecha_admision: decision === "admitido" ? fechaAdmision : null,
    fecha_limite_citacion: fechaLimiteCitacion,
    motivo_rechazo: decision === "rechazado" ? motivo_rechazo : null,
    updated_at: now.toISOString(),
  };

  if (decision === "admitido") {
    if (conciliador_id) updateData.conciliador_id = conciliador_id;
    if (secretario_id) updateData.secretario_id = secretario_id;
    if (tarifa_base) updateData.tarifa_base = tarifa_base;
  }

  const { data: updated, error } = await supabaseAdmin
    .from("sgcc_cases")
    .update(updateData)
    .eq("id", caseId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Timeline
  await supabaseAdmin.from("sgcc_case_timeline").insert({
    id: randomUUID(),
    case_id: caseId,
    etapa: "admision",
    descripcion: decision === "admitido"
      ? `Caso admitido. Fecha límite de citación: ${fechaLimiteCitacion}`
      : `Caso rechazado: ${motivo_rechazo}`,
    completado: true,
    fecha: now.toISOString(),
    created_at: now.toISOString(),
  });

  // Notificar a las partes
  const { data: caseParties } = await supabaseAdmin
    .from("sgcc_case_parties")
    .select("party:sgcc_parties(id, email)")
    .eq("case_id", caseId);

  const recipients = (caseParties ?? [])
    .map((cp: any) => ({ partyId: cp.party?.id, email: cp.party?.email }))
    .filter((r) => r.email);

  if (recipients.length) {
    const tipo = decision === "admitido" ? "admision" : "rechazo";
    const titulo = decision === "admitido"
      ? `Su solicitud ${caso.numero_radicado} fue admitida`
      : `Su solicitud ${caso.numero_radicado} fue rechazada`;
    const mensaje = decision === "admitido"
      ? `Su solicitud de conciliación en materia ${caso.materia} ha sido admitida por el centro.\nEn los próximos días hábiles recibirá la citación con la fecha de audiencia.`
      : `Su solicitud de conciliación fue rechazada por el siguiente motivo:\n${motivo_rechazo}`;

    await notify({ centerId, caseId, tipo, titulo, mensaje, recipients, canal: "both" });
  }

  return NextResponse.json({ caso: updated });
}
