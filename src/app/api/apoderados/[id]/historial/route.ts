import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";

/**
 * GET /api/apoderados/[id]/historial
 * Historial completo de participación del apoderado en casos del centro.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id: attorneyId } = await params;

  const { data, error } = await supabaseAdmin
    .from("sgcc_case_attorneys")
    .select(`
      id,
      case_id,
      party_id,
      activo,
      motivo_cambio,
      poder_vigente_desde,
      poder_vigente_hasta,
      poder_url,
      created_at,
      caso:sgcc_cases!inner(numero_radicado, materia, estado, center_id),
      party:sgcc_parties(nombres, apellidos, razon_social)
    `)
    .eq("attorney_id", attorneyId)
    .eq("caso.center_id", centerId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}
