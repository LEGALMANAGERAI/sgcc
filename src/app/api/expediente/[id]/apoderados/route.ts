import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { randomUUID } from "crypto";

/**
 * GET /api/expediente/[id]/apoderados
 * Listar todos los apoderados del caso (activos e inactivos) con joins.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: caseId } = await params;
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("sgcc_case_attorneys")
    .select(
      "*, attorney:sgcc_attorneys(*), party:sgcc_parties(nombres, apellidos, razon_social)"
    )
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * POST /api/expediente/[id]/apoderados
 * Registrar nuevo apoderado para una parte del caso.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: caseId } = await params;
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Solo staff
  if ((session.user as any).userType !== "staff") {
    return NextResponse.json(
      { error: "Solo el personal del centro puede registrar apoderados" },
      { status: 403 }
    );
  }

  const centerId = resolveCenterId(session);
  if (!centerId) {
    return NextResponse.json({ error: "Sin centro asignado" }, { status: 400 });
  }

  // Verificar que el caso existe y pertenece al centro
  const { data: caso } = await supabaseAdmin
    .from("sgcc_cases")
    .select("id, center_id")
    .eq("id", caseId)
    .eq("center_id", centerId)
    .single();

  if (!caso) {
    return NextResponse.json({ error: "Caso no encontrado" }, { status: 404 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  let body: any;
  let poderFile: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    body = JSON.parse(formData.get("data") as string);
    poderFile = formData.get("poderFile") as File | null;
  } else {
    body = await req.json();
  }

  const { party_id, attorney, motivo_cambio, poder_vigente_desde, poder_vigente_hasta } = body;

  if (!party_id) {
    return NextResponse.json({ error: "party_id es requerido" }, { status: 400 });
  }
  if (!attorney || !attorney.numero_doc || !attorney.nombre) {
    return NextResponse.json(
      { error: "Datos del apoderado incompletos (nombre y numero_doc requeridos)" },
      { status: 400 }
    );
  }

  // Verificar que party_id es parte del caso
  const { data: caseParty } = await supabaseAdmin
    .from("sgcc_case_parties")
    .select("id")
    .eq("case_id", caseId)
    .eq("party_id", party_id)
    .single();

  if (!caseParty) {
    return NextResponse.json(
      { error: "La parte indicada no pertenece a este caso" },
      { status: 400 }
    );
  }

  const userId = (session.user as any).id;
  const now = new Date().toISOString();

  // Buscar si el attorney ya existe por numero_doc
  let attorneyId: string;

  const { data: existingAttorney } = await supabaseAdmin
    .from("sgcc_attorneys")
    .select("id")
    .eq("numero_doc", attorney.numero_doc)
    .single();

  if (existingAttorney) {
    attorneyId = existingAttorney.id;

    // Actualizar datos del apoderado existente
    await supabaseAdmin
      .from("sgcc_attorneys")
      .update({
        nombre: attorney.nombre,
        tipo_doc: attorney.tipo_doc ?? null,
        tarjeta_profesional: attorney.tarjeta_profesional ?? null,
        email: attorney.email ?? null,
        telefono: attorney.telefono ?? null,
        updated_at: now,
      })
      .eq("id", attorneyId);
  } else {
    // Crear nuevo attorney
    attorneyId = randomUUID();
    const { error: attError } = await supabaseAdmin
      .from("sgcc_attorneys")
      .insert({
        id: attorneyId,
        nombre: attorney.nombre,
        tipo_doc: attorney.tipo_doc ?? "CC",
        numero_doc: attorney.numero_doc,
        tarjeta_profesional: attorney.tarjeta_profesional ?? null,
        email: attorney.email ?? null,
        telefono: attorney.telefono ?? null,
        created_at: now,
        updated_at: now,
      });

    if (attError) {
      return NextResponse.json(
        { error: `Error creando apoderado: ${attError.message}` },
        { status: 500 }
      );
    }
  }

  // Desactivar apoderado anterior de la misma parte en este caso
  await supabaseAdmin
    .from("sgcc_case_attorneys")
    .update({ activo: false, updated_at: now })
    .eq("case_id", caseId)
    .eq("party_id", party_id)
    .eq("activo", true);

  // Insertar nuevo sgcc_case_attorneys
  const caseAttorneyId = randomUUID();

  const { data: created, error: insertError } = await supabaseAdmin
    .from("sgcc_case_attorneys")
    .insert({
      id: caseAttorneyId,
      case_id: caseId,
      party_id,
      attorney_id: attorneyId,
      motivo_cambio: motivo_cambio ?? null,
      poder_vigente_desde: poder_vigente_desde ?? null,
      poder_vigente_hasta: poder_vigente_hasta ?? null,
      registrado_por: userId,
      activo: true,
      created_at: now,
      updated_at: now,
    })
    .select(
      "*, attorney:sgcc_attorneys(*), party:sgcc_parties(nombres, apellidos, razon_social)"
    )
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Upload poder si viene archivo
  if (poderFile) {
    const buffer = Buffer.from(await poderFile.arrayBuffer());
    const filePath = `${caseId}/${caseAttorneyId}.pdf`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("poderes")
      .upload(filePath, buffer, { contentType: "application/pdf", upsert: true });

    if (!uploadError) {
      const { data: urlData } = supabaseAdmin.storage.from("poderes").getPublicUrl(filePath);
      await supabaseAdmin
        .from("sgcc_case_attorneys")
        .update({ poder_url: urlData.publicUrl })
        .eq("id", caseAttorneyId);
    }
  }

  return NextResponse.json(created, { status: 201 });
}
