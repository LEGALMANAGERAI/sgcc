import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { randomUUID } from "crypto";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/expediente/[id]/acreencias/crear-con-convocado
 *
 * Crea en una sola operación:
 *  - sgcc_parties (acreedor)
 *  - sgcc_case_parties (rol convocado) → aparece en la sección "Partes" del expediente
 *  - sgcc_acreencias (con party_id vinculado)
 *  - sgcc_attorneys + sgcc_case_attorneys (opcional) + poder subido a storage "poderes"
 *
 * Soporta dos modos:
 *  - JSON: { acreedor, apoderado? }
 *  - multipart/form-data: { data: JSON string, poderFile?: File }
 *
 * Si se pasa `acreencia_id` en el body, en lugar de crear una acreencia nueva
 * se actualiza la existente con el party_id y se sincroniza nombre/documento
 * — se usa cuando el acreedor se creó "rápido" durante la audiencia y después
 * se completan sus datos.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if ((session.user as any).userType !== "staff") {
    return NextResponse.json({ error: "Solo el personal del centro puede crear acreedores" }, { status: 403 });
  }

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro asignado" }, { status: 400 });

  const { id: caseId } = await params;

  const { data: caso } = await supabaseAdmin
    .from("sgcc_cases")
    .select("id")
    .eq("id", caseId)
    .eq("center_id", centerId)
    .single();
  if (!caso) return NextResponse.json({ error: "Caso no encontrado" }, { status: 404 });

  const contentType = req.headers.get("content-type") ?? "";
  let body: any;
  let poderFile: File | null = null;
  if (contentType.includes("multipart/form-data")) {
    const fd = await req.formData();
    body = JSON.parse(fd.get("data") as string);
    poderFile = (fd.get("poderFile") as File | null) ?? null;
  } else {
    body = await req.json();
  }

  const { acreedor, apoderado, acreencia_id } = body ?? {};
  if (!acreedor) return NextResponse.json({ error: "Datos del acreedor requeridos" }, { status: 400 });

  const tipoPersona: "natural" | "juridica" = acreedor.tipo_persona === "juridica" ? "juridica" : "natural";
  const nombreVisible =
    tipoPersona === "juridica"
      ? (acreedor.razon_social ?? acreedor.nombre ?? "").trim()
      : [acreedor.nombres ?? acreedor.nombre, acreedor.apellidos].filter(Boolean).join(" ").trim();

  if (!nombreVisible) {
    return NextResponse.json({ error: "Nombre/razón social es obligatorio" }, { status: 400 });
  }
  if (!acreedor.email?.trim()) {
    return NextResponse.json({ error: "Email del acreedor es obligatorio" }, { status: 400 });
  }

  const now = new Date().toISOString();

  // 1. Crear o reutilizar party (buscar por email case-insensitive)
  let partyId: string;
  const { data: existingParty } = await supabaseAdmin
    .from("sgcc_parties")
    .select("id")
    .ilike("email", acreedor.email.trim())
    .maybeSingle();

  if (existingParty) {
    partyId = existingParty.id;
    await supabaseAdmin
      .from("sgcc_parties")
      .update({
        tipo_persona: tipoPersona,
        nombres: tipoPersona === "natural" ? acreedor.nombres ?? acreedor.nombre ?? null : null,
        apellidos: tipoPersona === "natural" ? acreedor.apellidos ?? null : null,
        razon_social: tipoPersona === "juridica" ? acreedor.razon_social ?? acreedor.nombre ?? null : null,
        tipo_doc: acreedor.tipo_doc ?? null,
        numero_doc: tipoPersona === "natural" ? acreedor.numero_doc ?? null : null,
        nit_empresa: tipoPersona === "juridica" ? acreedor.numero_doc ?? null : null,
        telefono: acreedor.telefono ?? null,
        direccion: acreedor.direccion ?? null,
        ciudad: acreedor.ciudad ?? null,
        updated_at: now,
      })
      .eq("id", partyId);
  } else {
    partyId = randomUUID();
    const { error: partyErr } = await supabaseAdmin.from("sgcc_parties").insert({
      id: partyId,
      tipo_persona: tipoPersona,
      nombres: tipoPersona === "natural" ? acreedor.nombres ?? acreedor.nombre ?? null : null,
      apellidos: tipoPersona === "natural" ? acreedor.apellidos ?? null : null,
      razon_social: tipoPersona === "juridica" ? acreedor.razon_social ?? acreedor.nombre ?? null : null,
      tipo_doc: acreedor.tipo_doc ?? null,
      numero_doc: tipoPersona === "natural" ? acreedor.numero_doc ?? null : null,
      nit_empresa: tipoPersona === "juridica" ? acreedor.numero_doc ?? null : null,
      email: acreedor.email.trim(),
      telefono: acreedor.telefono ?? null,
      direccion: acreedor.direccion ?? null,
      ciudad: acreedor.ciudad ?? null,
      created_at: now,
      updated_at: now,
    });
    if (partyErr) return NextResponse.json({ error: `Error creando parte: ${partyErr.message}` }, { status: 500 });
  }

  // 2. case_party con rol "convocado" (si no existe ya)
  const { data: existingCaseParty } = await supabaseAdmin
    .from("sgcc_case_parties")
    .select("id")
    .eq("case_id", caseId)
    .eq("party_id", partyId)
    .maybeSingle();

  if (!existingCaseParty) {
    const { error: cpErr } = await supabaseAdmin.from("sgcc_case_parties").insert({
      id: randomUUID(),
      case_id: caseId,
      party_id: partyId,
      rol: "convocado",
      created_at: now,
    });
    if (cpErr) return NextResponse.json({ error: `Error vinculando parte al caso: ${cpErr.message}` }, { status: 500 });
  }

  // 3. Acreencia: crear o actualizar existente
  const documentoAcreencia = acreedor.numero_doc?.trim() || null;
  let acreenciaId: string;
  if (acreencia_id) {
    // Actualizar acreencia existente (caso "completar después")
    const { error: updErr } = await supabaseAdmin
      .from("sgcc_acreencias")
      .update({
        party_id: partyId,
        acreedor_tipo: tipoPersona,
        acreedor_nombre: nombreVisible,
        acreedor_documento: documentoAcreencia,
        updated_at: now,
      })
      .eq("id", acreencia_id)
      .eq("case_id", caseId)
      .eq("center_id", centerId);
    if (updErr) return NextResponse.json({ error: `Error actualizando acreencia: ${updErr.message}` }, { status: 500 });
    acreenciaId = acreencia_id;
  } else {
    acreenciaId = randomUUID();
    // Calcular siguiente display_order
    const { data: maxRow } = await supabaseAdmin
      .from("sgcc_acreencias")
      .select("display_order")
      .eq("case_id", caseId)
      .eq("center_id", centerId)
      .order("display_order", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = (maxRow?.display_order ?? 0) + 1;
    const { error: acrErr } = await supabaseAdmin.from("sgcc_acreencias").insert({
      id: acreenciaId,
      case_id: caseId,
      center_id: centerId,
      party_id: partyId,
      acreedor_tipo: tipoPersona,
      acreedor_nombre: nombreVisible,
      acreedor_documento: documentoAcreencia,
      display_order: nextOrder,
      clase_credito: "quinta",
      dias_mora: 0,
      mora_90_dias: false,
      created_at: now,
      updated_at: now,
    });
    if (acrErr) return NextResponse.json({ error: `Error creando acreencia: ${acrErr.message}` }, { status: 500 });
  }

  // 4. Apoderado opcional (usa la misma lógica del endpoint /apoderados)
  let caseAttorneyId: string | null = null;
  if (apoderado && apoderado.nombre && apoderado.numero_doc) {
    let attorneyId: string;
    const { data: existingAtt } = await supabaseAdmin
      .from("sgcc_attorneys")
      .select("id")
      .eq("numero_doc", apoderado.numero_doc)
      .maybeSingle();

    if (existingAtt) {
      attorneyId = existingAtt.id;
      await supabaseAdmin
        .from("sgcc_attorneys")
        .update({
          nombre: apoderado.nombre,
          tipo_doc: apoderado.tipo_doc ?? null,
          tarjeta_profesional: apoderado.tarjeta_profesional ?? null,
          email: apoderado.email ?? null,
          telefono: apoderado.telefono ?? null,
          updated_at: now,
        })
        .eq("id", attorneyId);
    } else {
      attorneyId = randomUUID();
      const { error: attErr } = await supabaseAdmin.from("sgcc_attorneys").insert({
        id: attorneyId,
        nombre: apoderado.nombre,
        tipo_doc: apoderado.tipo_doc ?? "CC",
        numero_doc: apoderado.numero_doc,
        tarjeta_profesional: apoderado.tarjeta_profesional ?? null,
        email: apoderado.email ?? null,
        telefono: apoderado.telefono ?? null,
        created_at: now,
        updated_at: now,
      });
      if (attErr) return NextResponse.json({ error: `Error creando apoderado: ${attErr.message}` }, { status: 500 });
    }

    // Desactivar apoderado anterior activo de este party en este caso
    await supabaseAdmin
      .from("sgcc_case_attorneys")
      .update({ activo: false, updated_at: now })
      .eq("case_id", caseId)
      .eq("party_id", partyId)
      .eq("activo", true);

    caseAttorneyId = randomUUID();
    const userId = (session.user as any).id;
    const { error: caErr } = await supabaseAdmin.from("sgcc_case_attorneys").insert({
      id: caseAttorneyId,
      case_id: caseId,
      party_id: partyId,
      attorney_id: attorneyId,
      motivo_cambio: apoderado.motivo_cambio ?? "inicial",
      poder_vigente_desde: apoderado.poder_vigente_desde ?? null,
      poder_vigente_hasta: apoderado.poder_vigente_hasta ?? null,
      registrado_por: userId,
      activo: true,
      created_at: now,
      updated_at: now,
    });
    if (caErr) return NextResponse.json({ error: `Error registrando apoderado del caso: ${caErr.message}` }, { status: 500 });

    // Subir PDF del poder si vino archivo
    if (poderFile) {
      const buffer = Buffer.from(await poderFile.arrayBuffer());
      const filePath = `${caseId}/${caseAttorneyId}.pdf`;
      const { error: upErr } = await supabaseAdmin.storage
        .from("poderes")
        .upload(filePath, buffer, { contentType: "application/pdf", upsert: true });
      if (!upErr) {
        const { data: urlData } = supabaseAdmin.storage.from("poderes").getPublicUrl(filePath);
        await supabaseAdmin
          .from("sgcc_case_attorneys")
          .update({ poder_url: urlData.publicUrl })
          .eq("id", caseAttorneyId);
      }
    }
  }

  // 5. Devolver la acreencia resultante (con party_id para que la UI la muestre consolidada)
  const { data: acreenciaRes } = await supabaseAdmin
    .from("sgcc_acreencias")
    .select("*")
    .eq("id", acreenciaId)
    .single();

  return NextResponse.json(
    { ok: true, acreencia: acreenciaRes, party_id: partyId, case_attorney_id: caseAttorneyId },
    { status: acreencia_id ? 200 : 201 },
  );
}
