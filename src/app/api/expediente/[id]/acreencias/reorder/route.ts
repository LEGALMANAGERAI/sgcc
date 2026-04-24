import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/expediente/[id]/acreencias/reorder
 * Persiste el orden manual de las acreencias (drag & drop).
 * Body: { order: string[] } — arreglo de acreencia_id en el orden deseado.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id: caseId } = await params;
  const { order } = await req.json();

  if (!Array.isArray(order) || order.some((x) => typeof x !== "string")) {
    return NextResponse.json({ error: "order debe ser un arreglo de IDs" }, { status: 400 });
  }

  // Validar que todos los IDs pertenecen a este caso + centro
  const { data: existentes } = await supabaseAdmin
    .from("sgcc_acreencias")
    .select("id")
    .eq("case_id", caseId)
    .eq("center_id", centerId)
    .in("id", order);

  const idsValidos = new Set((existentes ?? []).map((r) => r.id));
  const idsPedidos = order.filter((id) => idsValidos.has(id));

  // Aplicar el nuevo orden (1..N)
  const now = new Date().toISOString();
  for (let i = 0; i < idsPedidos.length; i++) {
    const { error } = await supabaseAdmin
      .from("sgcc_acreencias")
      .update({ display_order: i + 1, updated_at: now })
      .eq("id", idsPedidos[i])
      .eq("case_id", caseId)
      .eq("center_id", centerId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Devolver lista actualizada
  const { data: all } = await supabaseAdmin
    .from("sgcc_acreencias")
    .select("*")
    .eq("case_id", caseId)
    .eq("center_id", centerId)
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  return NextResponse.json(all ?? []);
}
