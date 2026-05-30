import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  crearCobroRecurrente,
  generarReference,
  copAPesosACentavos,
  WompiError,
} from "@/lib/wompi";
import { enviarEmailRenovacionManual } from "@/lib/emails-suscripcion";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min — cobros pueden ser muchos

/**
 * Cron diario de renovación de suscripciones Wompi.
 *
 * Busca suscripciones ACTIVAS cuyo proximo_cobro ya venció e intenta cobrarlas
 * usando el payment_source_id guardado. Si la suscripción no tiene token
 * (pagó con PSE/Nequi, que no permiten recurrencia), envía email de
 * renovación manual.
 *
 * Headers esperados:
 *   Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const ahora = new Date().toISOString();
    const { data: suscripciones, error } = await supabaseAdmin
      .from("sgcc_suscripciones")
      .select(
        "id, center_id, plan_key, periodo, precio_cop, wompi_customer_email, wompi_payment_source_id, fallos_consecutivos"
      )
      .eq("estado", "ACTIVA")
      .lte("proximo_cobro", ahora)
      .limit(100);

    if (error) {
      console.error("[cron/wompi-renovacion] error buscando suscripciones", error);
      return NextResponse.json({ error: "db error" }, { status: 500 });
    }

    const resultados = {
      procesadas: suscripciones?.length ?? 0,
      conToken: 0,
      sinToken: 0,
      errores: 0,
    };

    for (const sus of suscripciones ?? []) {
      if (!sus.wompi_payment_source_id) {
        resultados.sinToken++;
        if (sus.wompi_customer_email) {
          await enviarEmailRenovacionManual({
            to: sus.wompi_customer_email,
            planKey: sus.plan_key,
          });
        }
        continue;
      }

      const reference = generarReference({
        centerId: sus.center_id,
        planKey: sus.plan_key,
        periodo: sus.periodo,
      });

      // Insertar transacción PENDIENTE antes de llamar a Wompi (trazabilidad)
      const tipo = (sus.fallos_consecutivos ?? 0) > 0 ? "REINTENTO" : "RENOVACION";
      const { data: txRow, error: errInsert } = await supabaseAdmin
        .from("sgcc_transacciones_pago")
        .insert({
          suscripcion_id: sus.id,
          center_id: sus.center_id,
          reference,
          monto_cop: sus.precio_cop,
          moneda: "COP",
          estado: "PENDIENTE",
          tipo,
        })
        .select("id")
        .single();

      if (errInsert || !txRow) {
        resultados.errores++;
        console.error("[cron/wompi-renovacion] no se pudo insertar tx", errInsert);
        continue;
      }

      try {
        const { data: tx } = await crearCobroRecurrente({
          amountInCents: copAPesosACentavos(sus.precio_cop),
          currency: "COP",
          customerEmail: sus.wompi_customer_email ?? "",
          paymentSourceId: Number(sus.wompi_payment_source_id),
          reference,
        });
        await supabaseAdmin
          .from("sgcc_transacciones_pago")
          .update({
            wompi_transaction_id: tx.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", txRow.id);
        resultados.conToken++;
      } catch (e) {
        resultados.errores++;
        const msg = e instanceof WompiError ? e.message : "error desconocido";
        await supabaseAdmin
          .from("sgcc_transacciones_pago")
          .update({
            estado: "ERROR",
            detalle_error: msg,
            updated_at: new Date().toISOString(),
          })
          .eq("id", txRow.id);
        console.error(`[cron/wompi-renovacion] error cobrando ${sus.id}:`, msg);
      }
    }

    return NextResponse.json({ ok: true, ...resultados });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error desconocido";
    console.error("[cron/wompi-renovacion] error general", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
