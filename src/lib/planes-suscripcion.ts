/**
 * Catálogo de tiers SIGECC.
 *
 * Es la FUENTE DE VERDAD del checkout: los precios aquí deben coincidir con
 * la landing y la página /precios.
 *
 * Tiers cobrables (paga por Wompi):
 *   - SIGECC_ESENCIAL ......... Privado Esencial
 *   - SIGECC_PROFESIONAL ...... Privado Profesional
 *   - SIGECC_NOTARIAL ......... Notarial / Multi-sede
 *
 * Tiers no cobrables (no van por checkout):
 *   - SIGECC_ACADEMICO ........ Gratis (universidades, consultorios jurídicos)
 *   - SIGECC_ENTERPRISE ....... Cotizar con comercial
 *
 * Descuento anual: -20% sobre el precio mensual × 12.
 */

export type PlanKey =
  | "SIGECC_ACADEMICO"
  | "SIGECC_ESENCIAL"
  | "SIGECC_PROFESIONAL"
  | "SIGECC_NOTARIAL"
  | "SIGECC_ENTERPRISE";

export type Periodo = "MENSUAL" | "ANUAL";

export type TargetTier = "ACADEMICO" | "PRIVADO" | "NOTARIAL" | "ENTERPRISE";

export interface PlanCatalogo {
  key: PlanKey;
  nombre: string;
  target: TargetTier;
  mensualCOP: number;
  anualCOP: number; // total del año (mensual × 12 × 0.80)
  cobrable: boolean;
  descripcion: string;
}

function anualConDescuento(mensual: number): number {
  return Math.round(mensual * 12 * 0.8);
}

export const PLANES: Record<PlanKey, PlanCatalogo> = {
  SIGECC_ACADEMICO: {
    key: "SIGECC_ACADEMICO",
    nombre: "Académico",
    target: "ACADEMICO",
    mensualCOP: 0,
    anualCOP: 0,
    cobrable: false,
    descripcion: "Para universidades y consultorios jurídicos gratuitos.",
  },
  SIGECC_ESENCIAL: {
    key: "SIGECC_ESENCIAL",
    nombre: "Privado Esencial",
    target: "PRIVADO",
    mensualCOP: 490_000,
    anualCOP: anualConDescuento(490_000),
    cobrable: true,
    descripcion: "Para centros privados que están arrancando.",
  },
  SIGECC_PROFESIONAL: {
    key: "SIGECC_PROFESIONAL",
    nombre: "Privado Profesional",
    target: "PRIVADO",
    mensualCOP: 1_090_000,
    anualCOP: anualConDescuento(1_090_000),
    cobrable: true,
    descripcion: "Para centros privados consolidados con varios conciliadores.",
  },
  SIGECC_NOTARIAL: {
    key: "SIGECC_NOTARIAL",
    nombre: "Notarial / Multi-sede",
    target: "NOTARIAL",
    mensualCOP: 1_990_000,
    anualCOP: anualConDescuento(1_990_000),
    cobrable: true,
    descripcion: "Para notarías y operaciones con varias sedes.",
  },
  SIGECC_ENTERPRISE: {
    key: "SIGECC_ENTERPRISE",
    nombre: "Enterprise",
    target: "ENTERPRISE",
    mensualCOP: 3_500_000,
    anualCOP: 0,
    cobrable: false,
    descripcion: "Volumen alto, integraciones a medida y SLA dedicado.",
  },
};

export interface PlanCobrableRef {
  key: PlanKey;
  nombre: string;
  target: TargetTier;
  mensualCOP: number;
  anualCOP: number;
  periodo: Periodo;
}

/**
 * Devuelve el plan resuelto para un cobro concreto, o `null` si la key no
 * existe o el plan no es cobrable (Académico/Enterprise).
 */
export function getPlanCobrable(
  key: string,
  periodo: Periodo = "MENSUAL"
): PlanCobrableRef | null {
  const plan = (PLANES as Record<string, PlanCatalogo>)[key];
  if (!plan || !plan.cobrable) return null;
  return {
    key: plan.key,
    nombre: plan.nombre,
    target: plan.target,
    mensualCOP: plan.mensualCOP,
    anualCOP: plan.anualCOP,
    periodo,
  };
}

export function getPlan(key: string): PlanCatalogo | null {
  return (PLANES as Record<string, PlanCatalogo>)[key] ?? null;
}

export function precioPorPeriodo(plan: PlanCobrableRef | PlanCatalogo, periodo: Periodo): number {
  return periodo === "MENSUAL" ? plan.mensualCOP : plan.anualCOP;
}

export function formatearCOP(n: number): string {
  return `$${n.toLocaleString("es-CO")}`;
}
