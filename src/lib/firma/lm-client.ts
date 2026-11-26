// ============================================================
// Cliente server-side de la API Partner de Firma de Legal Manager (LM)
// ============================================================
// Modelo redirect: SIGECC crea la solicitud en LM y redirige a los firmantes
// al portal de firma de LM (branding LM). El resultado llega por webhook.
//
// Contrato: legados/docs/partner-api/openapi.yaml
// Base URL prod: https://www.legalmanager.com.co/api/partner/v1
//
// ⚠️ SOLO server-side. Las env vars NO deben ser NEXT_PUBLIC_.

import { createHmac, timingSafeEqual } from "crypto";

const BASE_URL = process.env.LM_PARTNER_BASE_URL || "";
const API_KEY = process.env.LM_PARTNER_API_KEY || "";
const WEBHOOK_SECRET = process.env.LM_WEBHOOK_SECRET || "";

/** ¿Están configuradas las 3 env vars para hablar con LM? */
export function lmConfigured(): boolean {
  return Boolean(BASE_URL && API_KEY && WEBHOOK_SECRET);
}

export interface LmFirmantePayload {
  nombre: string;
  cedula: string;
  email: string;
  telefono?: string | null;
  /** Uno o varios canales separados por coma: "email", "whatsapp" o "email,whatsapp". */
  canal?: string;
  orden?: number;
}

export interface LmCrearSolicitudPayload {
  centro_id: string;
  external_solicitud_id: string;
  nombre: string;
  documento_url: string;
  firmantes: LmFirmantePayload[];
  orden_secuencial?: boolean;
  dias_expiracion?: number;
  return_url?: string;
  webhook_url?: string;
}

export interface LmSolicitudResp {
  solicitud_id: string;
  estado: string;
  external_solicitud_id: string;
  firmantes: Array<{ firmante_id: string; nombre: string; signing_url: string }>;
}

export class LmApiError extends Error {
  constructor(public status: number, message: string, public data?: any) {
    super(message);
    this.name = "LmApiError";
  }
}

async function lmFetch(path: string, init?: RequestInit): Promise<Response> {
  if (!lmConfigured()) {
    throw new LmApiError(0, "Integración con Legal Manager no configurada (faltan env vars).");
  }
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "X-API-Key": API_KEY,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    // No cachear llamadas a la API partner.
    cache: "no-store",
    // Si LM no responde, no colgar la página/ruta que llama (p. ej. el detalle de firma).
    signal: init?.signal ?? AbortSignal.timeout(15_000),
  });
}

/** GET /ping — valida la credencial del partner. */
export async function lmPing(): Promise<{ ok: boolean; partner?: { id: string; nombre: string } }> {
  const res = await lmFetch("/ping", { method: "GET" });
  if (!res.ok) throw new LmApiError(res.status, "API key de Legal Manager inválida o no autorizada.");
  return res.json();
}

/**
 * POST /solicitudes — crea (o recupera, por idempotencia) una solicitud de firma.
 * El documento se manda como URL https descargable (signed URL de nuestro storage).
 */
export async function lmCrearSolicitud(p: LmCrearSolicitudPayload): Promise<LmSolicitudResp> {
  const body = {
    centro_id: p.centro_id,
    external_solicitud_id: p.external_solicitud_id,
    nombre: p.nombre,
    documento: { url: p.documento_url },
    firmantes: p.firmantes.map((f) => ({
      nombre: f.nombre,
      cedula: f.cedula,
      email: f.email,
      telefono: f.telefono || undefined,
      canal: f.canal || "email",
      orden: f.orden,
    })),
    orden_secuencial: p.orden_secuencial ?? false,
    dias_expiracion: p.dias_expiracion ?? 3,
    return_url: p.return_url,
    webhook_url: p.webhook_url,
  };

  const res = await lmFetch("/solicitudes", { method: "POST", body: JSON.stringify(body) });

  // 409: LM deduplica por hash del PDF. Mismo documento + firmantes DISTINTOS →
  // ya existe una solicitud activa para ese PDF. Se devuelve el detalle en `data`
  // (solicitud_existente_id, nombre, estado) para manejarlo con gracia arriba.
  // (Mismo PDF + mismos firmantes → LM responde 200 reutilizando, no llega aquí.)
  if (res.status === 409) {
    const err = await res.json().catch(() => ({}));
    throw new LmApiError(
      409,
      err.error || "Ya existe una solicitud de firma activa para este documento en Legal Manager.",
      err,
    );
  }
  if (res.status !== 200 && res.status !== 201) {
    const err = await res.json().catch(() => ({ error: "Error desconocido" }));
    throw new LmApiError(res.status, err.error || `Legal Manager respondió ${res.status}`);
  }
  return res.json();
}

/** GET /solicitudes/{id} — estado actual (respaldo si se pierde un webhook). */
export async function lmGetSolicitud(solicitudId: string): Promise<any> {
  const res = await lmFetch(`/solicitudes/${solicitudId}`, { method: "GET" });
  if (!res.ok) throw new LmApiError(res.status, `No se pudo consultar la solicitud (${res.status}).`);
  return res.json();
}

