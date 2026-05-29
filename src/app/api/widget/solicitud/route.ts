import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { generateRadicado } from "@/lib/server-utils";
import { randomUUID } from "crypto";
import { asignarConciliador } from "@/lib/asignacion-conciliador";
import { findOrCreateParty } from "@/lib/parties";

interface PersonaPayload {
  tipo_persona: "natural" | "juridica";
  nombres?: string;
  apellidos?: string;
  tipo_doc?: string;
  numero_doc?: string;
  razon_social?: string;
  nit_empresa?: string;
  representante_legal?: string;
  email: string;
  telefono?: string;
  ciudad?: string;
}

interface SolicitudPayload {
  center_id: string;
  tipo_tramite: string;
  materia: string;
  cuantia: number | null;
  cuantia_indeterminada: boolean;
  descripcion: string;
  convocante: PersonaPayload;
  convocados: PersonaPayload[];
  conciliador_solicitado?: string;
}

/**
 * Wrapper sobre findOrCreateParty para preservar la firma legacy del widget
 * (centerId + PersonaPayload). Para juridicas mapea nit_empresa a numero_doc
 * porque findOrCreateParty espera el documento en numero_doc para ambos tipos.
 */
async function findOrCreatePartyForWidget(
  centerId: string,
  persona: PersonaPayload,
): Promise<string> {
  const numeroDoc =
    persona.tipo_persona === "juridica" ? persona.nit_empresa : persona.numero_doc;

  const { partyId } = await findOrCreateParty(
    {
      tipo_persona: persona.tipo_persona,
      nombres: persona.nombres ?? null,
      apellidos: persona.apellidos ?? null,
      razon_social: persona.razon_social ?? null,
      tipo_doc: persona.tipo_doc ?? null,
      numero_doc: numeroDoc ?? null,
      email: persona.email,
      telefono: persona.telefono ?? null,
      ciudad: persona.ciudad ?? null,
    },
    { centerId },
  );

  return partyId;
}

