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
  canal?: "email" | "sms" | "whatsapp";
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

class LmApiError extends Error {
  constructor(public status: number, message: string) {
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
