import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { randomUUID } from "crypto";

type Params = { params: Promise<{ id: string }> };

/**
 * Cálculo de cuota mensual (fórmula PMT).
 * PMT = P * [r(1+r)^n] / [(1+r)^n - 1]
 * Si tasa=0, cuota = capital / meses
 */
function calcularCuota(capital: number, tasaAnual: number, meses: number): number {
  if (capital <= 0 || meses <= 0) return 0;
  if (tasaAnual === 0) return capital / meses;
  const r = tasaAnual / 12;
  const factor = Math.pow(1 + r, meses);
  return capital * (r * factor) / (factor - 1);
}

/**
 * GET /api/expediente/[id]/acuerdo
 * Obtener acuerdo de pagos del caso con detalles.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id: caseId } = await params;

  const { data, error } = await supabaseAdmin
    .from("sgcc_acuerdo_pago")
    .select("*, detalles:sgcc_acuerdo_detalle(*, acreencia:sgcc_acreencias(acreedor_nombre, clase_credito))")
    .eq("case_id", caseId)
    .eq("center_id", centerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) return NextResponse.json(null);

  return NextResponse.json(data);
}

/**
 * POST /api/expediente/[id]/acuerdo
 * Generar acuerdo de pagos basado en la propuesta aprobada.
 * Body: { propuesta_id, tasa_interes_anual, plazo_meses, periodo_gracia_meses, fecha_inicio_pago, notas }
 */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id: caseId } = await params;
  const body = await req.json();

  const {
    propuesta_id,
    tasa_interes_anual = 0,
    plazo_meses = 12,
    periodo_gracia_meses = 0,
    fecha_inicio_pago,
    notas,
  } = body;

  if (!plazo_meses || plazo_meses < 1) {
    return NextResponse.json({ error: "Plazo en meses es requerido" }, { status: 400 });
  }

  // Obtener acreencias conciliadas
  const { data: acreencias } = await supabaseAdmin
    .from("sgcc_acreencias")
    .select("*")
    .eq("case_id", caseId)
    .eq("center_id", centerId)
    .order("clase_credito")
    .order("created_at");

  if (!acreencias || acreencias.length === 0) {
    return NextResponse.json({ error: "No hay acreencias registradas" }, { status: 400 });
  }

  // Obtener votos si hay propuesta
  let votosMap: Record<string, string> = {};
  if (propuesta_id) {
    const { data: votos } = await supabaseAdmin
      .from("sgcc_votacion_insolvencia")
      .select("acreencia_id, voto")
      .eq("propuesta_id", propuesta_id);
    for (const v of votos ?? []) {
      votosMap[v.acreencia_id] = v.voto;
    }
  }

  // Calcular totales
  const capitalTotal = acreencias.reduce((s, a) => s + (Number(a.con_capital) || 0), 0);
  const mesesEfectivos = plazo_meses - periodo_gracia_meses;
  const cuotaGlobal = calcularCuota(capitalTotal, tasa_interes_anual, mesesEfectivos > 0 ? mesesEfectivos : plazo_meses);

  // Obtener porcentaje aprobación
  const pctAprobacion = propuesta_id
    ? (await supabaseAdmin.from("sgcc_propuesta_pago").select("porcentaje_aprobacion").eq("id", propuesta_id).single()).data?.porcentaje_aprobacion ?? 0
    : 0;

  const now = new Date().toISOString();
  const acuerdoId = randomUUID();

  // Crear acuerdo
  const { error: acuerdoError } = await supabaseAdmin
    .from("sgcc_acuerdo_pago")
    .insert({
      id: acuerdoId,
      case_id: caseId,
      center_id: centerId,
      propuesta_id: propuesta_id || null,
      capital_total: capitalTotal,
      tasa_interes_anual,
      plazo_meses,
      periodo_gracia_meses,
      fecha_inicio_pago: fecha_inicio_pago || null,
      valor_cuota_global: Math.round(cuotaGlobal * 100) / 100,
      notas: notas?.trim() || null,
      porcentaje_aprobacion: pctAprobacion,
      created_at: now,
      updated_at: now,
    });

  if (acuerdoError) return NextResponse.json({ error: acuerdoError.message }, { status: 500 });

  // Crear detalle por acreedor
  const tasa = tasa_interes_anual;
  const detalles = acreencias.map((a) => {
    const capital = Number(a.con_capital) || 0;
    const intCorrientes = Number(a.con_intereses_corrientes) || 0;
    const intMoratorios = Number(a.con_intereses_moratorios) || 0;
    const interesesCausados = intCorrientes + intMoratorios;

    // Intereses futuros = capital * tasa mensual * meses efectivos
    const tasaMensual = tasa / 12;
    const interesesFuturos = capital * tasaMensual * (mesesEfectivos > 0 ? mesesEfectivos : plazo_meses);

    const totalAPagar = capital + interesesFuturos; // sin intereses causados (condonados según notas)
    const cuotaAcreedor = capitalTotal > 0
      ? cuotaGlobal * (capital / capitalTotal)
      : 0;

    return {
      id: randomUUID(),
      acuerdo_id: acuerdoId,
      acreencia_id: a.id,
      capital,
      intereses_causados: Math.round(interesesCausados * 100) / 100,
      intereses_futuros: Math.round(interesesFuturos * 100) / 100,
      descuentos_capital: 0,
      total_a_pagar: Math.round(totalAPagar * 100) / 100,
      valor_cuota: Math.round(cuotaAcreedor * 100) / 100,
      derecho_voto: a.porcentaje_voto,
      sentido_voto: votosMap[a.id] || null,
      created_at: now,
    };
  });

  const { error: detalleError } = await supabaseAdmin
    .from("sgcc_acuerdo_detalle")
    .insert(detalles);

  if (detalleError) return NextResponse.json({ error: detalleError.message }, { status: 500 });

  // Retornar acuerdo completo
  const { data: acuerdoCompleto } = await supabaseAdmin
    .from("sgcc_acuerdo_pago")
    .select("*, detalles:sgcc_acuerdo_detalle(*, acreencia:sgcc_acreencias(acreedor_nombre, clase_credito))")
    .eq("id", acuerdoId)
    .single();

  return NextResponse.json(acuerdoCompleto, { status: 201 });
}

