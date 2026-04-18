import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; hearingId: string }> }
) {
  const { id: caseId, hearingId } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { data: caso, error: casoError } = await supabaseAdmin
    .from("sgcc_cases")
    .select(`
      id,
      numero_radicado,
      tipo_tramite,
      materia,
      cuantia,
      cuantia_indeterminada,
      descripcion,
      estado,
      sub_estado,
      fecha_solicitud,
      fecha_admision,
      fecha_limite_citacion,
      conciliador_id,
      conciliador:sgcc_staff!sgcc_cases_conciliador_id_fkey(id, nombre, tarjeta_profesional, email),
      centro:sgcc_centers!sgcc_cases_center_id_fkey(id, nombre, ciudad, codigo_corto),
      partes:sgcc_case_parties(
        id, rol,
        party:sgcc_parties(
          id, tipo_persona, nombres, apellidos, razon_social,
          tipo_doc, numero_doc, nit_empresa, email, telefono
        )
      )
    `)
    .eq("id", caseId)
    .eq("center_id", centerId)
    .single();

  if (casoError || !caso) {
    return NextResponse.json({ error: "Caso no encontrado" }, { status: 404 });
  }

  const { data: audiencia, error: audError } = await supabaseAdmin
    .from("sgcc_hearings")
    .select(`
      id,
      fecha_hora,
      duracion_min,
      estado,
      tipo,
      notas_previas,
      conciliador_id,
      sala:sgcc_rooms(id, nombre, tipo, link_virtual)
    `)
    .eq("id", hearingId)
    .eq("case_id", caseId)
    .single();

  if (audError || !audiencia) {
    return NextResponse.json({ error: "Audiencia no encontrada" }, { status: 404 });
  }

  const fechaRef = (audiencia.fecha_hora as string).split("T")[0];

  const { data: apoderadosVigentes } = await supabaseAdmin
    .from("sgcc_case_attorneys")
    .select(`
      id,
      party_id,
      attorney_id,
      poder_url,
      poder_vigente_desde,
      poder_vigente_hasta,
      motivo_cambio,
      activo,
      created_at,
      attorney:sgcc_attorneys(
        id, nombre, tipo_doc, numero_doc, tarjeta_profesional, email, verificado
      )
    `)
    .eq("case_id", caseId)
    .eq("activo", true)
    .or(`poder_vigente_desde.is.null,poder_vigente_desde.lte.${fechaRef}`)
    .or(`poder_vigente_hasta.is.null,poder_vigente_hasta.gte.${fechaRef}`);

  const { data: asistencia } = await supabaseAdmin
    .from("sgcc_hearing_attendance")
    .select(`
      id,
      party_id,
      attorney_id,
      asistio,
      representado_por_nombre,
      poder_verificado,
      notas
    `)
    .eq("hearing_id", hearingId);

  const { data: ultimaActa } = await supabaseAdmin
    .from("sgcc_actas")
    .select(`
      id, numero_acta, tipo, consideraciones, acuerdo_texto, obligaciones,
      fecha_acta, estado_firma, created_at
    `)
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: historialApoderados } = await supabaseAdmin
    .from("sgcc_case_attorneys")
    .select(`
      id, party_id, motivo_cambio, activo, poder_vigente_desde, poder_vigente_hasta, created_at,
      attorney:sgcc_attorneys(id, nombre, numero_doc, tarjeta_profesional)
    `)
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });

  return NextResponse.json({
    caso,
    audiencia,
    apoderadosVigentes: apoderadosVigentes ?? [],
    asistencia: asistencia ?? [],
    ultimaActa: ultimaActa ?? null,
    historialApoderados: historialApoderados ?? [],
  });
}
