import { supabaseAdmin } from "@/lib/supabase";

/**
 * Recalcula porcentaje_voto y es_pequeno_acreedor para TODAS las acreencias
 * de un caso. Llamar despues de cualquier operacion que cree/actualice/
 * elimine acreencias para no dejar marcas obsoletas.
 *
 * Pequeño acreedor — Art. 553 #8 Ley 2445/2025:
 *   Acreedores cuyo capital total acumulado no exceda el 5% del capital
 *   total reconocido. Se calcula por ACREEDOR (no por cada credito), por
 *   lo que se agrupan primero por documento normalizado, con fallback al
 *   documento del convocado vinculado y, en último caso, al party_id o
 *   al nombre normalizado. La marca se propaga a todas las acreencias del
 *   grupo para que coincida con la fila padre de la pantalla, que usa
 *   `every` y muestra "—" si no todas cumplen.
 */

/** Misma lógica que `normalizarDocumento` en HerramientaAcreencias.tsx:
 *  descarta puntos/espacios/guiones y, si hay un dígito de verificación al
 *  final del NIT (ej. "860.035.827-5"), lo elimina para que la versión con
 *  y sin VD agrupen al mismo acreedor. */
function normalizarDocumento(d: string | null | undefined): string {
  if (!d) return "";
  const trimmed = d.trim();
  const nitConVD = trimmed.match(/^([\d.\s]+)-(\d)\s*$/);
  const base = nitConVD ? nitConVD[1] : trimmed;
  return base.replace(/[^\dA-Za-z]/g, "").toUpperCase();
}

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

  // Resolver documento del party para acreencias importadas del convocado
  // sin `acreedor_documento` propio. Sin esto, esas acreencias agrupan por
  // party_id mientras que las manuales del mismo acreedor agrupan por
  // documento, y el grupo se rompe.
  const partyIds = Array.from(
    new Set(acreencias.map((a) => a.party_id).filter((x): x is string => !!x)),
  );
  const documentoPorParty = new Map<string, string>();
  if (partyIds.length > 0) {
    const { data: parties } = await supabaseAdmin
      .from("sgcc_parties")
      .select("id, numero_doc, nit_empresa")
      .in("id", partyIds);
    for (const p of parties ?? []) {
      const doc = (p.numero_doc as string | null) || (p.nit_empresa as string | null) || "";
      if (doc) documentoPorParty.set(p.id as string, doc);
    }
  }

  const totalCapital = acreencias.reduce(
    (s, a) => s + (Number(a.con_capital) || 0),
    0,
  );

  const updates = acreencias.map((a) => ({
    id: a.id,
    porcentaje_voto:
      totalCapital > 0
        ? Math.round((Number(a.con_capital) / totalCapital) * 10000) / 10000
        : 0,
  }));

  const grupoKeyDe = (a: typeof acreencias[number]): string => {
    const docDirecto = normalizarDocumento(a.acreedor_documento as string | null);
    const docDelParty = a.party_id
      ? normalizarDocumento(documentoPorParty.get(a.party_id as string) ?? null)
      : "";
    const docEfectivo = docDirecto || docDelParty;
    if (docEfectivo) return `d:${docEfectivo}`;
    if (a.party_id) return `p:${a.party_id}`;
    const nombreNorm = ((a.acreedor_nombre as string | null) ?? "").trim().toUpperCase();
    return `n:${nombreNorm || a.id}`;
  };

  const grupos = new Map<string, { capital: number; ids: string[] }>();
  for (const a of acreencias) {
    const key = grupoKeyDe(a);
    const cap = Number(a.con_capital) || 0;
    const g = grupos.get(key) ?? { capital: 0, ids: [] };
    g.capital += cap;
    g.ids.push(a.id as string);
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