/**
 * PATCH /api/expediente/[id]/acuerdo
 * Actualizar parámetros del acuerdo y recalcular cuotas.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id: caseId } = await params;
  const body = await req.json();
  const { acuerdo_id, ...campos } = body;

  if (!acuerdo_id) return NextResponse.json({ error: "acuerdo_id requerido" }, { status: 400 });

  const allowed = ["tasa_interes_anual", "plazo_meses", "periodo_gracia_meses", "fecha_inicio_pago", "notas"];
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (campos[key] !== undefined) updates[key] = campos[key];
  }

  // Recalcular cuota si cambiaron parámetros financieros
  if (campos.tasa_interes_anual !== undefined || campos.plazo_meses !== undefined || campos.periodo_gracia_meses !== undefined) {
    const { data: acuerdo } = await supabaseAdmin
      .from("sgcc_acuerdo_pago")
      .select("capital_total, tasa_interes_anual, plazo_meses, periodo_gracia_meses")
      .eq("id", acuerdo_id)
      .single();

    if (acuerdo) {
      const tasa = campos.tasa_interes_anual ?? acuerdo.tasa_interes_anual;
      const plazo = campos.plazo_meses ?? acuerdo.plazo_meses;
      const gracia = campos.periodo_gracia_meses ?? acuerdo.periodo_gracia_meses;
      const mesesEfectivos = plazo - gracia;
      updates.valor_cuota_global = Math.round(
        calcularCuota(acuerdo.capital_total, tasa, mesesEfectivos > 0 ? mesesEfectivos : plazo) * 100
      ) / 100;
    }
  }

  const { data, error } = await supabaseAdmin
    .from("sgcc_acuerdo_pago")
    .update(updates)
    .eq("id", acuerdo_id)
    .eq("case_id", caseId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
