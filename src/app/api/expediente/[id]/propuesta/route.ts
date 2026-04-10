import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { randomUUID } from "crypto";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/expediente/[id]/propuesta
 * Obtener propuesta(s) de pago del caso con votos.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id: caseId } = await params;

  const { data, error } = await supabaseAdmin
    .from("sgcc_propuesta_pago")
    .select("*, votos:sgcc_votacion_insolvencia(*, acreencia:sgcc_acreencias(acreedor_nombre))")
    .eq("case_id", caseId)
    .eq("center_id", centerId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}

/**
 * POST /api/expediente/[id]/propuesta
 * Crear propuesta de pago.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id: caseId } = await params;
  const body = await req.json();

  if (!body.titulo?.trim() || !body.descripcion?.trim()) {
    return NextResponse.json({ error: "Título y descripción son requeridos" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("sgcc_propuesta_pago")
    .insert({
      id: randomUUID(),
      case_id: caseId,
      center_id: centerId,
      titulo: body.titulo.trim(),
      descripcion: body.descripcion.trim(),
      plazo_meses: body.plazo_meses ?? null,
      tasa_interes: body.tasa_interes?.trim() || null,
      periodo_gracia_meses: body.periodo_gracia_meses ?? 0,
      notas: body.notas?.trim() || null,
      estado: "borrador",
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}

/**
 * PATCH /api/expediente/[id]/propuesta
 * Actualizar propuesta o cambiar estado.
 * Body: { propuesta_id, ...campos }
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id: caseId } = await params;
  const body = await req.json();
  const { propuesta_id, ...campos } = body;

  if (!propuesta_id) {
    return NextResponse.json({ error: "propuesta_id es requerido" }, { status: 400 });
  }

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };

  const allowed = ["titulo", "descripcion", "plazo_meses", "tasa_interes", "periodo_gracia_meses", "notas", "estado"];
  for (const key of allowed) {
    if (campos[key] !== undefined) updates[key] = campos[key];
  }

  // Timestamps según estado
  if (campos.estado === "socializada") updates.fecha_socializacion = new Date().toISOString();
  if (campos.estado === "en_votacion") updates.fecha_votacion = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("sgcc_propuesta_pago")
    .update(updates)
    .eq("id", propuesta_id)
    .eq("case_id", caseId)
    .eq("center_id", centerId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