export async function POST(req: Request) {
  try {
    const body: SolicitudPayload = await req.json();

    // Validaciones básicas
    if (!body.center_id) {
      return NextResponse.json({ error: "center_id es requerido" }, { status: 400 });
    }
    if (!body.tipo_tramite) {
      return NextResponse.json({ error: "tipo_tramite es requerido" }, { status: 400 });
    }
    if (!body.convocante?.email) {
      return NextResponse.json({ error: "Email del convocante es requerido" }, { status: 400 });
    }
    if (!body.convocados?.length) {
      return NextResponse.json({ error: "Al menos un convocado es requerido" }, { status: 400 });
    }
    if (!body.descripcion?.trim()) {
      return NextResponse.json({ error: "Descripción es requerida" }, { status: 400 });
    }

    // 1. Verificar que el centro existe y está activo.
    // OJO: sgcc_centers usa la columna booleana `activo`, NO `estado` (esta
    // última no existe en la tabla). Seleccionar `estado` hacía fallar la
    // consulta y devolvía siempre "Centro no encontrado".
    const { data: center, error: centerError } = await supabaseAdmin
      .from("sgcc_centers")
      .select("id, nombre, activo")
      .eq("id", body.center_id)
      .single();

    if (centerError || !center) {
      return NextResponse.json({ error: "Centro de conciliación no encontrado" }, { status: 404 });
    }

    if (!center.activo) {
      return NextResponse.json({ error: "El centro no se encuentra activo" }, { status: 400 });
    }

    // 2. Crear o buscar partes (match por documento, NUNCA por email)
    const convocanteId = await findOrCreatePartyForWidget(body.center_id, body.convocante);
    const convocadoIds: string[] = [];
    for (const conv of body.convocados) {
      const id = await findOrCreatePartyForWidget(body.center_id, conv);
      convocadoIds.push(id);
    }

    // 3. Generar radicado
    const radicado = await generateRadicado(body.center_id);

    // 4. Asignar conciliador según método del centro
    const conciliadorAsignado = await asignarConciliador(body.center_id, body.conciliador_solicitado);

    // 5. Crear caso
    const caseId = randomUUID();
    const { error: caseError } = await supabaseAdmin.from("sgcc_cases").insert({
      id: caseId,
      center_id: body.center_id,
      numero_radicado: radicado,
      tipo_tramite: body.tipo_tramite,
      materia: body.materia,
      cuantia: body.cuantia,
      cuantia_indeterminada: body.cuantia_indeterminada,
      descripcion: body.descripcion,
      estado: "solicitud",
      conciliador_id: conciliadorAsignado,
      created_by_party: convocanteId,
      created_at: new Date().toISOString(),
    });

    if (caseError) {
      console.error("Error creando caso:", caseError);
      return NextResponse.json({ error: "Error al crear la solicitud" }, { status: 500 });
    }

    // 5. Crear registros en sgcc_case_parties
    const caseParties = [
      {
        id: randomUUID(),
        case_id: caseId,
        party_id: convocanteId,
        rol: "convocante",
        created_at: new Date().toISOString(),
      },
      ...convocadoIds.map((pid) => ({
        id: randomUUID(),
        case_id: caseId,
        party_id: pid,
        rol: "convocado",
        created_at: new Date().toISOString(),
      })),
    ];

    const { error: partiesError } = await supabaseAdmin
      .from("sgcc_case_parties")
      .insert(caseParties);

    if (partiesError) {
      console.error("Error vinculando partes:", partiesError);
    }

    // 6. Crear entrada en timeline
    await supabaseAdmin.from("sgcc_case_timeline").insert({
      id: randomUUID(),
      case_id: caseId,
      etapa: "solicitud",
      descripcion: `Solicitud de ${body.tipo_tramite} recibida vía widget. Materia: ${body.materia}.`,
      completado: true,
      fecha: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });

    // 7. Crear documento resumen en el expediente
    const convNombre = body.convocante.tipo_persona === "natural"
      ? `${body.convocante.nombres ?? ""} ${body.convocante.apellidos ?? ""}`.trim()
      : body.convocante.razon_social ?? "";
    const convocadosNombres = body.convocados.map((c) =>
      c.tipo_persona === "natural"
        ? `${c.nombres ?? ""} ${c.apellidos ?? ""}`.trim()
        : c.razon_social ?? ""
    );

    const resumenTexto = [
      `SOLICITUD DE ${body.tipo_tramite.toUpperCase().replace("_", " ")}`,
      `Radicado: ${radicado}`,
      `Fecha: ${new Date().toLocaleDateString("es-CO")}`,
      ``,
      `MATERIA: ${body.materia}`,
      `CUANTÍA: ${body.cuantia_indeterminada ? "Indeterminada" : `$${(body.cuantia ?? 0).toLocaleString("es-CO")}`}`,
      ``,
      body.tipo_tramite === "insolvencia" ? `INSOLVENTE:` : `CONVOCANTE:`,
      `  ${convNombre}`,
      `  ${body.convocante.tipo_persona === "natural" ? `${body.convocante.tipo_doc ?? "CC"} ${body.convocante.numero_doc ?? ""}` : `NIT ${body.convocante.nit_empresa ?? ""}`}`,
      `  Email: ${body.convocante.email}`,
      body.convocante.telefono ? `  Tel: ${body.convocante.telefono}` : "",
      ``,
      body.tipo_tramite === "insolvencia" ? `ACREEDORES:` : `CONVOCADOS:`,
      ...convocadosNombres.map((n, i) => {
        const c = body.convocados[i];
        return `  ${i + 1}. ${n} — ${c.email}`;
      }),
      ``,
      `DESCRIPCIÓN:`,
      body.descripcion,
    ].filter(Boolean).join("\n");

    await supabaseAdmin.from("sgcc_case_documents").insert({
      id: randomUUID(),
      case_id: caseId,
      nombre: `Solicitud_${radicado}.txt`,
      tipo: "solicitud",
      contenido_texto: resumenTexto,
      subido_por_party: convocanteId,
      created_at: new Date().toISOString(),
    });

    // 8. Intentar notificar al centro (staff admin)
    try {
      const { data: admins } = await supabaseAdmin
        .from("sgcc_staff")
        .select("id, email")
        .eq("center_id", body.center_id)
        .eq("rol", "admin");

      if (admins?.length) {
        const { notify } = await import("@/lib/notifications");
        await notify({
          centerId: body.center_id,
          caseId,
          tipo: "nueva_solicitud",
          titulo: `Nueva solicitud de ${body.tipo_tramite}`,
          mensaje: `Se ha recibido una nueva solicitud de ${body.tipo_tramite} (${body.materia}) con radicado ${radicado}. Convocante: ${body.convocante.nombres ?? body.convocante.razon_social ?? body.convocante.email}.`,
          recipients: admins.map((a) => ({ staffId: a.id, email: a.email })),
          canal: "both",
        });
      }
    } catch (notifError) {
      console.error("Error notificando al centro:", notifError);
      // No fallamos la solicitud por un error de notificación
    }

    // 9. Retornar éxito
    return NextResponse.json({
      success: true,
      radicado,
      caseId,
    });
  } catch (error: any) {
    console.error("Error en widget/solicitud:", error);
    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}
