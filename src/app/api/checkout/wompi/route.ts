import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import {
  getPlanCobrable,
  precioPorPeriodo,
  type Periodo,
} from "@/lib/planes-suscripcion";
import {
  generarFirmaIntegridad,
  generarReference,
  copAPesosACentavos,
  getWompiConfig,
} from "@/lib/wompi";

const WIDGET_URL = "https://checkout.wompi.co/p/";

/**
 * POST /api/checkout/wompi
 *
 * Crea una suscripción EN_ESPERA y su transacción PENDIENTE en SIGECC y
 * construye la URL del Widget de Wompi para redirigir al usuario. El
 * estado final llega vía webhook /api/webhooks/wompi.
 *
 * Body: { planKey: "SIGECC_ESENCIAL" | "SIGECC_PROFESIONAL" | "SIGECC_NOTARIAL", periodo: "MENSUAL" | "ANUAL" }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    planKey?: string;
    periodo?: Periodo;
  };

  const periodo: Periodo = body.periodo === "ANUAL" ? "ANUAL" : "MENSUAL";
  const plan = body.planKey ? getPlanCobrable(body.planKey, periodo) : null;
  if (!plan) {
    return NextResponse.json({ error: "Plan inválido o no cobrable" }, { status: 400 });
  }

  const centerId = resolveCenterId(session);
  if (!centerId) {
    return NextResponse.json({ error: "Sin centro vinculado" }, { status: 400 });
  }

  const email = ((session.user as { email?: string } | undefined)?.email ?? "").trim();
  if (!email) return NextResponse.json({ error: "Usuario sin email" }, { status: 400 });

  const precioCOP = precioPorPeriodo(plan, periodo);
  const amountInCents = copAPesosACentavos(precioCOP);
  const reference = generarReference({ centerId, planKey: plan.key, periodo });

  // 1) Crear Suscripción EN_ESPERA
  const { data: suscripcion, error: errSub } = await supabaseAdmin
    .from("sgcc_suscripciones")
    .insert({
      center_id: centerId,
      plan_key: plan.key,
      periodo,
      precio_cop: precioCOP,
      estado: "EN_ESPERA",
      wompi_customer_email: email,
    })
    .select("id")
    .single();

  if (errSub || !suscripcion) {
    console.error("[checkout/wompi] error creando suscripcion", errSub);
    return NextResponse.json(
      {
        error: "No se pudo iniciar la suscripción",
        detalle: errSub?.message ?? null,
        code: (errSub as { code?: string } | null)?.code ?? null,
        hint: (errSub as { hint?: string } | null)?.hint ?? null,
        details: (errSub as { details?: string } | null)?.details ?? null,
      },
      { status: 500 }
    );
  }

  // 2) Crear Transacción PENDIENTE INICIAL
  const { error: errTx } = await supabaseAdmin.from("sgcc_transacciones_pago").insert({
    suscripcion_id: suscripcion.id,
    center_id: centerId,
    reference,
    monto_cop: precioCOP,
    moneda: "COP",
    estado: "PENDIENTE",
    tipo: "INICIAL",
  });

  if (errTx) {
    console.error("[checkout/wompi] error creando transaccion", errTx);
    return NextResponse.json(
      {
        error: "No se pudo iniciar la transacción",
        detalle: errTx?.message ?? null,
        code: (errTx as { code?: string } | null)?.code ?? null,
        hint: (errTx as { hint?: string } | null)?.hint ?? null,
        details: (errTx as { details?: string } | null)?.details ?? null,
      },
      { status: 500 }
    );
  }

  // 3) Firma de integridad
  const signature = generarFirmaIntegridad({
    reference,
    amountInCents,
    currency: "COP",
  });

  // 4) Construir URL del Widget
  const { publicKey } = getWompiConfig();
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    req.headers.get("origin") ??
    req.nextUrl.origin;
  const redirectUrl = `${origin}/pago/retorno`;

  const params = new URLSearchParams({
    "public-key": publicKey,
    currency: "COP",
    "amount-in-cents": String(amountInCents),
    reference,
    "signature:integrity": signature,
    "redirect-url": redirectUrl,
    "customer-data:email": email,
  });

  const checkoutUrl = `${WIDGET_URL}?${params.toString()}`;

  return NextResponse.json({
    checkoutUrl,
    reference,
    suscripcionId: suscripcion.id,
  });
}
