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
 * ¿El usuario staff está restringido a ver sólo sus propios casos?
 *
 * Regla: los conciliadores solo pueden ver expedientes donde están designados
 * como conciliador_id (o secretario_id), o donde tienen alguna audiencia
 * asignada. Admin y secretario del centro ven todos los casos del centro.
 */
export function staffSoloVeSusCasos(session: any): boolean {
  return (session?.user?.sgccRol as string) === "conciliador";
}

/**
 * Busca todos los staff_id del centro que coinciden con el email de la sesión
 * (case-insensitive). Cubre el caso de duplicados por capitalización del
 * email al crear la cuenta.
 */
async function staffIdsPorEmail(session: any, centerId: string): Promise<string[]> {
  const email = session?.user?.email as string | undefined;
  const sessionId = session?.user?.id as string | undefined;
  const ids = new Set<string>();
  if (sessionId) ids.add(sessionId);
  if (email) {
    const { data } = await supabaseAdmin
      .from("sgcc_staff")
      .select("id")
      .ilike("email", email)
      .eq("center_id", centerId)
      .eq("activo", true);
    for (const s of data ?? []) ids.add(s.id);
  }
  return Array.from(ids);
}

/**
 * Resuelve qué casos del centro puede ver el usuario.
 *
 *  - Admin/secretario → { modo: "todos" } (sin restricción).
 *  - Conciliador → { modo: "lista", caseIds }: la unión de
 *      · casos donde conciliador_id o secretario_id ∈ staffIds(email)
 *      · casos donde alguna audiencia tiene conciliador_id ∈ staffIds(email)
 *
 *    Esto cubre un bug previo donde al programar una audiencia con un
 *    conciliador no se sincronizaba sgcc_cases.conciliador_id.
 */
export async function resolverCasosVisiblesParaStaff(
  session: any,
  centerId: string,
): Promise<{ modo: "todos" } | { modo: "lista"; caseIds: string[] }> {
  if (!staffSoloVeSusCasos(session)) return { modo: "todos" };
  const misIds = await staffIdsPorEmail(session, centerId);
  if (misIds.length === 0) return { modo: "lista", caseIds: [] };

  const ids = new Set<string>();

  // Casos directos
  const orFilter = misIds
    .flatMap((id) => [`conciliador_id.eq.${id}`, `secretario_id.eq.${id}`])
    .join(",");
  const { data: directos } = await supabaseAdmin
    .from("sgcc_cases")
    .select("id")
    .eq("center_id", centerId)
    .or(orFilter);
  for (const c of directos ?? []) ids.add(c.id);

  // Casos indirectos vía audiencia
  const { data: viaHearings } = await supabaseAdmin
    .from("sgcc_hearings")
    .select("case_id, caso:sgcc_cases!inner(center_id)")
    .in("conciliador_id", misIds)
    .eq("caso.center_id", centerId);
  for (const h of viaHearings ?? []) if (h.case_id) ids.add(h.case_id);

  return { modo: "lista", caseIds: Array.from(ids) };
}

/**
 * Atajo para validar acceso a UN caso específico. Retorna true si el usuario
 * puede verlo. Usa la misma lógica de resolverCasosVisiblesParaStaff.
 */
export async function puedeVerCaso(session: any, centerId: string, caseId: string): Promise<boolean> {
  const v = await resolverCasosVisiblesParaStaff(session, centerId);
  if (v.modo === "todos") return true;
  return v.caseIds.includes(caseId);
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
