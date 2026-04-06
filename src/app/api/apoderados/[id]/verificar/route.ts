import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: attorneyId } = await params;
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const user = session.user as any;
  const centerId = resolveCenterId(session);
  if (!centerId) {
    return NextResponse.json({ error: "Sin centro" }, { status: 400 });
  }

  // Solo admin o conciliador pueden verificar apoderados
  if (!["admin", "conciliador"].includes(user.sgccRol)) {
    return NextResponse.json(
      { error: "Solo administradores y conciliadores pueden verificar apoderados" },
      { status: 403 }
    );
  }

  // Verificar que el apoderado existe y está vinculado a un caso del centro
  const { data: caseAttorney } = await supabaseAdmin
    .from("sgcc_case_attorneys")
    .select("attorney_id, case:sgcc_cases!inner(center_id)")
    .eq("attorney_id", attorneyId)
    .eq("case.center_id", centerId)
    .limit(1)
    .single();

  if (!caseAttorney) {
    return NextResponse.json(
      { error: "Apoderado no encontrado en casos de este centro" },
      { status: 404 }
    );
  }

  const body = await req.json();
  const verificado = body.verificado === true;

  const now = new Date().toISOString();

  const { data: updated, error } = await supabaseAdmin
    .from("sgcc_attorneys")
    .update({
      verificado,
      verificado_por: user.id,
      verificado_at: verificado ? now : null,
      updated_at: now,
    })
    .eq("id", attorneyId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ attorney: updated });
}
