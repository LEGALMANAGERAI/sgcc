import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { randomUUID } from "crypto";

/**
 * GET /api/busquedas-rama
 * Lista las búsquedas guardadas del centro, orden por updated_at DESC.
 */
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("sgcc_rama_searches")
    .select("id, tipo, query, total_resultados, notas, created_at, updated_at")
    .eq("center_id", centerId)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const mapped = (data ?? []).map((r: any) => ({
    id: r.id,
    tipo: r.tipo,
    query: r.query,
    totalResultados: r.total_resultados,
    notas: r.notas,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  return NextResponse.json(mapped);
}

/**
 * POST /api/busquedas-rama
 * Guarda una nueva búsqueda de la Rama Judicial.
 * Body: { tipo: "nombre" | "radicado", query: string, resultados: any[], notas?: string }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const body = await req.json();
  const { tipo, query, resultados, notas } = body;

  if (tipo !== "nombre" && tipo !== "radicado") {
    return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
  }
  if (!query?.trim()) {
    return NextResponse.json({ error: "Consulta vacía" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const staffId = (session.user as any).id;

  const { data, error } = await supabaseAdmin
    .from("sgcc_rama_searches")
    .insert({
      id: randomUUID(),
      center_id: centerId,
      staff_id: staffId,
      tipo,
      query: query.trim(),
      resultados: Array.isArray(resultados) ? resultados : [],
      total_resultados: Array.isArray(resultados) ? resultados.length : 0,
      notas: notas?.trim() || null,
      created_at: now,
      updated_at: now,
    })
    .select("id, tipo, query, total_resultados, notas, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    id: data.id,
    tipo: data.tipo,
    query: data.query,
    totalResultados: data.total_resultados,
    notas: data.notas,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  });
}
