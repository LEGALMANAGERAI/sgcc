import { supabaseAdmin } from "./supabase";
import { resolveCenterId } from "./server-utils";

/**
 * Enforcement de planes para centros SIGECC.
 *
 * Reglas de producto:
 *  - Académico ............. siempre 'ok', readOnly false (gratis).
 *  - Privado / Notarial /
 *    Enterprise ............ paga via Wompi + plan_expires_at.
 *      · vencido 0–7d  → grace (banner rojo, sigue operando)
 *      · vencido 8d+   → read-only (banner rojo + 402 en APIs mutantes)
 *  - Sin tipo_tier ......... 'sin_plan' (banner amarillo, sin readOnly aún).
 *
 * Suspende SuperAdmin: no aplica enforcement.
 */

export type TipoTier = string;
export type EstadoCuenta = "ok" | "por_vencer" | "grace" | "vencido" | "sin_plan";

export interface EstadoPlanCentro {
  centerId: string | null;
  tipoTier: TipoTier | null;
  estado: EstadoCuenta;
  expira: Date | null;
  diasRestantes: number | null;
  readOnly: boolean;
}

export const DIAS_AVISO_PREVENCIDO = 7;
export const DIAS_GRACE_VENCIDO = 7;

function calcularDiasRestantes(expira: Date | null): number | null {
  if (!expira) return null;
  const msPorDia = 1000 * 60 * 60 * 24;
  const diff = expira.getTime() - Date.now();
  return Math.floor(diff / msPorDia);
}

function neutro(centerId: string | null, tipoTier: TipoTier | null): EstadoPlanCentro {
  return {
    centerId,
    tipoTier,
    estado: "ok",
    expira: null,
    diasRestantes: null,
    readOnly: false,
  };
}

/**
 * Devuelve el estado del plan del centro al que pertenece la sesión.
 * Si no hay sesión / centro, devuelve un objeto neutro 'ok' para no romper
 * código que asume siempre un valor.
 */
export async function getEstadoPlanCentro(session: unknown): Promise<EstadoPlanCentro> {
  const centerId = resolveCenterId(session);
  if (!centerId) return neutro(null, null);

  const { data: center } = await supabaseAdmin
    .from("sgcc_centers")
    .select("tipo_tier, plan_expires_at")
    .eq("id", centerId)
    .maybeSingle();

  const tipoTier: TipoTier | null = center?.tipo_tier ?? null;

  // Académico → siempre ok, sin enforcement
  if (tipoTier === "SIGECC_ACADEMICO") {
    return { centerId, tipoTier, estado: "ok", expira: null, diasRestantes: null, readOnly: false };
  }

  const expira: Date | null = center?.plan_expires_at ? new Date(center.plan_expires_at) : null;
  const diasRestantes = calcularDiasRestantes(expira);

  // Sin tier o sin expiración → sin plan (todavía no contratan / Enterprise sin set).
  if (!tipoTier) {
    return { centerId, tipoTier: null, estado: "sin_plan", expira: null, diasRestantes: null, readOnly: false };
  }
  if (!expira) {
    return { centerId, tipoTier, estado: "sin_plan", expira: null, diasRestantes: null, readOnly: false };
  }

  let estado: EstadoCuenta;
  let readOnly = false;

  if (diasRestantes! < -DIAS_GRACE_VENCIDO) {
    estado = "vencido";
    readOnly = true;
  } else if (diasRestantes! < 0) {
    estado = "grace";
  } else if (diasRestantes! <= DIAS_AVISO_PREVENCIDO) {
    estado = "por_vencer";
  } else {
    estado = "ok";
  }

  return { centerId, tipoTier, estado, expira, diasRestantes, readOnly };
}
