// src/lib/solicitudes/payment-plan.ts
// Cronogramas de pago para propuestas de insolvencia (Ley 2445/2025).
// Fórmulas validadas contra propuesta real de BBVA — ver scripts/smoke-payment-plan.mjs.
//
// Convenciones:
// - Cronograma en MESES RELATIVOS contados desde la suscripción del acuerdo:
//   mes 1 = primer pago; durante los meses de gracia NO corre interés y NO hay pagos.
// - Tasas se expresan en % mensual nominal (ej. 1.5 = 1.5% mensual).
// - Amortización francesa (cuota fija) por defecto; lineal disponible por compatibilidad.

import type {
  AcreedorFormData,
  ClasePrelacion,
  CondonacionesConfig,
  CuotaCronograma,
  PropuestaPagoCredito,
  TipoAmortizacion,
} from "@/types/solicitudes";
import { CLASE_PRELACION_LABEL } from "./constants";

// ---------------- Equivalencias de tasa ----------------

export function tasaMensualAEA(iMensualPct: number): number {
  return Math.pow(1 + iMensualPct / 100, 12) - 1;
}

export function tasaEAAMensual(eaPct: number): number {
  return Math.pow(1 + eaPct / 100, 1 / 12) - 1;
}

// ---------------- Cronogramas por crédito ----------------

interface CronogramaParams {
  capital: number;
  tasaMensualPct: number;
  numeroCuotas: number;
  mesesGracia?: number;
}

export function generarCronogramaFrances({
  capital,
  tasaMensualPct,
  numeroCuotas,
  mesesGracia = 0,
}: CronogramaParams): CuotaCronograma[] {
  if (capital <= 0 || numeroCuotas <= 0) return [];
  const i = tasaMensualPct / 100;
  const C = cuotaFrancesa(capital, i, numeroCuotas);
  let saldo = capital;
  const out: CuotaCronograma[] = [];
  for (let k = 1; k <= numeroCuotas; k++) {
    const intereses = saldo * i;
    const amort = C - intereses;
    saldo = saldo - amort;
    if (k === numeroCuotas) saldo = 0;
    out.push({
      cuota: k,
      mes_relativo: mesesGracia + k,
      cuota_total: round2(C),
      intereses: round2(intereses),
      amortizacion: round2(amort),
      saldo: round2(saldo),
    });
  }
  return out;
}

export function generarCronogramaLineal({
  capital,
  tasaMensualPct,
  numeroCuotas,
  mesesGracia = 0,
}: CronogramaParams): CuotaCronograma[] {
  if (capital <= 0 || numeroCuotas <= 0) return [];
  const i = tasaMensualPct / 100;
  const amort = capital / numeroCuotas;
  let saldo = capital;
  const out: CuotaCronograma[] = [];
  for (let k = 1; k <= numeroCuotas; k++) {
    const intereses = saldo * i;
    const cuotaTotal = amort + intereses;
    saldo = saldo - amort;
    if (k === numeroCuotas) saldo = 0;
    out.push({
      cuota: k,
      mes_relativo: mesesGracia + k,
      cuota_total: round2(cuotaTotal),
      intereses: round2(intereses),
      amortizacion: round2(amort),
      saldo: round2(saldo),
    });
  }
  return out;
}

export function generarCronograma(
  params: CronogramaParams & { tipo: TipoAmortizacion },
): CuotaCronograma[] {
  return params.tipo === "lineal"
    ? generarCronogramaLineal(params)
    : generarCronogramaFrances(params);
}

// ---------------- Prorrata quinta clase ----------------

export interface CreditoQuintaInput {
  acreedor_index: number;
  capital: number;
  tasa_interes_mensual_pct: number;
}

export interface ProrrataConfig {
  creditos: CreditoQuintaInput[];
  numeroCuotasCompartido: number;
  mesesGraciaCompartido: number;
  tipoAmortizacion: TipoAmortizacion;
}

export interface ResultadoProrrata {
  acreedor_index: number;
  porcentaje_prorrata: number;
  cronograma: CuotaCronograma[];
}

/**
 * Modo A quinta clase: todos los acreedores se pagan en el mismo plazo,
 * con cronograma individual calculado con su propia tasa. El porcentaje
 * de prorrata indica la participación de cada acreedor en el capital total.
 */
export function generarCronogramaProrrataQuinta(
  cfg: ProrrataConfig,
): ResultadoProrrata[] {
  const capitalTotal = cfg.creditos.reduce((s, c) => s + c.capital, 0);
  return cfg.creditos.map((c) => ({
    acreedor_index: c.acreedor_index,
    porcentaje_prorrata:
      capitalTotal > 0 ? round2((c.capital / capitalTotal) * 100) : 0,
    cronograma: generarCronograma({
      capital: c.capital,
      tasaMensualPct: c.tasa_interes_mensual_pct,
      numeroCuotas: cfg.numeroCuotasCompartido,
      mesesGracia: cfg.mesesGraciaCompartido,
      tipo: cfg.tipoAmortizacion,
    }),
  }));
}

/**
 * Modo B quinta clase: prioridad a pequeños acreedores.
 * Tramo 1 (cuotas 1..M tras la gracia): pequeños a prorrata entre sí.
 * Tramo 2 (cuotas M+1..N): resto de quinta a prorrata, con gracia extendida.
 */
