/**
 * Helpers de cliente (browser) para subir poderes via signed URL.
 *
 * Flujo:
 *   1. POST /api/poderes/upload-url con { mimeType, sizeBytes } -> { signedUrl, path }
 *   2. PUT al signedUrl con el archivo -> Supabase Storage lo recibe directo
 *   3. El backend del endpoint que cree el case_attorney mueve el archivo de
 *      tmp/ al path final.
 */

export interface UploadPoderResult {
  /** Path en bucket "poderes" (formato: "tmp/<uuid>.pdf") */
  path: string;
}

export async function uploadPoderViaSignedUrl(file: File): Promise<UploadPoderResult> {
  if (file.type !== "application/pdf") {
    throw new Error(`El archivo "${file.name}" debe ser PDF (tipo recibido: ${file.type})`);
  }

  const urlRes = await fetch("/api/poderes/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mimeType: file.type, sizeBytes: file.size }),
  });

  if (!urlRes.ok) {
    const data = await urlRes.json().catch(() => ({}));
    throw new Error(data?.error ?? `No se pudo generar URL de subida (HTTP ${urlRes.status})`);
  }

  const { signedUrl, path } = await urlRes.json();
  if (!signedUrl || !path) {
    throw new Error("Respuesta invalida de upload-url");
  }

  const uploadRes = await fetch(signedUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/pdf" },
    body: file,
  });

  if (!uploadRes.ok) {
    throw new Error(`No se pudo subir el archivo a Supabase (HTTP ${uploadRes.status})`);
  }

  return { path };
}
