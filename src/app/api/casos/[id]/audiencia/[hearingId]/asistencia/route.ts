import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";

interface AsistenciaItem {
  party_id: string;
  attorney_id?: string | null;
  asistio: boolean;
  representado_por_nombre?: string | null;
  poder_verificado?: boolean;
  notas?: string | null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; hearingId: string }> }
) {
  const { id: caseId, hearingId } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { data: caso } = await supabaseAdmin
    .from("sgcc_cases")
    .select("id")
    .eq("id", caseId)
    .eq("center_id", centerId)
    .maybeSingle();

  if (!caso) return NextResponse.json({ error: "Caso no encontrado" }, { status: 404 });

  const { data: audiencia } = await supabaseAdmin
    .from("sgcc_hearings")
    .select("id")
    .eq("id", hearingId)
    .eq("case_id", caseId)
    .maybeSingle();

  if (!audiencia) {
    return NextResponse.json({ error: "Audiencia no pertenece al caso" }, { status: 404 });
  }

  const body = await req.json();
  const items: AsistenciaItem[] = body.asistencia;

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "asistencia vacía" }, { status: 400 });
  }

  const staffId = (session.user as any).id;

  const rows = items.map((it) => ({
    hearing_id: hearingId,
    party_id: it.party_id,
    attorney_id: it.attorney_id ?? null,
    asistio: it.asistio,
    representado_por_nombre: it.representado_por_nombre ?? null,
    poder_verificado: it.poder_verificado ?? false,
    notas: it.notas ?? null,
    registrado_por_staff: staffId,
  }));

  const { data, error } = await supabaseAdmin
    .from("sgcc_hearing_attendance")
    .upsert(rows, { onConflict: "hearing_id,party_id" })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Reflejar en sgcc_case_parties.asistio (compatibilidad con flujo actual)
  for (const it of items) {
    await supabaseAdmin
      .from("sgcc_case_parties")
      .update({ asistio: it.asistio })
      .eq("case_id", caseId)
      .eq("party_id", it.party_id);
  }

  return NextResponse.json({ asistencia: data });
}
