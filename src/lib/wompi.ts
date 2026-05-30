/**
 * Wompi — cliente y utilidades.
 *
 * Soporta:
 *  - Firma de integridad para el Widget Web (cobro inicial)
 *  - Verificación de firma en el webhook de eventos
 *  - Cobro recurrente server-side usando payment_source_id (tokenización)
 *  - Consulta de estado de transacción
 *
 * Variables de entorno esperadas:
 *  - WOMPI_ENV=sandbox|production (default: sandbox)
 *  - WOMPI_PUBLIC_KEY
 *  - WOMPI_PRIVATE_KEY
 *  - WOMPI_INTEGRITY_SECRET
 *  - WOMPI_EVENTS_SECRET
 */

import * as crypto from "crypto";

// ── Config ─────────────────────────────────────────────────────────────────

const WOMPI_BASE_URLS = {
  sandbox: "https://sandbox.wompi.co/v1",
  production: "https://production.wompi.co/v1",
} as const;

type WompiEnv = keyof typeof WOMPI_BASE_URLS;

function getEnv(name: string, opcional = false): string {
  const v = process.env[name];
  if (!v && !opcional) {
    throw new Error(`[wompi] falta variable de entorno ${name}`);
  }
  return v ?? "";
}

export function getWompiConfig() {
  const env = (process.env.WOMPI_ENV ?? "sandbox") as WompiEnv;
  if (!(env in WOMPI_BASE_URLS)) {
    throw new Error(`[wompi] WOMPI_ENV invalido: ${env}`);
  }
  return {
    env,
    baseUrl: WOMPI_BASE_URLS[env],
    publicKey: getEnv("WOMPI_PUBLIC_KEY"),
    privateKey: getEnv("WOMPI_PRIVATE_KEY"),
    integritySecret: getEnv("WOMPI_INTEGRITY_SECRET"),
    eventsSecret: getEnv("WOMPI_EVENTS_SECRET"),
  };
}

// ── Firmas ─────────────────────────────────────────────────────────────────

/**
 * Firma de integridad para el Widget Web de Wompi.
 * Concatena: reference + amountInCents + currency + integritySecret (y opcionalmente fecha de expiración).
 * Devuelve hash SHA-256 hex.
 */
export function generarFirmaIntegridad(params: {
  reference: string;
  amountInCents: number;
  currency: string;
  expirationTime?: string; // ISO 8601, opcional
}): string {
  const { integritySecret } = getWompiConfig();
  const { reference, amountInCents, currency, expirationTime } = params;
  const base = expirationTime
    ? `${reference}${amountInCents}${currency}${expirationTime}${integritySecret}`
    : `${reference}${amountInCents}${currency}${integritySecret}`;
  return crypto.createHash("sha256").update(base).digest("hex");
}

/**
 * Verifica la firma de un evento webhook de Wompi.
 *
 * Wompi envia en el body del evento un objeto:
 *   { event, data, signature: { properties, checksum }, timestamp, environment }
 *
 * El checksum se calcula concatenando los valores de las props listadas en
 * signature.properties (en orden) + timestamp + eventsSecret, luego SHA-256 hex.
 */
export function verificarFirmaEvento(body: unknown): boolean {
  const { eventsSecret } = getWompiConfig();
  const ev = body as WompiEvent;
  if (!ev?.signature?.checksum || !Array.isArray(ev.signature.properties) || !ev.timestamp) {
    return false;
  }
  // Las properties son rutas dentro de data, ej. "transaction.id", "transaction.status"
  const valores = ev.signature.properties.map((ruta) => getByPath(ev.data, ruta));
  const base = `${valores.join("")}${ev.timestamp}${eventsSecret}`;
  const hash = crypto.createHash("sha256").update(base).digest("hex");
  // Comparación en tiempo constante para evitar timing attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(ev.signature.checksum));
  } catch {
    return false;
  }
}

function getByPath(obj: unknown, ruta: string): string {
  const partes = ruta.split(".");
  let cur: unknown = obj;
  for (const p of partes) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return "";
    }
  }
  if (cur === null || cur === undefined) return "";
  return String(cur);
}

// ── Cliente HTTP ──────────────────────────────────────────────────────────

