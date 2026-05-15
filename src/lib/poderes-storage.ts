import { supabaseAdmin } from "./supabase";

export const PODERES_BUCKET = "poderes";

export const PODERES_MAX_BYTES = 50 * 1024 * 1024;
export const PODERES_ALLOWED_MIME = ["application/pdf"];

// TTL largo para descargas: el usuario puede tener la pestaña abierta
// durante toda la jornada. Con 1 hora se vencían los links a media tarde
// y al hacer clic Storage respondía 404 / token inválido. 24h cubre
// cualquier sesión razonable sin recargar.
export const SIGNED_DOWNLOAD_TTL_SECONDS = 60 * 60 * 24;
export const SIGNED_UPLOAD_TTL_SECONDS = 60 * 5;

export function poderPath(caseId: string, caseAttorneyId: string): string {
  return `${caseId}/${caseAttorneyId}.pdf`;
}

export async function createSignedUploadUrl(
  path: string,
): Promise<{ signedUrl: string; token: string }> {
  const { data, error } = await supabaseAdmin.storage
    .from(PODERES_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    throw new Error(`No se pudo generar URL de subida: ${error?.message ?? "sin datos"}`);
  }

  return { signedUrl: data.signedUrl, token: data.token };
}

/**
 * Genera signed URL temporal para descargar el poder. Supabase firma
 * cualquier path (no valida existencia del archivo), así que primero
 * verificamos que el archivo exista listando la carpeta — esto evita
 * que la UI muestre "Ver" para poderes huérfanos que retornan 404 al
 * abrirse. Devuelve null si el archivo no existe.
 */
export async function createSignedDownloadUrl(
  path: string,
  ttlSeconds = SIGNED_DOWNLOAD_TTL_SECONDS,
): Promise<string | null> {
  if (!path) return null;

  const slash = path.lastIndexOf("/");
  const folder = slash >= 0 ? path.slice(0, slash) : "";
  const filename = slash >= 0 ? path.slice(slash + 1) : path;
  const { data: list, error: listErr } = await supabaseAdmin.storage
    .from(PODERES_BUCKET)
    .list(folder, { search: filename, limit: 1 });
  const existe = !listErr && Array.isArray(list) && list.some((f) => f.name === filename);
  if (!existe) return null;

  const { data, error } = await supabaseAdmin.storage
    .from(PODERES_BUCKET)
    .createSignedUrl(path, ttlSeconds);

  if (error || !data) return null;
  return data.signedUrl;
}

export async function signedDownloadUrlsBatch(
  paths: (string | null | undefined)[],
  ttlSeconds = SIGNED_DOWNLOAD_TTL_SECONDS,
): Promise<(string | null)[]> {
  return Promise.all(paths.map((p) => (p ? createSignedDownloadUrl(p, ttlSeconds) : Promise.resolve(null))));
}

export async function deletePoder(path: string): Promise<void> {
  if (!path) return;
  await supabaseAdmin.storage.from(PODERES_BUCKET).remove([path]).catch(() => {});
}

export function looksLikePoderPath(value: string | null | undefined): boolean {
  if (!value) return false;
  if (value.startsWith("http://") || value.startsWith("https://")) return false;
  return /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf$/i.test(value);
}

export function isTempPoderPath(value: string | null | undefined): boolean {
  return !!value && value.startsWith("tmp/") && value.endsWith(".pdf");
}

export async function verifyPoderIsPdf(path: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.storage.from(PODERES_BUCKET).download(path);
  if (error || !data) return false;
  const header = new Uint8Array(await data.slice(0, 5).arrayBuffer());
  return (
    header[0] === 0x25 &&
    header[1] === 0x50 &&
    header[2] === 0x44 &&
    header[3] === 0x46 &&
    header[4] === 0x2d
  );
}

export async function movePoderToFinal(
  tmpPath: string,
  caseId: string,
  caseAttorneyId: string,
): Promise<{ path: string } | { error: string }> {
  if (!isTempPoderPath(tmpPath)) {
    return { error: `Path de subida invalido: ${tmpPath}` };
  }

  const finalPath = poderPath(caseId, caseAttorneyId);

  const { error: moveErr } = await supabaseAdmin.storage
    .from(PODERES_BUCKET)
    .move(tmpPath, finalPath);

  if (moveErr) {
    return { error: `No se pudo mover el archivo: ${moveErr.message}` };
  }

  return { path: finalPath };
}
