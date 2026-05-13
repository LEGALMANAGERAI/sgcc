import { supabaseAdmin } from "@/lib/supabase";

/**
 * Recalcula porcentaje_voto y es_pequeno_acreedor para TODAS las acreencias
 * de un caso. Llamar despues de cualquier operacion que cree/actualice/
 * elimine acreencias para no dejar marcas obsoletas.
 *
 * Pequeño acreedor — Art. 553 #8 Ley 2445/2025:
 *   Acreedores cuyo capital total acumulado no exceda el 5% del capital
 *   total reconocido. Se calcula por ACREEDOR (no por cada credito), por
 *   lo que se agrupan primero por party_id o documento normalizado.
 */
export async function recalcularPorcentajesAcreencias(
  caseId: string,
  centerId: string,
): Promise<void> {
  const { data: acreencias } = await supabaseAdmin
    .from("sgcc_acreencias")
    .select("id, party_id, acreedor_documento, acreedor_nombre, con_capital")
    .eq("case_id", caseId)
    .eq("center_id", centerId);

  if (!acreencias || acreencias.length === 0) return;

  const totalCapital = acreencias.reduce((s, a) => s + (Number(a.con_capital) || 0), 0);

  const updates = acreencias.map((a) => ({
    id: a.id,
    porcentaje_voto:
      totalCapital > 0
        ? Math.round((Number(a.con_capital) / totalCapital) * 10000) / 10000
        : 0,
  }));

  const normDoc = (d: string | null | undefined) =>
    (d ?? "").replace(/[\s.\-_]/g, "").toUpperCase();

  const grupoKeyDe = (a: any): string => {
    if (a.party_id) return `p:${a.party_id}`;
    const doc = normDoc(a.acreedor_documento);
    if (doc) return `d:${doc}`;
    return `n:${(a.acreedor_nombre ?? "").trim().toUpperCase() || a.id}`;
  };

  const grupos = new Map<string, { capital: number; ids: string[] }>();
  for (const a of acreencias) {
    const key = grupoKeyDe(a);
    const cap = Number(a.con_capital) || 0;
    const g = grupos.get(key) ?? { capital: 0, ids: [] };
    g.capital += cap;
    g.ids.push(a.id);
    grupos.set(key, g);
  }

  const umbral5 = totalCapital * 0.05;
  const gruposOrdenados = Array.from(grupos.values()).sort(
    (a, b) => a.capital - b.capital,
  );

  let acumulado = 0;
  const pequenosIds = new Set<string>();
  for (const g of gruposOrdenados) {
    if (acumulado + g.capital > umbral5) break;
    acumulado += g.capital;
    for (const id of g.ids) pequenosIds.add(id);
  }

  for (const u of updates) {
    await supabaseAdmin
      .from("sgcc_acreencias")
      .update({
        porcentaje_voto: u.porcentaje_voto,
        es_pequeno_acreedor: pequenosIds.has(u.id),
      })
      .eq("id", u.id);
  }
}
