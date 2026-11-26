import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { lmVerificarWebhook } from "@/lib/firma/lm-client";
import { notify } from "@/lib/notifications";

/**
 * POST /api/firmar/webhook-lm
 * Receptor de webhooks de la API partner de firma de Legal Manager.
 * Ruta pública (está bajo /api/firmar, exenta de auth en middleware).
 *
 * Verifica SIEMPRE la firma HMAC (X-LM-Signature) + anti-replay (X-LM-Timestamp)
 * sobre el body CRUDO antes de procesar. Responde 2xx para que LM no reintente.
 *
 * Eventos: firmante.firmado | firmante.rechazado | solicitud.completada |
 * solicitud.expirada | solicitud.cancelada (un cancelado nunca pasa a completado) |
 * solicitud.reactivada (expirada con nuevo plazo; conserva firmas) |
 * solicitud.por_vencer (<24 h; audita y notifica al creador y al conciliador)
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

  // Estados de documento que NO deben ser revertidos por eventos tardíos o
  // duplicados (LM ahora reintenta entregas → el mismo evento puede llegar 2 veces).
  const DOC_TERMINAL = ["completado", "cancelado", "rechazado", "expirado"];

  try {
    switch (evento.event) {
      case "firmante.firmado": {
        const lmFirmanteId = evento.firmante?.firmante_id;
        if (lmFirmanteId) {
          // Idempotente: solo actualizar + auditar si el firmante no estaba ya
          // firmado (un evento duplicado no debe insertar otra fila de auditoría).
          const { data: frm } = await supabaseAdmin
            .from("sgcc_firmantes")
            .select("id, estado")
            .eq("firma_documento_id", docId)
            .eq("lm_firmante_id", lmFirmanteId)
            .maybeSingle();
          if (frm && frm.estado !== "firmado") {
            await supabaseAdmin
              .from("sgcc_firmantes")
              .update({ estado: "firmado", firmado_at: now })
              .eq("id", frm.id);
            await registrar(docId, lmFirmanteId, "firmado", evento);
          }
        }
        // Recontar firmados y actualizar el contador SIN degradar un estado
        // terminal del documento (p. ej. un firmado tardío tras completada).
        const { count } = await supabaseAdmin
          .from("sgcc_firmantes")
          .select("id", { count: "exact", head: true })
          .eq("firma_documento_id", docId)
          .eq("estado", "firmado");
        const docUpdate: Record<string, any> = { firmantes_completados: count ?? 0 };
        if (!DOC_TERMINAL.includes(documento.estado)) docUpdate.estado = "en_proceso";
        await supabaseAdmin.from("sgcc_firma_documentos").update(docUpdate).eq("id", docId);
        break;
      }

      case "firmante.rechazado": {
        const lmFirmanteId = evento.firmante?.firmante_id;
        if (lmFirmanteId) {
          const { data: frm } = await supabaseAdmin
            .from("sgcc_firmantes")
            .select("id, estado")
            .eq("firma_documento_id", docId)
            .eq("lm_firmante_id", lmFirmanteId)
            .maybeSingle();
          if (frm && frm.estado !== "rechazado") {
            await supabaseAdmin
              .from("sgcc_firmantes")
              .update({ estado: "rechazado", motivo_rechazo: evento.firmante?.motivo ?? null })
              .eq("id", frm.id);
            await registrar(docId, lmFirmanteId, "rechazado", evento);
          }
        }
        // No sobrescribir un documento ya completado o cancelado.
        if (!["completado", "cancelado"].includes(documento.estado)) {
          await supabaseAdmin.from("sgcc_firma_documentos").update({ estado: "rechazado" }).eq("id", docId);
        }
        break;
      }

      case "solicitud.completada": {
        // Idempotente: solo procesar la primera vez (evita auditoría duplicada
        // y no revierte si ya estaba completado).
        // Un documento cancelado NUNCA pasa a completado.
        if (!["completado", "cancelado"].includes(documento.estado)) {
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
        }
        break;
      }

      case "solicitud.expirada": {
        // LM expiró la solicitud (cron de expiración partner). Marcar el documento
        // expirado (sin degradar un estado terminal) y sus firmantes aún abiertos.
        if (!DOC_TERMINAL.includes(documento.estado)) {
          await supabaseAdmin.from("sgcc_firma_documentos").update({ estado: "expirado" }).eq("id", docId);
          await registrar(docId, null, "expirado", evento);
        }
        await supabaseAdmin
          .from("sgcc_firmantes")
          .update({ estado: "expirado" })
          .eq("firma_documento_id", docId)
          .in("estado", ["pendiente", "enviado", "visto"]);
        break;
      }

      case "solicitud.reactivada": {
        // Solo un documento expirado se reactiva (nunca cancelado/completado/rechazado).
        // Idempotente: la ruta local de reactivar también actualiza; si ya no está
        // expirado no se audita de nuevo.
        if (documento.estado === "expirado") {
          const { data: d } = await supabaseAdmin
            .from("sgcc_firma_documentos")
            .select("firmantes_completados")
            .eq("id", docId)
            .maybeSingle();
          await supabaseAdmin
            .from("sgcc_firma_documentos")
            .update({
              estado: (d?.firmantes_completados ?? 0) > 0 ? "en_proceso" : "enviado",
              fecha_expiracion: evento.fecha_expiracion ?? null,
              updated_at: now,
            })
            .eq("id", docId);
          // sgcc_firmantes no tiene updated_at.
          await supabaseAdmin
            .from("sgcc_firmantes")
            .update({ estado: "enviado" })
            .eq("firma_documento_id", docId)
            .eq("estado", "expirado");
          await registrar(docId, null, "reactivado", evento);
        }
        break;
      }

      case "solicitud.por_vencer": {
        if (!DOC_TERMINAL.includes(documento.estado)) {
          await registrar(docId, null, "por_vencer", evento);
          try {
            await notificarPorVencer(docId, evento);
          } catch (e: any) {
            console.error("Webhook LM: error notificando por_vencer:", e?.message);
          }
        }
        break;
      }

      case "solicitud.cancelada": {
        // LM canceló la solicitud. No tocar un documento completado; idempotente
        // (si ya está cancelado no se audita de nuevo).
        if (documento.estado !== "completado" && documento.estado !== "cancelado") {
          await supabaseAdmin
            .from("sgcc_firma_documentos")
            .update({ estado: "cancelado", updated_at: now })
            .eq("id", docId);
          await supabaseAdmin.from("sgcc_firma_registros").insert({
            firma_documento_id: docId,
            firmante_id: null,
            accion: "cancelado",
            canal_otp: "lm",
            metadatos: { proveedor: "lm", via: "webhook", motivo: evento.motivo ?? null },
          });
        }
        // sgcc_firmantes no tiene updated_at.
        if (documento.estado !== "completado") {
          await supabaseAdmin
            .from("sgcc_firmantes")
            .update({ estado: "cancelado" })
            .eq("firma_documento_id", docId)
            .in("estado", ["pendiente", "enviado", "visto"]);
        }
        break;
      }

      default:
        // Evento desconocido (p. ej. uno nuevo del contrato de LM): aceptar con 200
        // y loguear, nunca devolver 500.
        console.warn("Webhook LM: evento no manejado:", evento.event, "doc:", docId);
        break;
    }
  } catch (err: any) {
    // Logueamos pero respondemos 200 para no provocar reintentos infinitos;
    // el estado puede reconciliarse luego con GET /solicitudes/{id}.
    console.error("Error procesando webhook LM:", err?.message);
  }

  return new Response("ok", { status: 200 });
}

async function notificarPorVencer(docId: string, evento: any) {
  const { data: doc } = await supabaseAdmin
    .from("sgcc_firma_documentos")
    .select("center_id, case_id, nombre, creado_por")
    .eq("id", docId)
    .maybeSingle();
  if (!doc) return;

  const ids = new Set<string>();
  if (doc.creado_por) ids.add(doc.creado_por);
  if (doc.case_id) {
    const { data: caso } = await supabaseAdmin
      .from("sgcc_cases")
      .select("conciliador_id")
      .eq("id", doc.case_id)
      .maybeSingle();
    if (caso?.conciliador_id) ids.add(caso.conciliador_id);
  }
  if (ids.size === 0) return;

  const { data: staff } = await supabaseAdmin
    .from("sgcc_staff")
    .select("id, email")
    .in("id", [...ids]);
  const recipients = (staff ?? []).map((s: any) => ({ staffId: s.id, email: s.email ?? undefined }));
  if (recipients.length === 0) return;

  const cuando = evento.fecha_expiracion
    ? new Date(evento.fecha_expiracion).toLocaleString("es-CO", {
        timeZone: "America/Bogota",
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "pronto";
  const faltan = (evento.firmantes_pendientes ?? [])
    .map((f: any) => f.nombre || f.email)
    .filter(Boolean)
    .join(", ");

  await notify({
    centerId: doc.center_id,
    caseId: doc.case_id ?? undefined,
    tipo: "firma_por_vencer",
    titulo: "Firma por vencer",
    mensaje:
      `La solicitud de firma "${doc.nombre}" vence el ${cuando} (hora de Colombia).` +
      (faltan ? ` Faltan por firmar: ${faltan}.` : ""),
    recipients,
    canal: "both",
  });
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
