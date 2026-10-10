// src/lib/tickets/adjunto-archivo.ts
// Validación pura (sin I/O) de adjuntos de tickets: tipo real por magic bytes
// y extensión segura. No confía en file.type ni en el nombre del navegador.

export type MimeAdjunto = "application/pdf" | "image/jpeg" | "image/png" | "image/webp";

const EXT_POR_MIME: Record<MimeAdjunto, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const empiezaCon = (b: Uint8Array, firma: number[], offset = 0) =>
  b.length >= offset + firma.length && firma.every((x, i) => b[offset + i] === x);

/** Detecta el tipo real por la cabecera del archivo. null = no permitido. */
export function detectarMimeAdjunto(b: Uint8Array): MimeAdjunto | null {
  if (empiezaCon(b, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf"; // %PDF-
  if (empiezaCon(b, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (empiezaCon(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  // RIFF....WEBP
  if (empiezaCon(b, [0x52, 0x49, 0x46, 0x46]) && empiezaCon(b, [0x57, 0x45, 0x42, 0x50], 8)) {
    return "image/webp";
  }
  return null;
}

/**
 * Extensión para el path de storage: sale del tipo detectado (no del nombre),
 * así que siempre es [a-z0-9]{1,5}.
 */
export function extensionAdjunto(mime: MimeAdjunto): string {
  return EXT_POR_MIME[mime];
}
