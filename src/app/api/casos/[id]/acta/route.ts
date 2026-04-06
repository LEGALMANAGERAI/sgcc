import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin, uploadFile } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { renderTemplate, generateDocx } from "@/lib/doc-generator";
import { notify } from "@/lib/notifications";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: caseId } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("sgcc_actas")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });

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
    .select(`
      *,
      partes:sgcc_case_parties(
        id, rol, asistio,
        party:sgcc_parties(id, tipo_persona, nombres, apellidos, razon_social,
          numero_doc, nit_empresa, email, tipo_doc)
      ),
      conciliador:sgcc_staff!sgcc_cases_conciliador_id_fkey(id, nombre, tarjeta_profesional)
    `)
    .eq("id", caseId)
    .eq("center_id", centerId)
    .single();

  if (!caso) return NextResponse.json({ error: "Caso no encontrado" }, { status: 404 });

  const { data: center } = await supabaseAdmin
    .from("sgcc_centers")
    .select("*")
    .eq("id", centerId)
    .single();

  const body = await req.json();
  const {
    hearing_id,
    tipo,
    consideraciones,
    acuerdo_texto,
    obligaciones,
    es_constancia,
    asistencia, // [{case_party_id, asistio}]
    template_id,
  } = body;

  if (!tipo) return NextResponse.json({ error: "Tipo de acta requerido" }, { status: 400 });

  // Actualizar asistencia
  if (asistencia?.length) {
    for (const a of asistencia) {
      await supabaseAdmin
        .from("sgcc_case_parties")
        .update({ asistio: a.asistio })
        .eq("id", a.case_party_id);
    }
  }

  // Generar número de acta: YYYY-RADICADO-A
  const year = new Date().getFullYear();
  const { count } = await supabaseAdmin
    .from("sgcc_actas")
    .select("*", { count: "exact", head: true })
    .eq("case_id", caseId);

  const letra = String.fromCharCode(65 + (count ?? 0)); // A, B, C...
  const numero_acta = `${year}-${caso.numero_radicado}-${letra}`;

  // Cargar plantilla apropiada
  let templateContent = "";
  if (template_id) {
    const { data: tpl } = await supabaseAdmin
      .from("sgcc_templates")
      .select("contenido")
      .eq("id", template_id)
      .single();
    templateContent = tpl?.contenido ?? "";
  } else {
    // Plantilla por defecto según tipo
    const tipoPlantilla = tipo === "acuerdo_total" || tipo === "acuerdo_parcial"
      ? "acta_acuerdo"
      : tipo === "inasistencia"
      ? "acta_inasistencia"
      : "acta_no_acuerdo";

    const { data: tpl } = await supabaseAdmin
      .from("sgcc_templates")
      .select("contenido")
      .eq("center_id", centerId)
      .eq("tipo", tipoPlantilla)
      .eq("es_default", true)
      .single();

    if (!tpl) {
      // Fallback: plantilla global del sistema
      const { data: globalTpl } = await supabaseAdmin
        .from("sgcc_templates")
        .select("contenido")
        .is("center_id", null)
        .eq("tipo", tipoPlantilla)
        .eq("es_default", true)
        .single();
      templateContent = globalTpl?.contenido ?? "";
    } else {
      templateContent = tpl.contenido;
    }
  }

  const convocante = caso.partes.find((p: any) => p.rol === "convocante");
  const convocados = caso.partes.filter((p: any) => p.rol === "convocado");

  const now = new Date();
  const actaId = randomUUID();

  // Construir contexto con la info del acta
  const actaData = {
    id: actaId,
    case_id: caseId,
    hearing_id: hearing_id ?? null,
    numero_acta,
    tipo,
    consideraciones: consideraciones ?? null,
    acuerdo_texto: acuerdo_texto ?? null,
    obligaciones: obligaciones ?? null,
    borrador_url: null,
    estado_firma: "pendiente" as const,
    acta_firmada_url: null,
    conciliador_id: caso.conciliador_id,
    fecha_acta: now.toISOString().split("T")[0],
    es_constancia: es_constancia ?? false,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  const ctx = {
    caso,
    centro: center,
    convocante: convocante?.party,
    convocados: convocados.map((c: any) => c.party),
    conciliador: caso.conciliador,
    acta: { ...actaData, acuerdo_texto, obligaciones },
  };

  // Generar contenido del acta
  const contenidoFinal = templateContent
    ? renderTemplate(templateContent, ctx)
    : buildDefaultActaContent(tipo, consideraciones, acuerdo_texto, ctx);

  const tipoTitulo = {
    acuerdo_total: "ACTA DE CONCILIACIÓN — ACUERDO TOTAL",
    acuerdo_parcial: "ACTA DE CONCILIACIÓN — ACUERDO PARCIAL",
    no_acuerdo: "ACTA DE CONCILIACIÓN — SIN ACUERDO",
    inasistencia: "CONSTANCIA DE INASISTENCIA",
    desistimiento: "ACTA DE DESISTIMIENTO",
    improcedente: "CONSTANCIA DE IMPROCEDENCIA",
  }[tipo] ?? "ACTA DE CONCILIACIÓN";

  const docBuffer = await generateDocx(tipoTitulo, contenidoFinal, ctx);

  // Subir borrador
  const storagePath = `sgcc-docs/${centerId}/${caseId}/acta-${actaId}-borrador.docx`;
  const borradorUrl = await uploadFile(
    docBuffer,
    "documentos",
    storagePath,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );

  actaData.borrador_url = borradorUrl;

  // Insertar acta en BD
  const { error: actaError } = await supabaseAdmin.from("sgcc_actas").insert(actaData);
  if (actaError) return NextResponse.json({ error: actaError.message }, { status: 500 });

  // Guardar como documento
  await supabaseAdmin.from("sgcc_documents").insert({
    id: randomUUID(),
    center_id: centerId,
    case_id: caseId,
    acta_id: actaId,
    tipo: "acta_borrador",
    nombre: `${tipoTitulo} — ${numero_acta}.docx`,
    storage_path: storagePath,
    url: borradorUrl,
    mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    subido_por_staff: (session.user as any).id,
    created_at: now.toISOString(),
  });

  // Si es acuerdo o cierre, actualizar estado del caso
  if (["acuerdo_total", "no_acuerdo", "inasistencia", "desistimiento"].includes(tipo)) {
    await supabaseAdmin
      .from("sgcc_cases")
      .update({
        sub_estado: tipo,
        updated_at: now.toISOString(),
      })
      .eq("id", caseId);
  }

  // Timeline
  await supabaseAdmin.from("sgcc_case_timeline").insert({
    id: randomUUID(),
    case_id: caseId,
    etapa: "acta",
    descripcion: `Acta generada: ${tipoTitulo}`,
    completado: false, // Se completa cuando está firmada
    fecha: now.toISOString(),
    referencia_id: actaId,
    created_at: now.toISOString(),
  });

  // Notificar a las partes que el acta está lista para firmar
  const { data: caseParties } = await supabaseAdmin
    .from("sgcc_case_parties")
    .select("party:sgcc_parties(id, email)")
    .eq("case_id", caseId);

  const recipients = (caseParties ?? [])
    .map((cp: any) => ({ partyId: cp.party?.id, email: cp.party?.email }))
    .filter((r) => r.email);

  if (recipients.length) {
    await notify({
      centerId,
      caseId,
      tipo: "acta_lista",
      titulo: `Acta disponible — ${caso.numero_radicado}`,
      mensaje: `El acta de su proceso de conciliación ha sido generada y está disponible para descarga y firma.\n\nNúmero de acta: ${numero_acta}\nTipo: ${tipoTitulo}`,
      recipients,
      canal: "both",
      attachmentUrl: borradorUrl,
    });
  }

  return NextResponse.json({ acta: actaData, borradorUrl }, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: caseId } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  const body = await req.json();
  const { acta_id, acta_firmada_url, estado_firma } = body;

  const updateData: any = { updated_at: new Date().toISOString() };
  if (acta_firmada_url) updateData.acta_firmada_url = acta_firmada_url;
  if (estado_firma) updateData.estado_firma = estado_firma;

  const { data: acta, error } = await supabaseAdmin
    .from("sgcc_actas")
    .update(updateData)
    .eq("id", acta_id)
    .eq("case_id", caseId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Si está completamente firmada → cerrar el caso
  if (estado_firma === "firmado_completo") {
    const now = new Date().toISOString();

    await supabaseAdmin
      .from("sgcc_cases")
      .update({ estado: "cerrado", fecha_cierre: now.split("T")[0], updated_at: now })
      .eq("id", caseId);

    // Actualizar timeline del acta
    await supabaseAdmin
      .from("sgcc_case_timeline")
      .update({ completado: true, fecha: now })
      .eq("case_id", caseId)
      .eq("etapa", "acta");

    // Timeline archivo
    await supabaseAdmin.from("sgcc_case_timeline").insert({
      id: randomUUID(),
      case_id: caseId,
      etapa: "archivo",
      descripcion: "Caso cerrado y archivado",
      completado: true,
      fecha: now,
      created_at: now,
    });

    // Notificar cierre
    const { data: caseParties } = await supabaseAdmin
      .from("sgcc_case_parties")
      .select("party:sgcc_parties(id, email)")
      .eq("case_id", caseId);

    const { data: caso } = await supabaseAdmin
      .from("sgcc_cases")
      .select("numero_radicado")
      .eq("id", caseId)
      .single();

    const recipients = (caseParties ?? [])
      .map((cp: any) => ({ partyId: cp.party?.id, email: cp.party?.email }))
      .filter((r) => r.email);

    if (recipients.length && centerId) {
      await notify({
        centerId,
        caseId,
        tipo: "caso_cerrado",
        titulo: `Proceso cerrado — ${caso?.numero_radicado}`,
        mensaje: "Su proceso de conciliación ha concluido. El acta firmada queda disponible en su portal.",
        recipients,
        canal: "both",
        attachmentUrl: acta_firmada_url,
      });
    }
  }

  return NextResponse.json(acta);
}

// Genera contenido de acta cuando no hay plantilla configurada
function buildDefaultActaContent(tipo: string, consideraciones: string, acuerdo: string, ctx: any): string {
  const partes = [ctx.convocante, ...ctx.convocados]
    .map((p: any) => `${[p.nombres, p.apellidos, p.razon_social].filter(Boolean).join(" ")} (${p.email})`)
    .join(", ");

  return `En {{centro.ciudad}}, siendo las ${new Date().toLocaleTimeString("es-CO", { timeStyle: "short" })} del día {{fecha.hoy}}, se celebró audiencia de conciliación entre las partes:

PARTES: ${partes}

CONCILIADOR: {{conciliador.nombre}} — T.P. {{conciliador.tarjeta}}

ASUNTO: Solicitud No. {{caso.radicado}} — Materia: {{caso.materia}}

CONSIDERACIONES:
${consideraciones ?? ""}

${tipo.includes("acuerdo") ? `ACUERDO:\n${acuerdo ?? ""}` : tipo === "inasistencia" ? "INASISTENCIA:\nLas partes o alguna de ellas no se presentó a la audiencia." : "NO ACUERDO:\nLas partes no lograron llegar a un acuerdo."}
`;
}
