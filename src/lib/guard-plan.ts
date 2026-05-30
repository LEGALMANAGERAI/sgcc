import { NextResponse } from "next/server";
import { getEstadoPlanCentro } from "./estado-plan";

/**
 * Guard para APIs que mutan datos (POST/PATCH/PUT/DELETE) en SIGECC.
 * Devuelve 402 Payment Required si el plan del centro está vencido más del
 * grace period (readOnly = true).
 *
 * Uso típico al inicio de un handler:
 *   const bloqueo = await requierePlanVigente(session);
 *   if (bloqueo) return bloqueo;
 *
 * NOTA: aún no está aplicado en ningún endpoint — se agregará en una
 * segunda iteración cuando los planes estén live en producción.
 */
export async function requierePlanVigente(session: unknown): Promise<NextResponse | null> {
  if (!session || typeof session !== "object" || !("user" in session)) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const estado = await getEstadoPlanCentro(session);
  if (estado.readOnly) {
    return NextResponse.json(
      {
        error: "Plan vencido",
        code: "PLAN_VENCIDO",
        diasVencido: estado.diasRestantes !== null ? Math.abs(estado.diasRestantes) : null,
        upgradeUrl: "/facturacion",
      },
      { status: 402 }
    );
  }

  return null;
}
