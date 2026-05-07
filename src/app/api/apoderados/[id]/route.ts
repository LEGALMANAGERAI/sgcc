import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";

/**
 * DELETE /api/apoderados/[id]
 *
 * Desvincula el apoderado del centro: marca `activo = false` en TODAS
 * las `sgcc_case_attorneys` del attorney que correspondan a casos del
 * centro actual. NO borra el `sgcc_attorneys` (la persona) ni el
 * historial — solo lo quita de la lista activa de /apoderados.
 *
 * Si después se vuelve a vincular a un caso nuevo, vuelve a aparecer.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro asignado" }, { status: 400 });

  const { id: attorneyId } = await params;

  // Obtener case_ids del centro donde el apoderado tiene vinculación activa.
  const { data: vinculaciones } = await supabaseAdmin
    .from("sgcc_case_attorneys")
    .select(`id, caso:sgcc_cases!inner(center_id)`)
    .eq("attorney_id", attorneyId)
    .eq("activo", true);

  const idsParaDesactivar = (vinculaciones ?? [])
    .filter((v: any) => v.caso?.center_id === centerId)
    .map((v: any) => v.id);

  if (idsParaDesactivar.length === 0) {
    return NextResponse.json({ error: "El apoderado no tiene vinculaciones activas en este centro" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("sgcc_case_attorneys")
    .update({ activo: false })
    .in("id", idsParaDesactivar);

  if (error) {
    console.error("[DELETE /api/apoderados/[id]] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, desactivadas: idsParaDesactivar.length });
}
