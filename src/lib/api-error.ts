/**
 * Extrae un mensaje de error útil de una respuesta HTTP que falló.
 *
 * Cubre los casos donde la respuesta NO es JSON válido (común cuando Vercel
 * rechaza el body por exceder 4.5 MB y devuelve una página HTML 413, o
 * cuando el proxy interrumpe la conexión y devuelve 502/504 sin cuerpo).
 */
export async function parseApiError(res: Response, fallback = "Error inesperado"): Promise<string> {
  try {
    const text = await res.text();
    if (!text) return `${res.status} — ${fallback}`;
    try {
      const json = JSON.parse(text);
      if (json && typeof json.error === "string") return json.error;
      if (json && typeof json.message === "string") return json.message;
    } catch {
      // No era JSON. Detectar errores típicos de plataforma:
      if (res.status === 413) {
        return "El archivo o el formulario es demasiado pesado (más de 4.5 MB). Intenta con un archivo más liviano o súbelo en partes.";
      }
      if (res.status === 502 || res.status === 504) {
        return `El servidor tardó demasiado en responder (${res.status}). Intenta de nuevo.`;
      }
      // Para 4xx/5xx con HTML, no mostrar el HTML al usuario.
      return `${res.status} — ${res.statusText || fallback}`;
    }
    return `${res.status} — ${fallback}`;
  } catch {
    return fallback;
  }
}

/** Tamaño máximo del body que Vercel acepta en serverless functions (4.5 MB). */
export const VERCEL_BODY_LIMIT_BYTES = 4.5 * 1024 * 1024;

/**
 * Devuelve un mensaje de error si el archivo supera el límite, o null si está OK.
 */
export function validarTamanoArchivo(file: File, etiqueta = "El archivo"): string | null {
  if (file.size > VERCEL_BODY_LIMIT_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return `${etiqueta} pesa ${mb} MB y excede el máximo permitido (4.5 MB). Comprime el PDF o súbelo en partes.`;
  }
  return null;
}
