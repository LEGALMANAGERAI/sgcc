import { normalizeEmail } from "@/lib/normalize-email";

/**
 * SuperAdmin del SaaS = dueño/operador de SIGECC, no un rol de centro.
 * No vive en BD: se controla por env var SUPERADMIN_EMAILS (CSV de correos).
 * Mantiene el mecanismo simple y sin migraciones — alcance solo-lectura
 * para visibilidad de centros suscritos y consumo agregado.
 */
function getAllowlist(): Set<string> {
  const raw = process.env.SUPERADMIN_EMAILS ?? "";
  const list = raw
    .split(/[,\s;]+/)
    // Tolerar que el valor venga con comillas envolventes (error comun al
    // pegar en el panel de Vercel) o comillas alrededor de cada correo.
    .map((e) => e.replace(/^["']+|["']+$/g, ""))
    .map((e) => normalizeEmail(e))
    .filter((e) => e.length > 0);
  return new Set(list);
}

/** Diagnostico no sensible: cuantos correos quedaron parseados de la env. */
export function superAdminAllowlistSize(): number {
  return getAllowlist().size;
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  const norm = normalizeEmail(email);
  if (!norm) return false;
  return getAllowlist().has(norm);
}

export function isSuperAdminSession(session: unknown): boolean {
  const email = (session as { user?: { email?: string | null } } | null | undefined)?.user?.email;
  return isSuperAdminEmail(email ?? null);
}
