import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { randomUUID } from "crypto";

/**
 * GET /api/expediente/[id]/asistencia
 * Listar asistencia de todas las audiencias del caso.
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

  // Obtener IDs de audiencias del caso
  const { data: hearings, error: hearingsError } = await supabaseAdmin
    .from("sgcc_hearings")
    .select("id")
    .eq("case_id", caseId);

  if (hearingsError) {
    return NextResponse.json({ error: hearingsError.message }, { status: 500 });
  }

  if (!hearings || hearings.length === 0) {
    return NextResponse.json([]);
  }

  const hearingIds = hearings.map((h) => h.id);

  const { data, error } = await supabaseAdmin
    .from("sgcc_hearing_attendance")
    .select(
      "*, party:sgcc_parties(nombres, apellidos, razon_social), attorney:sgcc_attorneys(nombre, tarjeta_profesional)"
    )
    .in("hearing_id", hearingIds)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * POST /api/expediente/[id]/asistencia
 * Registrar asistencia de una audiencia.
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

  const centerId = resolveCenterId(session);
  if (!centerId) {
    return NextResponse.json({ error: "Sin centro asignado" }, { status: 400 });
  }

  const body = await req.json();
  const {
    hearing_id,
    party_id,
    attorney_id,
    asistio,
    representado_por_nombre,
    poder_verificado,
    notas,
  } = body;

  if (!hearing_id) {
    return NextResponse.json({ error: "hearing_id es requerido" }, { status: 400 });
  }

  // Verificar que la audiencia pertenece al caso
  const { data: hearing } = await supabaseAdmin
    .from("sgcc_hearings")
    .select("id, case_id")
    .eq("id", hearing_id)
    .eq("case_id", caseId)
    .single();

  if (!hearing) {
    return NextResponse.json(
      { error: "La audiencia no pertenece a este caso" },
      { status: 404 }
    );
  }

  const userId = (session.user as any).id;
  const now = new Date().toISOString();

  // Bootstrap: si no viene party_id, crear registros iniciales para todas las partes
  if (!party_id) {
    const { data: partes, error: partesError } = await supabaseAdmin
      .from("sgcc_case_parties")
      .select("party_id")
      .eq("case_id", caseId);

    if (partesError) {
      return NextResponse.json({ error: partesError.message }, { status: 500 });
    }
    if (!partes || partes.length === 0) {
      return NextResponse.json(
        { error: "El caso no tiene partes registradas" },
        { status: 400 }
      );
    }

    // Apoderados vigentes para pre-llenar attorney_id
    const { data: apoderados } = await supabaseAdmin
      .from("sgcc_case_attorneys")
      .select("party_id, attorney_id, attorney:sgcc_attorneys(nombre, verificado)")
      .eq("case_id", caseId)
      .eq("activo", true);

    const apoderadoPorParte = new Map<string, any>();
    for (const a of apoderados ?? []) apoderadoPorParte.set(a.party_id, a);

    const rows = partes.map((cp) => {
      const ap = apoderadoPorParte.get(cp.party_id);
      return {
        hearing_id,
        party_id: cp.party_id,
        attorney_id: ap?.attorney_id ?? null,
        asistio: false,
        representado_por_nombre: ap?.attorney?.nombre ?? null,
        poder_verificado: ap?.attorney?.verificado ?? false,
        notas: null,
        registrado_por_staff: userId,
      };
    });

    const { data: creados, error: upsertError } = await supabaseAdmin
      .from("sgcc_hearing_attendance")
      .upsert(rows, { onConflict: "hearing_id,party_id" })
      .select(
        "*, party:sgcc_parties(nombres, apellidos, razon_social), attorney:sgcc_attorneys(nombre, tarjeta_profesional)"
      );

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ attendance: creados }, { status: 201 });
  }

  // Upsert: buscar registro existente por hearing_id + party_id
  const { data: existing } = await supabaseAdmin
    .from("sgcc_hearing_attendance")
    .select("id")
    .eq("hearing_id", hearing_id)
    .eq("party_id", party_id)
    .single();

  const attendanceData: Record<string, any> = {
    hearing_id,
    party_id,
    attorney_id: attorney_id ?? null,
    asistio: asistio ?? false,
    representado_por_nombre: representado_por_nombre ?? null,
    poder_verificado: poder_verificado ?? false,
    notas: notas ?? null,
    registrado_por_staff: userId,
    updated_at: now,
  };

  let result;
  let error;

  if (existing) {
    const { data, error: updateError } = await supabaseAdmin
      .from("sgcc_hearing_attendance")
      .update(attendanceData)
      .eq("id", existing.id)
      .select(
        "*, party:sgcc_parties(nombres, apellidos, razon_social), attorney:sgcc_attorneys(nombre, tarjeta_profesional)"
      )
      .single();
    result = data;
    error = updateError;
  } else {
    attendanceData.id = randomUUID();
    attendanceData.created_at = now;
    const { data, error: insertError } = await supabaseAdmin
      .from("sgcc_hearing_attendance")
      .insert(attendanceData)
      .select(
        "*, party:sgcc_parties(nombres, apellidos, razon_social), attorney:sgcc_attorneys(nombre, tarjeta_profesional)"
      )
      .single();
    result = data;
    error = insertError;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(result, { status: existing ? 200 : 201 });
}

/**
 * PATCH /api/expediente/[id]/asistencia
 * Actualizar asistencia existente.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: caseId } = await params;
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const centerId = resolveCenterId(session);
  if (!centerId) {
    return NextResponse.json({ error: "Sin centro asignado" }, { status: 400 });
  }

  const body = await req.json();
  const {
    hearing_id,
    party_id,
    attorney_id,
    asistio,
    representado_por_nombre,
    poder_verificado,
    notas,
  } = body;

  if (!hearing_id || !party_id) {
    return NextResponse.json(
      { error: "hearing_id y party_id son requeridos" },
      { status: 400 }
    );
  }

  // Verificar que la audiencia pertenece al caso
  const { data: hearing } = await supabaseAdmin
    .from("sgcc_hearings")
    .select("id, case_id")
    .eq("id", hearing_id)
    .eq("case_id", caseId)
    .single();

  if (!hearing) {
    return NextResponse.json(
      { error: "La audiencia no pertenece a este caso" },
      { status: 404 }
    );
  }

  // Buscar registro existente
  const { data: existing } = await supabaseAdmin
    .from("sgcc_hearing_attendance")
    .select("id")
    .eq("hearing_id", hearing_id)
    .eq("party_id", party_id)
    .single();

  if (!existing) {
    return NextResponse.json(
      { error: "No se encontró registro de asistencia para actualizar" },
      { status: 404 }
    );
  }

  const userId = (session.user as any).id;
  const now = new Date().toISOString();

  const updateData: Record<string, any> = {
    registrado_por_staff: userId,
    updated_at: now,
  };

  if (attorney_id !== undefined) updateData.attorney_id = attorney_id;
  if (asistio !== undefined) updateData.asistio = asistio;
  if (representado_por_nombre !== undefined)
    updateData.representado_por_nombre = representado_por_nombre;
  if (poder_verificado !== undefined) updateData.poder_verificado = poder_verificado;
  if (notas !== undefined) updateData.notas = notas;

  const { data: updated, error } = await supabaseAdmin
    .from("sgcc_hearing_attendance")
    .update(updateData)
    .eq("id", existing.id)
    .select(
      "*, party:sgcc_parties(nombres, apellidos, razon_social), attorney:sgcc_attorneys(nombre, tarjeta_profesional)"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(updated);
}
