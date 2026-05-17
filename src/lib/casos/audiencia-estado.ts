// src/lib/casos/audiencia-estado.ts
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Después de cambiar el estado de una audiencia, recalcula sgcc_cases.estado.
 *
 * Regla:
 * - Si el caso está en "audiencia" Y ya no quedan audiencias en estado
 *   "programada" o "en_curso", lo regresamos a "citado" (la audiencia se
 *   canceló o suspendió sin programar continuación, así que el caso ya
 *   no está "en audiencia").
 * - Si todavía hay audiencias activas (incluyendo la continuación recién
 *   programada por reagendamiento), se mantiene en "audiencia".
 *
 * "finalizada" no se considera aquí porque la finalización va seguida de
 * acta → cierre, que lo maneja otro flujo.
 */
export async function recomputeCaseEstadoTrasAudiencia(caseId: string): Promise<void> {
  const { data: caso } = await supabaseAdmin
    .from("sgcc_cases")
    .select("estado")
    .eq("id", caseId)
    .maybeSingle();
  if (!caso || caso.estado !== "audiencia") return;

  const { count } = await supabaseAdmin
    .from("sgcc_hearings")
    .select("id", { count: "exact", head: true })
    .eq("case_id", caseId)
    .in("estado", ["programada", "en_curso"]);

  if ((count ?? 0) === 0) {
    await supabaseAdmin
      .from("sgcc_cases")
      .update({ estado: "citado", updated_at: new Date().toISOString() })
      .eq("id", caseId);
  }
}