async function wompiFetch<T = unknown>(
  path: string,
  opts: { method?: "GET" | "POST"; body?: unknown; usePrivateKey?: boolean } = {}
): Promise<T> {
  const { baseUrl, privateKey, publicKey } = getWompiConfig();
  const key = opts.usePrivateKey ? privateKey : publicKey;
  const res = await fetch(`${baseUrl}${path}`, {
    method: opts.method ?? "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = (await res.json()) as T & { error?: { type?: string; reason?: string; messages?: unknown } };
  if (!res.ok) {
    const reason = data?.error?.reason || data?.error?.type || `HTTP ${res.status}`;
    throw new WompiError(reason, res.status, data);
  }
  return data;
}

export class WompiError extends Error {
  status: number;
  payload: unknown;
  constructor(msg: string, status: number, payload: unknown) {
    super(`[wompi] ${msg}`);
    this.name = "WompiError";
    this.status = status;
    this.payload = payload;
  }
}

// ── API pública ───────────────────────────────────────────────────────────

/**
 * Obtiene el acceptance_token del comercio (requerido para crear transacciones
 * recurrentes server-side).
 */
export async function getAcceptanceTokens(): Promise<{
  presigned_acceptance: { acceptance_token: string; permalink: string; type: string };
  presigned_personal_data_auth: { acceptance_token: string; permalink: string; type: string };
}> {
  const { publicKey, baseUrl } = getWompiConfig();
  const res = await fetch(`${baseUrl}/merchants/${publicKey}`);
  const json = await res.json();
  if (!res.ok) throw new WompiError("no se pudo obtener acceptance_token", res.status, json);
  return json.data;
}

/**
 * Consulta el estado de una transacción por su id.
 */
export async function getTransaction(transactionId: string): Promise<{ data: WompiTransaction }> {
  return wompiFetch<{ data: WompiTransaction }>(`/transactions/${transactionId}`);
}

/**
 * Consulta una transacción por su reference (la que generamos nosotros).
 */
export async function getTransactionByReference(reference: string): Promise<{ data: WompiTransaction[] }> {
  return wompiFetch<{ data: WompiTransaction[] }>(
    `/transactions?reference=${encodeURIComponent(reference)}`,
    { usePrivateKey: true }
  );
}

/**
 * Crea una transacción recurrente usando un payment_source_id previamente tokenizado.
 * Requiere llave PRIVADA. Devuelve la transacción creada (aún en PENDING — el estado
 * final llega por webhook).
 */
export async function crearCobroRecurrente(params: {
  amountInCents: number;
  currency: string;
  customerEmail: string;
  paymentSourceId: number;
  reference: string;
}): Promise<{ data: WompiTransaction }> {
  const tokens = await getAcceptanceTokens();
  return wompiFetch<{ data: WompiTransaction }>("/transactions", {
    method: "POST",
    usePrivateKey: true,
    body: {
      acceptance_token: tokens.presigned_acceptance.acceptance_token,
      accept_personal_auth: tokens.presigned_personal_data_auth.acceptance_token,
      amount_in_cents: params.amountInCents,
      currency: params.currency,
      customer_email: params.customerEmail,
      payment_source_id: params.paymentSourceId,
      reference: params.reference,
    },
  });
}

// ── Tipos ─────────────────────────────────────────────────────────────────

export type WompiTransactionStatus =
  | "PENDING"
  | "APPROVED"
  | "DECLINED"
  | "VOIDED"
  | "ERROR";

export interface WompiTransaction {
  id: string;
  created_at: string;
  finalized_at?: string | null;
  amount_in_cents: number;
  reference: string;
  customer_email: string;
  currency: string;
  payment_method_type?: string | null; // CARD | PSE | NEQUI | BANCOLOMBIA_TRANSFER
  payment_method?: {
    type?: string;
    extra?: {
      card_type?: string;
      brand?: string;
      last_four?: string;
      name?: string;
    };
  };
  payment_source_id?: number | null;
  status: WompiTransactionStatus;
  status_message?: string | null;
  redirect_url?: string | null;
}

export interface WompiEvent {
  event: string; // "transaction.updated" | "nequi_subscription.updated" | ...
  data: {
    transaction?: WompiTransaction;
    [k: string]: unknown;
  };
  environment: "test" | "prod";
  signature: {
    properties: string[];
    checksum: string;
  };
  timestamp: number;
  sent_at?: string;
}

// ── Helpers de negocio ────────────────────────────────────────────────────

/**
 * Genera una referencia única para Wompi (alfanumérica, <=64 chars).
 * Formato: SG-<centerCorto>-<planKey>-<periodo>-<timestamp>-<rand>
 */
export function generarReference(params: {
  centerId: string;
  planKey: string;
  periodo: "MENSUAL" | "ANUAL";
}): string {
  const ts = Date.now().toString(36);
  const rand = crypto.randomBytes(3).toString("hex");
  // Wompi permite [A-Za-z0-9\-_] hasta 64 chars. Usamos solo los primeros 8
  // chars del centerId (sin guiones) para dejar espacio a ts+rand.
  const centerCorto = params.centerId.replace(/-/g, "").slice(0, 8);
  const periodoCorto = params.periodo === "MENSUAL" ? "M" : "A";
  const raw = `SG-${centerCorto}-${params.planKey}-${periodoCorto}-${ts}-${rand}`;
  return raw.replace(/[^A-Za-z0-9\-_]/g, "").slice(0, 64);
}

/**
 * Convierte COP (pesos) a centavos (Wompi espera amount_in_cents).
 * Para COP, 1 peso = 100 centavos (aunque en Colombia no se usan centavos,
 * Wompi sigue el estándar internacional).
 */
export function copAPesosACentavos(pesosCOP: number): number {
  return Math.round(pesosCOP * 100);
}

/**
 * Calcula la próxima fecha de cobro según el periodo.
 */
export function calcularProximoCobro(periodo: "MENSUAL" | "ANUAL", desde = new Date()): Date {
  const d = new Date(desde);
  if (periodo === "MENSUAL") d.setMonth(d.getMonth() + 1);
  else d.setFullYear(d.getFullYear() + 1);
  return d;
}
