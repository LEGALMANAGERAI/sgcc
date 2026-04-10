import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { randomUUID } from "crypto";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/expediente/[id]/acreencias
 * Listar acreencias del caso con cálculos de % y pequeño acreedor.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id: caseId } = await params;

  const { data, error } = await supabaseAdmin
    .from("sgcc_acreencias")
    .select("*")
    .eq("case_id", caseId)
    .eq("center_id", centerId)
    .order("created_at", { ascending: true });

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

  if (!body.acreedor_nombre?.trim()) {
    return NextResponse.json({ error: "Nombre del acreedor es requerido" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("sgcc_acreencias")
    .insert({
      id: randomUUID(),
      case_id: caseId,
      center_id: centerId,
      party_id: body.party_id || null,
      acreedor_nombre: body.acreedor_nombre.trim(),
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
    "acreedor_nombre", "acreedor_documento", "party_id",
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

  // Retornar todas las acreencias actualizadas
  const { data: all } = await supabaseAdmin
    .from("sgcc_acreencias")
    .select("*")
    .eq("case_id", caseId)
    .eq("center_id", centerId)
    .order("created_at", { ascending: true });

  return NextResponse.json(all ?? []);
}

/**
 * DELETE /api/expediente/[id]/acreencias
 * Eliminar acreencia. Body: { acreencia_id }
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id: caseId } = await params;
  const body = await req.json();

  const { error } = await supabaseAdmin
    .from("sgcc_acreencias")
    .delete()
    .eq("id", body.acreencia_id)
    .eq("case_id", caseId)
    .eq("center_id", centerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recalcularPorcentajes(caseId, centerId);

  return NextResponse.json({ ok: true });
}

/* ─── Recalcular porcentajes ─────────────────────────────────────────── */

async function recalcularPorcentajes(caseId: string, centerId: string) {
  const { data: acreencias } = await supabaseAdmin
    .from("sgcc_acreencias")
    .select("id, con_capital")
    .eq("case_id", caseId)
    .eq("center_id", centerId);

  if (!acreencias || acreencias.length === 0) return;

  const totalCapital = acreencias.reduce((sum, a) => sum + (Number(a.con_capital) || 0), 0);

  // Calcular porcentajes
  const updates = acreencias.map((a) => ({
    id: a.id,
    porcentaje_voto: totalCapital > 0
      ? Math.round((Number(a.con_capital) / totalCapital) * 10000) / 10000
      : 0,
  }));

  // Identificar pequeños acreedores: sumados no superan 5% del total de TODOS los créditos
  const totalCreditos = acreencias.reduce((sum, a) => {
    return sum + (Number(a.con_capital) || 0);
  }, 0);

  const umbral5 = totalCreditos * 0.05;

  // Ordenar de menor a mayor capital para identificar pequeños
  const sorted = [...acreencias].sort((a, b) => (Number(a.con_capital) || 0) - (Number(b.con_capital) || 0));

  let acumulado = 0;
  const pequenosIds = new Set<string>();
  for (const a of sorted) {
    const capital = Number(a.con_capital) || 0;
    if (acumulado + capital <= umbral5) {
      acumulado += capital;
      pequenosIds.add(a.id);
    } else {
      break;
    }
  }

  // Actualizar cada acreencia
  for (const u of updates) {
    await supabaseAdmin
      .from("sgcc_acreencias")
      .update({
        porcentaje_voto: u.porcentaje_voto,
        es_pequeno_acreedor: pequenosIds.has(u.id),
      })
      .eq("id", u.id);
  }
}
