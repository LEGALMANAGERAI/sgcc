import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/partes/notificaciones
 * Obtener notificaciones de la parte autenticada.
 * Query params: ?limit=20&solo_no_leidas=true
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const userType = (session.user as any)?.userType;
  if (userType !== "party") {
    return NextResponse.json({ error: "Solo partes" }, { status: 403 });
  }

  const userId = (session.user as any).id as string;
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 50);
  const soloNoLeidas = searchParams.get("solo_no_leidas") === "true";

  let query = supabaseAdmin
    .from("sgcc_notifications")
    .select("*")
    .eq("party_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (soloNoLeidas) {
    query = query.eq("leida", false);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Conteo de no leídas
  const { count } = await supabaseAdmin
    .from("sgcc_notifications")
    .select("id", { count: "exact", head: true })
    .eq("party_id", userId)
    .eq("leida", false);

  return NextResponse.json({ notificaciones: data ?? [], no_leidas: count ?? 0 });
}

/**
 * PATCH /api/partes/notificaciones
 * Marcar notificaciones como leídas.
 * Body: { ids: string[] } o { todas: true }
 */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const userType = (session.user as any)?.userType;
  if (userType !== "party") {
    return NextResponse.json({ error: "Solo partes" }, { status: 403 });
  }

  const userId = (session.user as any).id as string;
  const body = await req.json();
  const now = new Date().toISOString();

  if (body.todas) {
    const { error } = await supabaseAdmin
      .from("sgcc_notifications")
      .update({ leida: true, leida_at: now })
      .eq("party_id", userId)
      .eq("leida", false);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.ids && Array.isArray(body.ids) && body.ids.length > 0) {
    const { error } = await supabaseAdmin
      .from("sgcc_notifications")
      .update({ leida: true, leida_at: now })
      .eq("party_id", userId)
      .in("id", body.ids);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Envíe ids o todas: true" }, { status: 400 });
}
