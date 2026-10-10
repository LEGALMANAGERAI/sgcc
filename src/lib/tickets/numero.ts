// Etiqueta visible de un ticket: el consecutivo (SOP-0001…, migración 051) o,
// si aún no lo tiene, el UUID corto que se usaba antes.
export const etiquetaTicket = (t: { id: string; numero?: string | null }) =>
  t.numero ?? `#${t.id.slice(-6)}`;
