import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin, uploadFile } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { renderTemplate, generateDocx } from "@/lib/doc-generator";
import { notify } from "@/lib/notifications";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: caseId } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { data: caso } = await supabaseAdmin
    .from("sgcc_cases")
    .select(`
      *,
      partes:sgcc_case_parties(
        id, rol, party:sgcc_parties(id, tipo_persona, nombres, apellidos, razon_social,
          numero_doc, nit_empresa, email, telefono, tipo_doc)
      ),
      conciliador:sgcc_staff!sgcc_cases_conciliador_id_fkey(id, nombre, tarjeta_profesional)
    `)
    .eq("id", caseId)
    .eq("center_id", centerId)
    .single();

  if (!caso) return NextResponse.json({ error: "Caso no encontrado" }, { status: 404 });
  if (caso.estado !== "admitido") {
    return NextResponse.json({ error: "El caso debe estar admitido" }, { status: 400 });
  }

  const { data: center } = await supabaseAdmin
    .from("sgcc_centers")
    .select("*")
    .eq("id", centerId)
    .single();

  const body = await req.json();
  const { template_id, fecha_audiencia_propuesta, sala_id, mensaje_personalizado } = body;

  // Cargar plantilla
  const { data: template } = await supabaseAdmin
    .from("sgcc_templates")
    .select("*")
    .eq("id", template_id)
    .single();

  if (!template) return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });

  // Actualizar fecha de audiencia si se proporcionó
  if (fecha_audiencia_propuesta) {
    await supabaseAdmin
      .from("sgcc_cases")
      .update({ fecha_audiencia: fecha_audiencia_propuesta, sala_id: sala_id ?? caso.sala_id, updated_at: new Date().toISOString() })
      .eq("id", caseId);
  }

  const convocante = caso.partes.find((p: any) => p.rol === "convocante");
  const convocados = caso.partes.filter((p: any) => p.rol === "convocado");

  const ctx = {
    caso: { ...caso, fecha_audiencia: fecha_audiencia_propuesta ?? caso.fecha_audiencia },
    centro: center,
    convocante: convocante?.party,
    convocados: convocados.map((c: any) => c.party),
    conciliador: caso.conciliador,
  };

  // Renderizar y generar documento
  const contenido = mensaje_personalizado
    ? renderTemplate(template.contenido, ctx) + "\n\n" + mensaje_personalizado
    : renderTemplate(template.contenido, ctx);

  const docBuffer = await generateDocx("CITACIÓN A AUDIENCIA DE CONCILIACIÓN", contenido, ctx);

  // Subir a Storage
  const storagePath = `sgcc-docs/${centerId}/${caseId}/citacion-${Date.now()}.docx`;
  const url = await uploadFile(
    docBuffer,
    "documentos",
    storagePath,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );

  // Guardar documento en BD
  const docId = randomUUID();
  await supabaseAdmin.from("sgcc_documents").insert({
    id: docId,
    center_id: centerId,
    case_id: caseId,
    tipo: "citacion",
    nombre: `Citación ${caso.numero_radicado}.docx`,
    storage_path: storagePath,
    url,
    mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    subido_por_staff: (session.user as any).id,
    created_at: new Date().toISOString(),
  });

  // Marcar citación enviada a cada parte
  const now = new Date().toISOString();
  for (const cp of caso.partes) {
    await supabaseAdmin
      .from("sgcc_case_parties")
      .update({ citacion_enviada_at: now })
      .eq("id", cp.id);
  }

  // Actualizar estado del caso a citado
  await supabaseAdmin
    .from("sgcc_cases")
    .update({ estado: "citado", updated_at: now })
    .eq("id", caseId);

  // Timeline
  await supabaseAdmin.from("sgcc_case_timeline").insert({
    id: randomUUID(),
    case_id: caseId,
    etapa: "citacion",
    descripcion: "Citaciones enviadas a todas las partes",
    completado: true,
    fecha: now,
    created_at: now,
  });

  // Enviar citación por email a todas las partes
  const recipients = caso.partes.map((cp: any) => ({
    partyId: cp.party.id,
    email: cp.party.email,
  }));

  const fechaStr = fecha_audiencia_propuesta
    ? new Date(fecha_audiencia_propuesta).toLocaleString("es-CO", { dateStyle: "full", timeStyle: "short" })
    : "Por definir";

  await notify({
    centerId,
    caseId,
    tipo: "citacion",
    titulo: `Citación — Audiencia de conciliación ${caso.numero_radicado}`,
    mensaje: `Ha sido citado a una audiencia de conciliación.\n\nRadicado: ${caso.numero_radicado}\nFecha: ${fechaStr}\n\nAdjuntamos el documento de citación. Por favor descárguelo y confírmela asistencia.`,
    recipients,
    canal: "both",
    attachmentUrl: url,
  });

  return NextResponse.json({ url, docId }, { status: 201 });
}
