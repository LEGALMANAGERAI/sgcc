import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";

/**
 * POST /api/facturacion/cancelar
 *
 * Cancela la suscripción del centro. El acceso se mantiene hasta
 * sgcc_centers.plan_expires_at (no se borra). No reembolsamos prorrateo.
 *
 * Body: { suscripcionId: string }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { suscripcionId?: string };
  if (!body.suscripcionId) {
    return NextResponse.json({ error: "suscripcionId requerido" }, { status: 400 });
  }

  // Validar ownership: la suscripción debe pertenecer al centro de la sesión.
  const { data: sus } = await supabaseAdmin
    .from("sgcc_suscripciones")
    .select("id, center_id, estado")
    .eq("id", body.suscripcionId)
    .maybeSingle();

  if (!sus || sus.center_id !== centerId) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }
  if (sus.estado === "CANCELADA") {
    return NextResponse.json({ ok: true, yaCancelada: true });
  }

  const { error } = await supabaseAdmin
    .from("sgcc_suscripciones")
    .update({
      estado: "CANCELADA",
      cancelada_el: new Date().toISOString(),
      proximo_cobro: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sus.id);

  if (error) {
    console.error("[facturacion/cancelar]", error);
    return NextResponse.json({ error: "No se pudo cancelar" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