/**
 * GET /solicitudes/{id}/documento — descarga el PDF firmado.
 * LM responde 302 hacia una signed URL temporal; al seguir el redirect (default)
 * obtenemos el PDF. Devolvemos la Response cruda para hacer streaming al cliente.
 * Útil para servir el documento firmado siempre fresco (las signed URL de LM son cortas).
 */
export async function lmDescargarDocumento(solicitudId: string): Promise<Response> {
  return lmFetch(`/solicitudes/${solicitudId}/documento`, { method: "GET" });
}

/** Lanza LmApiError con el mensaje de LM si la respuesta no es OK. */
async function lmJsonOk(res: Response): Promise<any> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new LmApiError(res.status, data.error || `Legal Manager respondió ${res.status}`, data);
  return data;
}

/**
 * POST /solicitudes/{id}/cancelar — cancela en LM (deja de poder firmarse).
 * 200 {cancelada, ya_cancelada}. 409 si ya está completada o vencida (LmApiError).
 */
export async function lmCancelarSolicitud(
  solicitudId: string,
  motivo?: string,
): Promise<{ cancelada: boolean; ya_cancelada?: boolean }> {
  const res = await lmFetch(`/solicitudes/${solicitudId}/cancelar`, {
    method: "POST",
    body: JSON.stringify(motivo ? { motivo } : {}),
  });
  return lmJsonOk(res);
}

/**
 * POST /solicitudes/{id}/recordatorio — LM reenvía por sus canales (WhatsApp +
 * correo) y lo deja en su traza. Sin firmante_id recuerda a los pendientes.
 * 409 ya firmó / no es su turno / doc no activo; 429 si pasó menos de 1 h.
 */
export async function lmEnviarRecordatorio(solicitudId: string, lmFirmanteId?: string): Promise<any> {
  const res = await lmFetch(`/solicitudes/${solicitudId}/recordatorio`, {
    method: "POST",
    body: JSON.stringify(lmFirmanteId ? { firmante_id: lmFirmanteId } : {}),
  });
  return lmJsonOk(res);
}

export type LmCanal = "email" | "whatsapp" | "sms";

/**
 * PATCH /solicitudes/{id}/firmantes/{firmanteId} — cambia correo, celular y/o
 * canales de un firmante que no ha firmado (no nombre ni cédula). Con
 * reenviar:true LM reenvía de inmediato si es su turno.
 * 422 datos inválidos; 409 ya firmó/rechazó o doc cerrado; 404 ajeno.
 */
export async function lmEditarFirmante(
  solicitudId: string,
  lmFirmanteId: string,
  cambios: { email?: string; telefono?: string; canales?: LmCanal[]; reenviar?: boolean },
): Promise<{
  firmante_id: string;
  email: string;
  telefono: string | null;
  canales: LmCanal[];
  reenvio?: Array<{ canal: string; ok: boolean; error?: string }> | null;
  reenvio_omitido?: string;
}> {
  const res = await lmFetch(`/solicitudes/${solicitudId}/firmantes/${lmFirmanteId}`, {
    method: "PATCH",
    body: JSON.stringify(cambios),
  });
  return lmJsonOk(res);
}

/**
 * POST /solicitudes/{id}/reactivar — nuevo plazo a una firma VENCIDA; conserva
 * las firmas hechas y reenvía a quienes faltan. 409 si no está vencida, si fue
 * cancelada o si alguien rechazó; 422 si dias_expiracion no está entre 1 y 90.
 */
export async function lmReactivarSolicitud(
  solicitudId: string,
  diasExpiracion?: number,
): Promise<{ solicitud_id: string; estado: string; fecha_expiracion: string; firmas_conservadas: number; reenvios: any }> {
  const res = await lmFetch(`/solicitudes/${solicitudId}/reactivar`, {
    method: "POST",
    body: JSON.stringify(diasExpiracion ? { dias_expiracion: diasExpiracion } : {}),
  });
  return lmJsonOk(res);
}

/** GET /solicitudes/{id}/constancia-entrega — PDF de evidencia técnica de entrega (Response cruda). */
export async function lmDescargarConstancia(solicitudId: string): Promise<Response> {
  return lmFetch(`/solicitudes/${solicitudId}/constancia-entrega`, { method: "GET" });
}

/**
 * Verifica la firma HMAC de un webhook de LM + anti-replay.
 * Firma = HMAC_SHA256(WEBHOOK_SECRET, "<timestamp>.<raw_body>").
 * Rechaza si el timestamp tiene más de 5 minutos (anti-replay).
 *
 * @param rawBody  el cuerpo crudo (NO el JSON parseado)
 * @param signature header X-LM-Signature ("sha256=<hex>")
 * @param timestamp header X-LM-Timestamp (epoch en segundos)
 */
export function lmVerificarWebhook(
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
): { ok: boolean; error?: string } {
  if (!WEBHOOK_SECRET) return { ok: false, error: "no_secret" };
  if (!signature || !timestamp) return { ok: false, error: "missing_headers" };

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
    return { ok: false, error: "stale" };
  }

  const esperado = "sha256=" + createHmac("sha256", WEBHOOK_SECRET).update(`${timestamp}.${rawBody}`).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, error: "bad_signature" };
  }
  return { ok: true };
}
