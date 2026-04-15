import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId, generateRadicado, addBusinessDays } from "@/lib/server-utils";
import { notify } from "@/lib/notifications";
import { randomUUID } from "crypto";
import { asignarConciliador } from "@/lib/asignacion-conciliador";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const estado = searchParams.get("estado");
  const materia = searchParams.get("materia");

  let query = supabaseAdmin
    .from("sgcc_cases")
    .select(`
      id, numero_radicado, materia, estado, cuantia, cuantia_indeterminada,
      fecha_solicitud, fecha_audiencia, created_at,
      conciliador:sgcc_staff!sgcc_cases_conciliador_id_fkey(nombre),
      partes:sgcc_case_parties(
        rol, party:sgcc_parties(nombres, apellidos, razon_social, email)
      )
    `)
    .eq("center_id", centerId)
    .order("created_at", { ascending: false });

  if (estado) query = query.eq("estado", estado);
  if (materia) query = query.eq("materia", materia);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  // Soportar JSON y FormData
  const contentType = req.headers.get("content-type") ?? "";
  let body: any;
  let formData: FormData | null = null;

  if (contentType.includes("multipart/form-data")) {
    formData = await req.formData();
    body = JSON.parse(formData.get("data") as string);
  } else {
    body = await req.json();
  }

  const {
    tipo_tramite,
    materia,
    descripcion,
    cuantia,
    cuantia_indeterminada,
    conciliador_id,
    sala_id,
    partes,
  } = body;

  if (!materia || !descripcion || !partes?.length) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }

  const convocante = partes.find((p: any) => p.rol === "convocante");
  if (!convocante) {
    return NextResponse.json({ error: "Se requiere al menos un convocante" }, { status: 400 });
  }

  const convocados = partes.filter((p: any) => p.rol === "convocado");
  if (!convocados.length) {
    return NextResponse.json({ error: "Se requiere al menos un convocado" }, { status: 400 });
  }

  // Generar radicado
  const numero_radicado = await generateRadicado(centerId);
  const caseId = randomUUID();

  // Asignar conciliador según método del centro
  const conciliadorAsignado = await asignarConciliador(centerId, conciliador_id);

  // Insertar caso
  const { data: caso, error: caseError } = await supabaseAdmin
    .from("sgcc_cases")
    .insert({
      id: caseId,
      center_id: centerId,
      numero_radicado,
      tipo_tramite: tipo_tramite || "conciliacion",
      materia,
      descripcion,
      cuantia: cuantia ?? null,
      cuantia_indeterminada: cuantia_indeterminada ?? false,
      conciliador_id: conciliadorAsignado,
      sala_id: sala_id ?? null,
      estado: "solicitud",
      fecha_solicitud: new Date().toISOString().split("T")[0],
      created_by_staff: (session.user as any).id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (caseError) return NextResponse.json({ error: caseError.message }, { status: 500 });

  // Crear o encontrar partes y vincular al caso
  const casePartyRecords: any[] = [];

  for (const p of partes) {
    // Buscar parte existente por email
    let { data: party } = await supabaseAdmin
      .from("sgcc_parties")
      .select("id")
      .eq("email", p.email)
      .single();

    if (!party) {
      // Crear la parte (sin contraseña — será invitada)
      const partyId = randomUUID();
      const now = new Date().toISOString();
      const inviteToken = randomUUID();
      const inviteExpires = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

      await supabaseAdmin.from("sgcc_parties").insert({
        id: partyId,
        tipo_persona: p.tipo_persona,
        nombres: p.nombres || null,
        apellidos: p.apellidos || null,
        razon_social: p.razon_social || null,
        nit_empresa: p.tipo_persona === "juridica" ? p.numero_doc : null,
        tipo_doc: p.tipo_persona === "natural" ? p.tipo_doc : null,
        numero_doc: p.tipo_persona === "natural" ? p.numero_doc : null,
        email: p.email,
        telefono: p.telefono || null,
        invite_token: inviteToken,
        invite_expires: inviteExpires,
        invited_at: now,
        created_at: now,
        updated_at: now,
      });

      party = { id: partyId };
    }

    // Vincular al caso
    casePartyRecords.push({
      id: randomUUID(),
      case_id: caseId,
      party_id: party.id,
      rol: p.rol,
      created_at: new Date().toISOString(),
    });
  }

  await supabaseAdmin.from("sgcc_case_parties").insert(casePartyRecords);

  // Para insolvencia: crear una acreencia inicial por cada convocado (acreedor)
  if (tipo_tramite === "insolvencia") {
    const now = new Date().toISOString();
    const acreenciaRows = partes
      .map((p: any, idx: number) => ({ p, cp: casePartyRecords[idx] }))
      .filter(({ p }: any) => p.rol === "convocado")
      .map(({ p, cp }: any) => ({
        id: randomUUID(),
        case_id: caseId,
        center_id: centerId,
        party_id: cp?.party_id ?? null,
        acreedor_tipo: p.tipo_persona === "juridica" ? "juridica" : "natural",
        acreedor_nombre:
          p.tipo_persona === "juridica"
            ? p.razon_social || ""
            : [p.nombres, p.apellidos].filter(Boolean).join(" ") || "",
        acreedor_documento: p.numero_doc || null,
        created_at: now,
        updated_at: now,
      }));
    if (acreenciaRows.length > 0) {
      await supabaseAdmin.from("sgcc_acreencias").insert(acreenciaRows);
    }
  }

  // Crear apoderados si se proporcionaron
  for (let idx = 0; idx < partes.length; idx++) {
    const p = partes[idx];
    if (!p.apoderado || !p.apoderado.nombre || !p.apoderado.numero_doc) continue;

    const partyRecord = casePartyRecords[idx];
    if (!partyRecord) continue;

    const att = p.apoderado;
    const now = new Date().toISOString();

    // Buscar o crear el attorney
    let attorneyId: string;
    const { data: existingAtt } = await supabaseAdmin
      .from("sgcc_attorneys")
      .select("id")
      .eq("numero_doc", att.numero_doc)
      .single();

    if (existingAtt) {
      attorneyId = existingAtt.id;
      await supabaseAdmin.from("sgcc_attorneys").update({
        nombre: att.nombre,
        tipo_doc: att.tipo_doc ?? "CC",
        tarjeta_profesional: att.tarjeta_profesional || null,
        email: att.email || null,
        telefono: att.telefono || null,
        updated_at: now,
      }).eq("id", attorneyId);
    } else {
      attorneyId = randomUUID();
      await supabaseAdmin.from("sgcc_attorneys").insert({
        id: attorneyId,
        nombre: att.nombre,
        tipo_doc: att.tipo_doc ?? "CC",
        numero_doc: att.numero_doc,
        tarjeta_profesional: att.tarjeta_profesional || null,
        email: att.email || null,
        telefono: att.telefono || null,
        created_at: now,
        updated_at: now,
      });
    }

    // Crear case_attorney
    const caseAttorneyId = randomUUID();
    let poderUrl: string | null = null;

    // Subir poder si hay archivo
    if (formData) {
      const poderFile = formData.get(`poder_${idx}`) as File | null;
      if (poderFile && poderFile.size > 0) {
        const buffer = Buffer.from(await poderFile.arrayBuffer());
        const filePath = `${caseId}/${caseAttorneyId}.pdf`;
        const { error: upErr } = await supabaseAdmin.storage
          .from("poderes")
          .upload(filePath, buffer, { contentType: "application/pdf", upsert: true });
        if (upErr) {
          console.error(`[CASOS] Error subiendo poder a storage: ${upErr.message}`);
        } else {
          const { data: urlData } = supabaseAdmin.storage.from("poderes").getPublicUrl(filePath);
          poderUrl = urlData.publicUrl;
          console.log(`[CASOS] Poder subido: ${poderUrl}`);
        }
      }
    }

    await supabaseAdmin.from("sgcc_case_attorneys").insert({
      id: caseAttorneyId,
      case_id: caseId,
      party_id: partyRecord.party_id,
      attorney_id: attorneyId,
      motivo_cambio: "inicial",
      poder_url: poderUrl,
      registrado_por: (session.user as any).id,
      activo: true,
      created_at: now,
      updated_at: now,
    });
  }

  // Crear evento de timeline
  await supabaseAdmin.from("sgcc_case_timeline").insert({
    id: randomUUID(),
    case_id: caseId,
    etapa: "solicitud",
    descripcion: `Solicitud radicada por ${(session.user as any).name ?? "staff"}`,
    completado: true,
    fecha: new Date().toISOString(),
    created_at: new Date().toISOString(),
  });

  // Notificar al staff del centro
  const { data: admins } = await supabaseAdmin
    .from("sgcc_staff")
    .select("id, email")
    .eq("center_id", centerId)
    .in("rol", ["admin", "secretario"]);

  if (admins?.length) {
    await notify({
      centerId,
      caseId,
      tipo: "nueva_solicitud",
      titulo: `Nueva solicitud — ${numero_radicado}`,
      mensaje: `Se radicó una nueva solicitud de conciliación en materia ${materia}.\nRadicado: ${numero_radicado}`,
      recipients: admins.map((a) => ({ staffId: a.id, email: a.email })),
      canal: "both",
    });
  }

  return NextResponse.json({ caso }, { status: 201 });
}