export function generarCronogramaPrioridadPequenos(cfg: {
  pequenos: CreditoQuintaInput[];
  otros: CreditoQuintaInput[];
  numeroCuotasTotal: number;
  mCuotasPequenos: number;
  mesesGraciaCompartido: number;
  tipoAmortizacion: TipoAmortizacion;
}): ResultadoProrrata[] {
  const {
    pequenos, otros, numeroCuotasTotal, mCuotasPequenos,
    mesesGraciaCompartido, tipoAmortizacion,
  } = cfg;
  const capitalPequenos = pequenos.reduce((s, c) => s + c.capital, 0);
  const capitalOtros = otros.reduce((s, c) => s + c.capital, 0);

  const resPequenos: ResultadoProrrata[] = pequenos.map((c) => ({
    acreedor_index: c.acreedor_index,
    porcentaje_prorrata:
      capitalPequenos > 0 ? round2((c.capital / capitalPequenos) * 100) : 0,
    cronograma: generarCronograma({
      capital: c.capital,
      tasaMensualPct: c.tasa_interes_mensual_pct,
      numeroCuotas: mCuotasPequenos,
      mesesGracia: mesesGraciaCompartido,
      tipo: tipoAmortizacion,
    }),
  }));

  const cuotasOtros = Math.max(0, numeroCuotasTotal - mCuotasPequenos);
  const resOtros: ResultadoProrrata[] = otros.map((c) => ({
    acreedor_index: c.acreedor_index,
    porcentaje_prorrata:
      capitalOtros > 0 ? round2((c.capital / capitalOtros) * 100) : 0,
    cronograma: generarCronograma({
      capital: c.capital,
      tasaMensualPct: c.tasa_interes_mensual_pct,
      numeroCuotas: cuotasOtros,
      mesesGracia: mesesGraciaCompartido + mCuotasPequenos,
      tipo: tipoAmortizacion,
    }),
  }));

  return [...resPequenos, ...resOtros];
}

// ---------------- Redacción narrativa ----------------

export function generarRedaccionCredito(
  credito: Pick<
    PropuestaPagoCredito,
    | "capital"
    | "tasa_interes_mensual_pct"
    | "numero_cuotas"
    | "meses_gracia"
    | "tipo_amortizacion"
    | "cronograma"
    | "porcentaje_prorrata"
  >,
  acreedor: Pick<AcreedorFormData, "nombre" | "tipo_credito" | "numero_doc">,
  clase: ClasePrelacion,
): string {
  const capitalFmt = fmtCOP(credito.capital);
  const cuotaFmt = credito.cronograma.length > 0 ? fmtCOP(credito.cronograma[0].cuota_total) : "—";
  const desde = credito.meses_gracia + 1;
  const hasta = credito.meses_gracia + credito.numero_cuotas;
  const tasaMensual = credito.tasa_interes_mensual_pct.toFixed(2);
  const tasaEA = (tasaMensualAEA(credito.tasa_interes_mensual_pct) * 100).toFixed(2);
  const tipoAmort =
    credito.tipo_amortizacion === "francesa"
      ? "iguales"
      : "con amortización lineal (capital constante)";
  const prorrataSuffix =
    credito.porcentaje_prorrata != null
      ? ` Dentro del pasivo de quinta clase la presente acreencia representa el ${credito.porcentaje_prorrata}% a prorrata.`
      : "";
  const tipoCredito = acreedor.tipo_credito ? ` ${acreedor.tipo_credito}` : "";
  const nroDoc = acreedor.numero_doc ? ` identificado con ${acreedor.numero_doc}` : "";

  return (
    `Las acreencias de ${CLASE_PRELACION_LABEL[clase].toLowerCase()} correspondientes al crédito${tipoCredito} ` +
    `con ${acreedor.nombre}${nroDoc}, por valor de capital de ${capitalFmt}, se pagarán en ` +
    `${credito.numero_cuotas} cuotas mensuales ${tipoAmort} de ${cuotaFmt}, a partir del mes ${desde} ` +
    `hasta el mes ${hasta} posterior a la suscripción del acuerdo de pago. Se solicita se apruebe una tasa ` +
    `de interés nominal mensual del ${tasaMensual}%, equivalente al ${tasaEA}% efectivo anual, la cual se ` +
    `generará desde que se cause el primer pago de las cuotas y hasta el cumplimiento total de la obligación.` +
    prorrataSuffix
  );
}

export function generarRedaccionCondonaciones(
  cond: CondonacionesConfig | undefined,
): string {
  if (!cond) return "";
  const conceptos: string[] = [];
  if (cond.intereses_corrientes) conceptos.push("intereses corrientes");
  if (cond.intereses_moratorios) conceptos.push("intereses moratorios");
  if (cond.otros_conceptos_distintos_capital)
    conceptos.push("cualquier otro concepto distinto al capital");
  if (conceptos.length === 0) return "";
  const lista =
    conceptos.length === 1
      ? conceptos[0]
      : conceptos.slice(0, -1).join(", ") + " y " + conceptos[conceptos.length - 1];
  const detalle = cond.detalle_adicional ? ` ${cond.detalle_adicional.trim()}` : "";
  return (
    `El deudor solicita respetuosamente la condonación de ${lista} causados con anterioridad a la ` +
    `presentación de la presente solicitud de insolvencia, respecto de las acreencias relacionadas en esta propuesta.${detalle}`
  );
}

// ---------------- KPIs ----------------

export function totalesDeCronograma(cronograma: CuotaCronograma[]) {
  return cronograma.reduce(
    (acc, c) => ({
      intereses: acc.intereses + c.intereses,
      amortizacion: acc.amortizacion + c.amortizacion,
      total: acc.total + c.cuota_total,
    }),
    { intereses: 0, amortizacion: 0, total: 0 },
  );
}

// ---------------- Helpers ----------------

function cuotaFrancesa(capital: number, iMensual: number, n: number): number {
  if (iMensual === 0) return capital / n;
  const f = Math.pow(1 + iMensual, n);
  return (capital * iMensual * f) / (f - 1);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function fmtCOP(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-CO");
}
