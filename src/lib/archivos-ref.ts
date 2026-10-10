// src/lib/archivos-ref.ts
// Referencias a archivos del bucket "sgcc-documents" (PRIVADO desde la
// migración 052). En BD quedan URLs públicas viejas
// (https://<ref>.supabase.co/storage/v1/object/public/sgcc-documents/<path>)
// o paths; nunca se abren directo: siempre por el proxy /api/archivo.
// Puro y sin imports de servidor: se puede usar en componentes cliente.

export const DOCS_BUCKET = "sgcc-documents";
const MARCADOR = `/${DOCS_BUCKET}/`;

/**
 * Path dentro de sgcc-documents a partir de lo que haya en BD (URL pública,
 * URL firmada o path). null si es otra cosa: URL externa (LM, Zoom…),
 * ruta relativa /api/..., vacío o un path con "..".
 */
export function pathDeArchivo(ref: string | null | undefined): string | null {
  if (!ref) return null;
  let path: string;
  if (/^https?:\/\//i.test(ref)) {
    const i = ref.indexOf("/storage/v1/object/");
    const j = i >= 0 ? ref.indexOf(MARCADOR, i) : -1;
    if (j < 0) return null;
    path = ref.slice(j + MARCADOR.length).split(/[?#]/)[0];
    try {
      path = decodeURIComponent(path);
    } catch {
      return null;
    }
  } else if (ref.startsWith("/")) {
    return null;
  } else {
    path = ref;
  }
  const seg = path.split("/");
  if (seg.length < 2 || seg.some((s) => s === "" || s === "." || s === "..")) return null;
  return path;
}

/**
 * href para mostrar/descargar un archivo guardado. Archivos de sgcc-documents
 * → proxy autenticado; cualquier otra URL (externa, /api/...) se devuelve igual.
 * `descargarComo`: fuerza descarga con ese nombre (el atributo `download` del
 * <a> no sirve tras el redirect a otro dominio).
 */
export function archivoHref(ref: string | null | undefined, descargarComo?: string): string | null {
  const path = pathDeArchivo(ref);
  if (!path) return ref ?? null;
  const q = descargarComo ? `&descargar=${encodeURIComponent(descargarComo)}` : "";
  return `/api/archivo?path=${encodeURIComponent(path)}${q}`;
}
