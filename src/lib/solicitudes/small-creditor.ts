// src/lib/solicitudes/small-creditor.ts
// Art. 553 #8 Ley 2445/2025: los pequeños acreedores son los de menor cuantía
// cuya suma acumulada NO exceda el 5% del capital total reconocido en la
// relación definitiva. Cálculo determinístico ejecutado por el servidor.

import { UMBRAL_PEQUENO_ACREEDOR } from "./constants";

export interface AcreedorMinimo {
  id: string;
  capital: number;
}

export function calcularPequenosAcreedores<T extends AcreedorMinimo>(
  acreedores: T[]
): Array<T & { es_pequeno_acreedor: boolean }> {
  if (acreedores.length === 0) return [];

  const total = acreedores.reduce((s, a) => s + (a.capital || 0), 0);
  const umbral = total * UMBRAL_PEQUENO_ACREEDOR;

  const ordenados = [...acreedores].sort((a, b) => a.capital - b.capital);
  const pequenos = new Set<string>();
  let acumulado = 0;

  for (const a of ordenados) {
    if (acumulado + a.capital > umbral) break;
    acumulado += a.capital;
    pequenos.add(a.id);
  }

  return acreedores.map((a) => ({
    ...a,
    es_pequeno_acreedor: pequenos.has(a.id),
  }));
}
