import { supabaseAdmin } from "./supabase";
import { sumarDiasHabiles } from "./dias-habiles-colombia";

/**
 * Resuelve el centerId del staff autenticado.
 * Solo para uso server-side.
 */
export function resolveCenterId(session: any): string | null {
  return (session?.user?.centerId as string) ?? null;
}

/**
 * Verifica que el staff sea admin del centro.
 */
export function isAdmin(session: any): boolean {
  return (session?.user?.sgccRol as string) === "admin";
}

/**
 * Genera el siguiente número de radicado para un centro en el año actual.
 * Formato: YYYY-NNNN (ej: 2025-0042)
 */
export async function generateRadicado(centerId: string): Promise<string> {
  const year = new Date().getFullYear();

  // Contar casos del año actual para este centro
  const { count } = await supabaseAdmin
    .from("sgcc_cases")
    .select("*", { count: "exact", head: true })
    .eq("center_id", centerId)
    .like("numero_radicado", `${year}-%`);

  const seq = (count ?? 0) + 1;
  return `${year}-${String(seq).padStart(4, "0")}`;
}

/**
 * Suma dias habiles a una fecha.
 * Usa el motor de dias habiles de Colombia que incluye festivos
 * y la Ley Emiliani (Ley 51 de 1983).
 */
export function addBusinessDays(date: Date, days: number): Date {
  return sumarDiasHabiles(date, days);
}
