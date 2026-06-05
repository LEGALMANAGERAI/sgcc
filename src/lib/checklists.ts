/**
 * Normaliza el campo `items` de una checklist a un arreglo.
 *
 * Contexto: la columna `items` de `sgcc_checklists` es jsonb. Algunos
 * registros heredados (sembrados por seed) guardaron el arreglo ya
 * serializado como string JSON (un escalar string dentro del jsonb), p.ej.
 * `"[{\"nombre\":\"...\"}]"` en vez de `[{...}]`. Al consumirlos en el
 * cliente, `items.map(...)` lanzaba "items.map is not a function" y tumbaba
 * la pestaña (Poderes/Admisión) y el panel de configuración.
 *
 * Esta función es defensiva: devuelve siempre un arreglo, parseando el
 * string si hace falta. Los routes de escritura (POST/PATCH) ya guardan
 * arreglos correctos; esto protege la lectura ante cualquier dato heredado.
 */
export function parseChecklistItems(items: unknown): any[] {
  if (Array.isArray(items)) return items;
  if (typeof items === "string") {
    try {
      const parsed = JSON.parse(items);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Devuelve una copia de la checklist con `items` normalizado a arreglo.
 * Útil para mapear listas de checklists antes de pasarlas a componentes.
 */
export function normalizeChecklist<T extends { items?: unknown }>(checklist: T): T {
  return { ...checklist, items: parseChecklistItems(checklist.items) };
}
