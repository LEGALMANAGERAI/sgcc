import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  verificarFirmaEvento,
  calcularProximoCobro,
  copAPesosACentavos,
  type WompiEvent,
  type WompiTransaction,
} from "@/lib/wompi";
import {
  enviarEmailCobroAprobado,
  enviarEmailCobroRechazado,
} from "@/lib/emails-suscripcion";

// Mapeo de estados Wompi -> nuestro enum estado_transaccion
function mapEstadoWompi(status: string): "APROBADA" | "RECHAZADA" | "ERROR" | "VOIDED" | "PENDIENTE" {
  switch (status) {
    case "APPROVED":
      return "APROBADA";
    case "DECLINED":
      return "RECHAZADA";
    case "VOIDED":
      return "VOIDED";
    case "ERROR":
      return "ERROR";
    default:
      return "PENDIENTE";
  }
}

/**
 * Webhook público de Wompi. Recibe eventos cuando una transacción cambia de
 * estado. Verifica firma + idempotencia + validación de monto antes de
 * activar el plan en el centro.
 */
export async function POST(req: NextRequest) {
  // 1. Parsear y verificar firma
  let body: WompiEvent;
  try {
    body = (await req.json()) as WompiEvent;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  if (!verificarFirmaEvento(body)) {
    console.warn("[wompi/webhook] firma inválida", { event: body?.event });
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
  }

  // 2. Idempotencia — construimos eventId con (event + transaction.id + timestamp).
  const tx = body.data?.transaction;
  const eventId = `${body.event}-${tx?.id ?? "sin-tx"}-${body.timestamp}`;

  const { error: errEvent } = await supabaseAdmin.from("sgcc_webhook_eventos_wompi").insert({
    event_id: eventId,
    tipo: body.event,
    payload: body as unknown as Record<string, unknown>,
  });

  if (errEvent) {
    if ((errEvent as { code?: string }).code === "23505") {
      // Ya procesado en una entrega anterior — responder 200 para que Wompi no reintente.
      return NextResponse.json({ ok: true, duplicated: true });
    }
    console.error("[wompi/webhook] error guardando evento", errEvent);
    // Seguimos: no queremos bloquear la activación si el log de auditoría falla.
  }

  // 3. Procesar según tipo
  try {
    if (body.event === "transaction.updated" && tx) {
      await procesarTransaccion(tx);
    } else {
      console.log("[wompi/webhook] evento ignorado", body.event);
    }

    await supabaseAdmin
      .from("sgcc_webhook_eventos_wompi")
      .update({ procesado_en: new Date().toISOString() })
      .eq("event_id", eventId);

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error desconocido";
    console.error("[wompi/webhook] error procesando evento", e);
    await supabaseAdmin
      .from("sgcc_webhook_eventos_wompi")
      .update({ error: msg })
      .eq("event_id", eventId);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

async function procesarTransaccion(tx: WompiTransaction): Promise<void> {
  // 1. Localizar nuestra transacción por reference
  const { data: txRow } = await supabaseAdmin
    .from("sgcc_transacciones_pago")
    .select("id, suscripcion_id, center_id, estado, tipo, monto_cop")
    .eq("reference", tx.reference)
    .maybeSingle();

  if (!txRow) {
    console.warn("[wompi/webhook] transacción sin match local", tx.reference);
    return;
  }

  const nuevoEstado = mapEstadoWompi(tx.status);

  // 2. Validación de monto: si Wompi reporta un monto distinto al que registramos,
  //    NO activamos plan y dejamos rastro. (Gap detectado en LM y blindado aquí.)
  if (tx.status === "APPROVED") {
    const esperado = copAPesosACentavos(txRow.monto_cop);
    if (tx.amount_in_cents !== esperado) {
      const detalle = `Monto inválido: esperado=${esperado} cents, recibido=${tx.amount_in_cents} cents`;
      console.error(`[wompi/webhook] ${detalle} reference=${tx.reference}`);
      await supabaseAdmin
        .from("sgcc_transacciones_pago")
        .update({
          wompi_transaction_id: tx.id,
          estado: "ERROR",
          metodo_pago: tx.payment_method_type ?? null,
          detalle_error: detalle,
          updated_at: new Date().toISOString(),
        })
        .eq("id", txRow.id);
      return;
    }
  }

  // 3. Actualizar la transacción
  await supabaseAdmin
    .from("sgcc_transacciones_pago")
    .update({
      wompi_transaction_id: tx.id,
      estado: nuevoEstado,
      metodo_pago: tx.payment_method_type ?? null,
      detalle_error: tx.status === "APPROVED" ? null : tx.status_message ?? null,
      pagada_en: tx.status === "APPROVED" ? tx.finalized_at ?? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", txRow.id);

  // 4. Si no hay suscripción vinculada, terminamos
  if (!txRow.suscripcion_id) return;

  if (tx.status === "APPROVED") {
    const { data: suscripcion } = await supabaseAdmin
      .from("sgcc_suscripciones")
      .select("id, center_id, plan_key, periodo, precio_cop, wompi_customer_email")
      .eq("id", txRow.suscripcion_id)
      .single();

    if (!suscripcion) return;

    const proximoCobro = calcularProximoCobro(
      suscripcion.periodo as "MENSUAL" | "ANUAL",
      new Date()
    );

    const extra = tx.payment_method?.extra;
    await supabaseAdmin
      .from("sgcc_suscripciones")
      .update({
        estado: "ACTIVA",
        wompi_payment_source_id: tx.payment_source_id ? String(tx.payment_source_id) : null,
        wompi_payment_method_type: tx.payment_method_type ?? null,
        wompi_card_brand: extra?.brand ?? null,
        wompi_card_last4: extra?.last_four ?? null,
        inicia_el: new Date().toISOString(),
        proximo_cobro: proximoCobro.toISOString(),
        ultimo_intento_cobro: new Date().toISOString(),
        fallos_consecutivos: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", suscripcion.id);

    // Activar el plan en el centro
    await activarPlanCentro(suscripcion.center_id, suscripcion.plan_key, proximoCobro);

    // Email confirmación
    const { data: centro } = await supabaseAdmin
      .from("sgcc_centers")
      .select("nombre")
      .eq("id", suscripcion.center_id)
      .maybeSingle();

    if (suscripcion.wompi_customer_email) {
      await enviarEmailCobroAprobado({
        to: suscripcion.wompi_customer_email,
        nombre: centro?.nombre ?? null,
        planKey: suscripcion.plan_key,
        montoCOP: suscripcion.precio_cop,
        proximoCobro,
      });
    }
  } else if (tx.status === "DECLINED" || tx.status === "ERROR" || tx.status === "VOIDED") {
    // Solo nos importa para renovaciones / reintentos (en pagos iniciales el usuario reintenta manualmente)
    if (txRow.tipo === "RENOVACION" || txRow.tipo === "REINTENTO") {
      const { data: sus } = await supabaseAdmin
        .from("sgcc_suscripciones")
        .select("id, center_id, fallos_consecutivos, plan_key, precio_cop, wompi_customer_email")
        .eq("id", txRow.suscripcion_id)
        .single();
      if (!sus) return;

      const fallos = (sus.fallos_consecutivos ?? 0) + 1;
      const update: Record<string, unknown> = {
        fallos_consecutivos: fallos,
        ultimo_intento_cobro: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (fallos >= 3) update.estado = "VENCIDA";

      await supabaseAdmin.from("sgcc_suscripciones").update(update).eq("id", sus.id);

      const { data: centro } = await supabaseAdmin
        .from("sgcc_centers")
        .select("nombre")
        .eq("id", sus.center_id)
        .maybeSingle();

      if (sus.wompi_customer_email) {
        await enviarEmailCobroRechazado({
          to: sus.wompi_customer_email,
          nombre: centro?.nombre ?? null,
          planKey: sus.plan_key,
          montoCOP: sus.precio_cop,
          fallosConsecutivos: fallos,
          detalleError: tx.status_message ?? null,
        });
      }
    }
  }
}

/**
 * Activa el tier pagado en el centro: setea tipo_tier + plan_expires_at.
 */
async function activarPlanCentro(
  centerId: string,
  planKey: string,
  planExpiresAt: Date
): Promise<void> {
  await supabaseAdmin
    .from("sgcc_centers")
    .update({
      tipo_tier: planKey,
      plan_expires_at: planExpiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", centerId);
}
