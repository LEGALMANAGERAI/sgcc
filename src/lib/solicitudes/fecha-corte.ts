// Parágrafo 2 Art. 539 Ley 2445/2025:
// "La relación de acreedores y de bienes deberá hacerse con corte al último
// día calendario del mes inmediatamente anterior a aquel en que se presente
// la solicitud."

/** Devuelve el último día calendario del mes anterior a `ref` (default = hoy).  */
export function ultimoDiaMesAnterior(ref: Date = new Date()): Date {
  // `Date(year, month, 0)` = día 0 del mes `month` = último día del mes `month-1`.
  return new Date(ref.getFullYear(), ref.getMonth(), 0);
}

export function fechaCorteISO(ref: Date = new Date()): string {
  const d = ultimoDiaMesAnterior(ref);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatearFechaCorteLarga(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const meses = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  return `${d} de ${meses[m - 1]} de ${y}`;
}
