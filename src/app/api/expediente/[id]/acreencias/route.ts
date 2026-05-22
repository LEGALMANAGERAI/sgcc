import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { randomUUID } from "crypto";
import { recalcularPorcentajesAcreencias as recalcularPorcentajes } from "@/lib/acreencias/recalcular-porcentajes";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/expediente/[id]/acreencias
 * Listar acreencias del caso con cálculos de % y pequeño acreedor.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id: caseId } = await params;

  // ?eliminadas=1 → papelera: devuelve solo las acreencias borradas (deleted_at)
  // para poder restaurarlas. Sin el parámetro, devuelve solo las activas.
  const soloEliminadas = req.nextUrl.searchParams.get("eliminadas") === "1";

  let query = supabaseAdmin
    .from("sgcc_acreencias")
    .select("*")
    .eq("case_id", caseId)
    .eq("center_id", centerId);

  query = soloEliminadas
    ? query.not("deleted_at", "is", null).order("deleted_at", { ascending: false })
    : query
        .is("deleted_at", null)
        .order("display_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}

/**
 * POST /api/expediente/[id]/acreencias
 * Crear nueva acreencia.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id: caseId } = await params;
  const body = await req.json();

  // Calcular siguiente display_order para este caso
  const { data: maxRow } = await supabaseAdmin
    .from("sgcc_acreencias")
    .select("display_order")
    .eq("case_id", caseId)
    .eq("center_id", centerId)
    .order("display_order", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (maxRow?.display_order ?? 0) + 1;

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("sgcc_acreencias")
    .insert({
      id: randomUUID(),
      case_id: caseId,
      center_id: centerId,
      party_id: body.party_id || null,
      display_order: nextOrder,
      acreedor_tipo: body.acreedor_tipo === "juridica" ? "juridica" : "natural",
      acreedor_nombre: body.acreedor_nombre?.trim() || "",
      identificacion_credito: body.identificacion_credito || null,
      acreedor_documento: body.acreedor_documento?.trim() || null,
      sol_capital: body.sol_capital ?? 0,
      sol_intereses_corrientes: body.sol_intereses_corrientes ?? 0,
      sol_intereses_moratorios: body.sol_intereses_moratorios ?? 0,
      sol_seguros: body.sol_seguros ?? 0,
      sol_otros: body.sol_otros ?? 0,
      acr_capital: body.acr_capital ?? 0,
      acr_intereses_corrientes: body.acr_intereses_corrientes ?? 0,
      acr_intereses_moratorios: body.acr_intereses_moratorios ?? 0,
      acr_seguros: body.acr_seguros ?? 0,
      acr_otros: body.acr_otros ?? 0,
      clase_credito: body.clase_credito ?? "quinta",
      dias_mora: body.dias_mora ?? 0,
      mora_90_dias: (body.dias_mora ?? 0) > 90,
      notas: body.notas || null,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Recalcular porcentajes y pequeños acreedores con la nueva acreencia
  // incluida. Sin esto, las marcas previas quedaban obsoletas al crecer
  // el pasivo total.
  await recalcularPorcentajes(caseId, centerId);

  return NextResponse.json(data, { status: 201 });
}

/**
 * PATCH /api/expediente/[id]/acreencias
 * Actualizar una acreencia + recalcular % de voto y pequeños acreedores.
 * Body: { acreencia_id, ...campos }
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id: caseId } = await params;
  const body = await req.json();
  const { acreencia_id, ...campos } = body;

  if (!acreencia_id) {
    return NextResponse.json({ error: "acreencia_id es requerido" }, { status: 400 });
  }

  // Campos permitidos para actualizar
  const allowed = [
    "acreedor_tipo", "acreedor_nombre", "acreedor_documento", "identificacion_credito", "party_id",
    "sol_capital", "sol_intereses_corrientes", "sol_intereses_moratorios", "sol_seguros", "sol_otros",
    "acr_capital", "acr_intereses_corrientes", "acr_intereses_moratorios", "acr_seguros", "acr_otros",
    "con_capital", "con_intereses_corrientes", "con_intereses_moratorios", "con_seguros", "con_otros",
    "fecha_conciliacion", "notas",
    "clase_credito", "dias_mora",
  ];

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (campos[key] !== undefined) updates[key] = campos[key];
  }
  // Auto-calcular mora_90_dias
  if (updates.dias_mora !== undefined) {
    updates.mora_90_dias = Number(updates.dias_mora) > 90;
  }

  const { error: updateError } = await supabaseAdmin
    .from("sgcc_acreencias")
    .update(updates)
    .eq("id", acreencia_id)
    .eq("case_id", caseId)
    .eq("center_id", centerId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // Recalcular porcentajes de voto y pequeños acreedores para TODO el caso
  await recalcularPorcentajes(caseId, centerId);

  // Retornar todas las acreencias activas actualizadas
  const { data: all } = await supabaseAdmin
    .from("sgcc_acreencias")
    .select("*")
    .eq("case_id", caseId)
    .eq("center_id", centerId)
    .is("deleted_at", null)
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  return NextResponse.json(all ?? []);
}

/**
 * DELETE /api/expediente/[id]/acreencias
 * Eliminar acreencia (borrado lógico: marca deleted_at, recuperable desde la
 * papelera con PUT). Body: { acreencia_id }
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id: caseId } = await params;
  const body = await req.json();

  const { data, error } = await supabaseAdmin
    .from("sgcc_acreencias")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", body.acreencia_id)
    .eq("case_id", caseId)
    .eq("center_id", centerId)
    .is("deleted_at", null)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recalcularPorcentajes(caseId, centerId);

  // Devolvemos la acreencia eliminada para que el cliente pueda mostrar el
  // aviso "Deshacer" con su nombre.
  return NextResponse.json({ ok: true, acreencia: data ?? null });
}

/**
 * PUT /api/expediente/[id]/acreencias
 * Restaurar una acreencia eliminada (deshacer). Body: { acreencia_id }
 */
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id: caseId } = await params;
  const body = await req.json();

  if (!body.acreencia_id) {
    return NextResponse.json({ error: "acreencia_id es requerido" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("sgcc_acreencias")
    .update({ deleted_at: null })
    .eq("id", body.acreencia_id)
    .eq("case_id", caseId)
    .eq("center_id", centerId)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Acreencia no encontrada" }, { status: 404 });

  await recalcularPorcentajes(caseId, centerId);

  return NextResponse.json({ ok: true, acreencia: data });
}

/* ─── Recalcular porcentajes ─────────────────────────────────────────── */

// recalcularPorcentajes -> @/lib/acreencias/recalcular-porcentajes
