import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";

type Etapa = "solicitud" | "admision" | "citacion" | "audiencia" | "acta" | "archivo";

const ETAPA_TO_CASE_FIELD: Record<Etapa, string | null> = {
  solicitud: "fecha_solicitud",
  admision: "fecha_admision",
  citacion: "fecha_limite_citacion",
  audiencia: "fecha_audiencia",
  acta: null,
  archivo: "fecha_cierre",
};

/**
 * PATCH /api/casos/[id]/fechas
 * Body: { etapa: Etapa, fecha: string ISO }
 * Actualiza la fecha de una etapa del flujo en sgcc_cases y en sgcc_case_timeline.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: caseId } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const body = await req.json();
  const etapa = body.etapa as Etapa;
  const fecha = body.fecha as string | null;

  if (!etapa || !(etapa in ETAPA_TO_CASE_FIELD)) {
    return NextResponse.json({ error: "Etapa inválida" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const fechaIso = fecha ? new Date(fecha).toISOString() : null;

  const caseField = ETAPA_TO_CASE_FIELD[etapa];
  if (caseField) {
    const { error } = await supabaseAdmin
      .from("sgcc_cases")
      .update({ [caseField]: fechaIso, updated_at: now })
      .eq("id", caseId)
      .eq("center_id", centerId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: existing } = await supabaseAdmin
    .from("sgcc_case_timeline")
    .select("id")
    .eq("case_id", caseId)
    .eq("etapa", etapa)
    .limit(1)
    .maybeSingle();

  if (existing) {
    await supabaseAdmin
      .from("sgcc_case_timeline")
      .update({ fecha: fechaIso })
      .eq("id", existing.id);
  } else {
    await supabaseAdmin.from("sgcc_case_timeline").insert({
      case_id: caseId,
      etapa,
      descripcion: `Fecha de ${etapa} actualizada manualmente`,
      completado: false,
      fecha: fechaIso,
      created_at: now,
    });
  }

  return NextResponse.json({ ok: true });
}
