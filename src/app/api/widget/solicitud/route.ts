import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { generateRadicado } from "@/lib/server-utils";
import { randomUUID } from "crypto";

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
}

/**
 * Busca o crea una parte (party) en sgcc_parties.
 * Busca primero por email, luego por número de documento.
 */
async function findOrCreateParty(
  centerId: string,
  persona: PersonaPayload
): Promise<string> {
  // Buscar por email
  const { data: byEmail } = await supabaseAdmin
    .from("sgcc_parties")
    .select("id")
    .eq("center_id", centerId)
    .eq("email", persona.email)
    .limit(1)
    .maybeSingle();

  if (byEmail) return byEmail.id;

  // Buscar por número de documento (solo personas naturales)
  if (persona.tipo_persona === "natural" && persona.numero_doc) {
    const { data: byDoc } = await supabaseAdmin
      .from("sgcc_parties")
      .select("id")
      .eq("center_id", centerId)
      .eq("numero_doc", persona.numero_doc)
      .limit(1)
      .maybeSingle();

    if (byDoc) return byDoc.id;
  }

  // Buscar por NIT (personas jurídicas)
  if (persona.tipo_persona === "juridica" && persona.nit_empresa) {
    const { data: byNit } = await supabaseAdmin
      .from("sgcc_parties")
      .select("id")
      .eq("center_id", centerId)
      .eq("numero_doc", persona.nit_empresa)
      .limit(1)
      .maybeSingle();

    if (byNit) return byNit.id;
  }

  // Crear nueva parte
  const partyId = randomUUID();
  const isNatural = persona.tipo_persona === "natural";

  const { error } = await supabaseAdmin.from("sgcc_parties").insert({
    id: partyId,
    center_id: centerId,
    tipo_persona: persona.tipo_persona,
    nombres: isNatural ? persona.nombres : null,
    apellidos: isNatural ? persona.apellidos : null,
    tipo_doc: isNatural ? (persona.tipo_doc ?? "CC") : "NIT",
    numero_doc: isNatural ? persona.numero_doc : persona.nit_empresa,
    razon_social: !isNatural ? persona.razon_social : null,
    representante_legal: !isNatural ? persona.representante_legal : null,
    email: persona.email,
    telefono: persona.telefono ?? null,
    ciudad: persona.ciudad ?? null,
    created_at: new Date().toISOString(),
  });

  if (error) throw new Error(`Error creando parte: ${error.message}`);
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

    // 1. Verificar que el centro existe y está activo
    const { data: center, error: centerError } = await supabaseAdmin
      .from("sgcc_centers")
      .select("id, nombre, estado")
      .eq("id", body.center_id)
      .single();

    if (centerError || !center) {
      return NextResponse.json({ error: "Centro de conciliación no encontrado" }, { status: 404 });
    }

    if (center.estado !== "activo") {
      return NextResponse.json({ error: "El centro no se encuentra activo" }, { status: 400 });
    }

    // 2. Crear o buscar partes
    const convocanteId = await findOrCreateParty(body.center_id, body.convocante);
    const convocadoIds: string[] = [];
    for (const conv of body.convocados) {
      const id = await findOrCreateParty(body.center_id, conv);
      convocadoIds.push(id);
    }

    // 3. Generar radicado
    const radicado = await generateRadicado(body.center_id);

    // 4. Crear caso
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
      center_id: body.center_id,
      tipo: "solicitud_recibida",
      titulo: "Solicitud recibida vía widget",
      descripcion: `Solicitud de ${body.tipo_tramite} recibida a través del formulario web. Materia: ${body.materia}.`,
      es_automatico: true,
      created_at: new Date().toISOString(),
    });

    // 7. Intentar notificar al centro (staff admin)
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
          tipo: "solicitud",
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

    // 8. Retornar éxito
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
