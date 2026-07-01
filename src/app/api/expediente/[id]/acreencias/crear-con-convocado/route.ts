import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { randomUUID } from "crypto";
import {
  isTempPoderPath,
  movePoderToFinal,
  verifyPoderIsPdf,
  deletePoder,
} from "@/lib/poderes-storage";
import { findOrCreateParty } from "@/lib/parties";
import { recalcularPorcentajesAcreencias } from "@/lib/acreencias/recalcular-porcentajes";

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

  // Solo JSON. El PDF del poder se sube aparte via signed URL al bucket
  // privado y aqui llega como `tmp_poder_path`.
  const body = await req.json();
  const { acreedor, apoderado, acreencia_id, tmp_poder_path } = body ?? {};
  // Bandera para saltar la advertencia anti-cruce (el usuario ya confirmó desde la UI).
  const confirmarCambio = body?.confirmar_cambio_acreedor === true;
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

  // 1. Buscar party por documento (no por email — ver lib/parties.ts) o crear
  let partyId: string;
  try {
    const result = await findOrCreateParty({
      tipo_persona: tipoPersona,
      nombres: tipoPersona === "natural" ? acreedor.nombres ?? acreedor.nombre ?? null : null,
      apellidos: tipoPersona === "natural" ? acreedor.apellidos ?? null : null,
      razon_social: tipoPersona === "juridica" ? acreedor.razon_social ?? acreedor.nombre ?? null : null,
      tipo_doc: acreedor.tipo_doc ?? null,
      numero_doc: acreedor.numero_doc ?? null,
      email: acreedor.email.trim(),
      telefono: acreedor.telefono ?? null,
      direccion: acreedor.direccion ?? null,
      ciudad: acreedor.ciudad ?? null,
    });
    partyId = result.partyId;
  } catch (e: any) {
    return NextResponse.json({ error: `Error creando parte: ${e?.message ?? "desconocido"}` }, { status: 500 });
  }

  const documentoAcreencia = acreedor.numero_doc?.trim() || null;

  // Guard anti-cruce: evita que editar/crear un acreedor lo vincule por error a la
  // parte de OTRO acreedor (bug "se escribe en una y en otra"). Se dispara si:
  //  (a) la parte resuelta ya pertenece a otra acreencia del caso con NOMBRE distinto, o
  //  (b) es una edición que CAMBIA el documento de la acreencia.
  // En ambos casos se pide confirmación explícita desde la UI (confirmar_cambio_acreedor).
  if (!confirmarCambio) {
    const normNombre = (s: string | null | undefined) =>
      (s ?? "").replace(/\s+/g, " ").trim().toUpperCase();
    const normDoc2 = (d: string | null | undefined) =>
      (d ?? "").replace(/[\s.\-_]/g, "").toUpperCase();

    const { data: otras } = await supabaseAdmin
      .from("sgcc_acreencias")
      .select("id, acreedor_nombre")
      .eq("case_id", caseId)
      .eq("party_id", partyId)
      .is("deleted_at", null);
    const conflicto = (otras ?? []).find(
      (o) => o.id !== acreencia_id && normNombre(o.acreedor_nombre) !== normNombre(nombreVisible),
    );

    let cambioDoc: { antes: string; despues: string | null } | null = null;
    if (acreencia_id) {
      const { data: prev } = await supabaseAdmin
        .from("sgcc_acreencias")
        .select("acreedor_documento")
        .eq("id", acreencia_id)
        .maybeSingle();
      if (
        prev?.acreedor_documento &&
        normDoc2(prev.acreedor_documento) !== normDoc2(documentoAcreencia)
      ) {
        cambioDoc = { antes: prev.acreedor_documento, despues: documentoAcreencia };
      }
    }

    if (conflicto || cambioDoc) {
      return NextResponse.json(
        {
          requiereConfirmacion: true,
          error: conflicto
            ? `Ese documento ya pertenece a otro acreedor del caso: "${conflicto.acreedor_nombre}". Si continúas, ambos quedarán vinculados a la misma parte y editar uno afectará al otro. Verifica el documento del acreedor.`
            : `Vas a cambiar el documento del acreedor de ${cambioDoc!.antes} a ${cambioDoc!.despues ?? "(vacío)"}. Confirma solo si es una corrección del mismo acreedor.`,
        },
        { status: 409 },
      );
    }
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

    // Mover poder desde tmp/ al path final si el frontend ya lo subio
    if (tmp_poder_path && isTempPoderPath(tmp_poder_path)) {
      const isPdf = await verifyPoderIsPdf(tmp_poder_path);
      if (!isPdf) {
        await deletePoder(tmp_poder_path);
      } else {
        const moveResult = await movePoderToFinal(tmp_poder_path, caseId, caseAttorneyId);
        if ("error" in moveResult) {
          await deletePoder(tmp_poder_path);
        } else {
          await supabaseAdmin
            .from("sgcc_case_attorneys")
            .update({ poder_url: moveResult.path })
            .eq("id", caseAttorneyId);
        }
      }
    }
  }

  // 5. Recalcular pequeños acreedores y % de voto para todo el caso.
  await recalcularPorcentajesAcreencias(caseId, centerId);

  // 6. Devolver la acreencia resultante (con party_id para que la UI la muestre consolidada)
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
