import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";

/**
 * GET /api/busquedas-rama/[id]
 * Devuelve una búsqueda guardada con sus resultados completos.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from("sgcc_rama_searches")
    .select("*")
    .eq("id", id)
    .eq("center_id", centerId)
    .single();

  if (error) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  return NextResponse.json({
    id: data.id,
    tipo: data.tipo,
    query: data.query,
    resultados: data.resultados ?? [],
    totalResultados: data.total_resultados,
    notas: data.notas,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  });
}

/**
 * PUT /api/busquedas-rama/[id]
 * Actualiza los resultados o notas de una búsqueda guardada.
 * Body: { resultados?: any[], notas?: string }
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id } = await params;
  const body = await req.json();

  const update: Record<string, any> = { updated_at: new Date().toISOString() };
  if (Array.isArray(body.resultados)) {
    update.resultados = body.resultados;
    update.total_resultados = body.resultados.length;
  }
  if (typeof body.notas === "string") {
    update.notas = body.notas.trim() || null;
  }

  const { error } = await supabaseAdmin
    .from("sgcc_rama_searches")
    .update(update)
    .eq("id", id)
    .eq("center_id", centerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/busquedas-rama/[id]
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id } = await params;

  const { error } = await supabaseAdmin
    .from("sgcc_rama_searches")
    .delete()
    .eq("id", id)
    .eq("center_id", centerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
