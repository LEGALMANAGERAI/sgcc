import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { lmVerificarWebhook } from "@/lib/firma/lm-client";

/**
 * POST /api/firmar/webhook-lm
 * Receptor de webhooks de la API partner de firma de Legal Manager.
 * Ruta pública (está bajo /api/firmar, exenta de auth en middleware).
 *
 * Verifica SIEMPRE la firma HMAC (X-LM-Signature) + anti-replay (X-LM-Timestamp)
 * sobre el body CRUDO antes de procesar. Responde 2xx para que LM no reintente.
 *
 * Eventos: firmante.firmado | firmante.rechazado | solicitud.completada
 */
export async function POST(req: NextRequest) {
  // 1) Body crudo (NO parseado): necesario para verificar el HMAC.
  const raw = await req.text();
  const sig = req.headers.get("x-lm-signature");
  const ts = req.headers.get("x-lm-timestamp");

  const check = lmVerificarWebhook(raw, sig, ts);
  if (!check.ok) {
    const status = check.error === "stale" ? 400 : 401;
    return new Response(check.error ?? "unauthorized", { status });
  }

  let evento: any;
  try {
    evento = JSON.parse(raw);
  } catch {
    return new Response("bad json", { status: 400 });
  }

  // 2) Localizar el documento por nuestro external_solicitud_id (= id del documento).
  const docId: string | undefined = evento.external_solicitud_id;
  if (!docId) return new Response("missing external_solicitud_id", { status: 400 });

  const { data: documento } = await supabaseAdmin
    .from("sgcc_firma_documentos")
    .select("id, total_firmantes, estado")
    .eq("id", docId)
    .maybeSingle();

  // Documento desconocido: respondemos 200 igual para que LM no reintente en bucle.
  if (!documento) return new Response("ok", { status: 200 });

  const now = new Date().toISOString();

  try {
    switch (evento.event) {
      case "firmante.firmado": {
        const lmFirmanteId = evento.firmante?.firmante_id;
        if (lmFirmanteId) {
          await supabaseAdmin
            .from("sgcc_firmantes")
            .update({ estado: "firmado", firmado_at: now })
            .eq("firma_documento_id", docId)
            .eq("lm_firmante_id", lmFirmanteId);
        }
        // Recontar firmados y actualizar el contador del documento.
        const { count } = await supabaseAdmin
          .from("sgcc_firmantes")
          .select("id", { count: "exact", head: true })
          .eq("firma_documento_id", docId)
          .eq("estado", "firmado");
        await supabaseAdmin
          .from("sgcc_firma_documentos")
          .update({ firmantes_completados: count ?? 0, estado: "en_proceso" })
          .eq("id", docId);
        await registrar(docId, lmFirmanteId, "firmado", evento);
        break;
      }

      case "firmante.rechazado": {
        const lmFirmanteId = evento.firmante?.firmante_id;
        if (lmFirmanteId) {
          await supabaseAdmin
            .from("sgcc_firmantes")
            .update({ estado: "rechazado", motivo_rechazo: evento.firmante?.motivo ?? null })
            .eq("firma_documento_id", docId)
            .eq("lm_firmante_id", lmFirmanteId);
        }
        await supabaseAdmin
          .from("sgcc_firma_documentos")
          .update({ estado: "rechazado" })
          .eq("id", docId);
        await registrar(docId, lmFirmanteId, "rechazado", evento);
        break;
      }

      case "solicitud.completada": {
        await supabaseAdmin
          .from("sgcc_firma_documentos")
          .update({
            estado: "completado",
            firmantes_completados: documento.total_firmantes,
            archivo_firmado_url: evento.pdf_firmado_url ?? null,
            lm_pdf_firmado_url: evento.pdf_firmado_url ?? null,
            lm_verificacion_url: evento.verificacion_url ?? null,
          })
          .eq("id", docId);
        await registrar(docId, null, "firmado", evento);
        break;
      }

      default:
        // Evento no manejado: lo aceptamos sin hacer nada.
        break;
    }
  } catch (err: any) {
    // Logueamos pero respondemos 200 para no provocar reintentos infinitos;
    // el estado puede reconciliarse luego con GET /solicitudes/{id}.
    console.error("Error procesando webhook LM:", err?.message);
  }

  return new Response("ok", { status: 200 });
}

async function registrar(docId: string, lmFirmanteId: string | null, accion: string, evento: any) {
  // Resolver el firmante interno a partir del lm_firmante_id (si vino).
  let firmanteId: string | null = null;
  if (lmFirmanteId) {
    const { data } = await supabaseAdmin
      .from("sgcc_firmantes")
      .select("id")
      .eq("firma_documento_id", docId)
      .eq("lm_firmante_id", lmFirmanteId)
      .maybeSingle();
    firmanteId = data?.id ?? null;
  }
  await supabaseAdmin.from("sgcc_firma_registros").insert({
    firma_documento_id: docId,
    firmante_id: firmanteId,
    accion,
    canal_otp: "lm",
    metadatos: { proveedor: "lm", event: evento.event, solicitud_id: evento.solicitud_id },
  });
}
