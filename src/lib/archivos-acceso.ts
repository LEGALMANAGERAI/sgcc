// src/lib/archivos-acceso.ts
// Server-only: quién puede leer un archivo de sgcc-documents y descarga interna.
// Regla: staff → solo su centro (y solo casos visibles si es conciliador/asistente);
// parte → sus borradores de solicitud y los documentos de SUS casos con el mismo
// filtro que /mis-casos (tipos oficiales o subidos por ella).

import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId, puedeVerCaso } from "@/lib/server-utils";
import { DOCS_BUCKET, pathDeArchivo } from "@/lib/archivos-ref";

/** Tipos de sgcc_documents que una parte ve de su caso (además de los suyos). */
export const TIPOS_DOC_OFICIALES_PARTE = [
  "citacion",
  "acta_firmada",
  "constancia",
  "admision",
  "rechazo",
] as const;

// Carpetas cuyo 2º segmento es el center_id y el 3º el case_id.
const CON_CASO: Record<string, (seg: string[]) => string | undefined> = {
  centers: (s) => (s[2] === "cases" ? s[3] : undefined), // centers/{c}/cases/{case}/…
  sgcc: (s) => (s[2] === "casos" ? s[3] : undefined), // sgcc/{c}/casos/{case}/… (branding: sin caso)
  "sgcc-docs": (s) => s[2], // sgcc-docs/{c}/{case}/…
  autos: (s) => s[2], // autos/{c}/{case}/…
};
// Carpetas cuyo 2º segmento es el center_id, sin caso.
const SOLO_CENTRO = new Set(["firmas", "correspondencia", "plantillas", "reglamentos", "solicitudes"]);

const escaparLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Fila de sgcc_documents que apunta a este archivo (por storage_path o url). */
async function documentoDe(path: string) {
  const cols = "case_id, tipo, subido_por_party";
  const porPath = await supabaseAdmin
    .from("sgcc_documents")
    .select(cols)
    .eq("storage_path", path)
    .limit(1)
    .maybeSingle();
  if (porPath.data) return porPath.data;
  const porUrl = await supabaseAdmin
    .from("sgcc_documents")
    .select(cols)
    .like("url", `%/${DOCS_BUCKET}/${escaparLike(path)}`)
    .limit(1)
    .maybeSingle();
  return porUrl.data ?? null;
}

async function staffPuede(session: any, seg: string[], path: string): Promise<boolean> {
  const centerId = resolveCenterId(session);
  if (!centerId) return false;
  const [carpeta, c] = seg;

  if (carpeta in CON_CASO) {
    if (c !== centerId) return false;
    const caseId = CON_CASO[carpeta](seg);
    return caseId ? puedeVerCaso(session, centerId, caseId) : true;
  }
  if (SOLO_CENTRO.has(carpeta)) return c === centerId;

  // solicitudes-draft/{partyId}/…: el centro sale del caso al que se radicó.
  if (carpeta === "solicitudes-draft") {
    const doc = await documentoDe(path);
    if (!doc?.case_id) return false;
    const { data: caso } = await supabaseAdmin
      .from("sgcc_cases")
      .select("center_id")
      .eq("id", doc.case_id)
      .maybeSingle();
    return caso?.center_id === centerId && puedeVerCaso(session, centerId, doc.case_id);
  }
  return false;
}

async function partePuede(userId: string, seg: string[], path: string): Promise<boolean> {
  const [carpeta] = seg;
  if (carpeta === "solicitudes-draft") return seg[1] === userId;
  if (carpeta === "solicitudes") {
    const { data } = await supabaseAdmin
      .from("sgcc_solicitudes_draft")
      .select("id")
      .eq("id", seg[2])
      .eq("user_id", userId)
      .maybeSingle();
    return !!data;
  }
  const doc = await documentoDe(path);
  if (!doc?.case_id) return false;
  const esSuyo = doc.subido_por_party === userId;
  const esOficial = (TIPOS_DOC_OFICIALES_PARTE as readonly string[]).includes(doc.tipo);
  if (!esSuyo && !esOficial) return false;
  const { data: cp } = await supabaseAdmin
    .from("sgcc_case_parties")
    .select("id")
    .eq("case_id", doc.case_id)
    .eq("party_id", userId)
    .limit(1)
    .maybeSingle();
  return !!cp;
}

/** ¿Esta sesión puede leer el archivo `path` de sgcc-documents? */
export async function puedeLeerArchivo(session: any, path: string): Promise<boolean> {
  const user = session?.user as { id?: string; userType?: string } | undefined;
  if (!user?.id) return false;
  const seg = path.split("/");
  return user.userType === "party"
    ? partePuede(user.id, seg, path)
    : staffPuede(session, seg, path);
}

/** URL firmada corta para un path ya autorizado (`descargarComo` fuerza descarga). */
export async function urlFirmada(
  path: string,
  ttlSegundos = 60,
  descargarComo?: string,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage
    .from(DOCS_BUCKET)
    .createSignedUrl(path, ttlSegundos, descargarComo ? { download: descargarComo } : undefined);
  return error || !data ? null : data.signedUrl;
}

/**
 * Descarga interna (service_role) de un archivo guardado como URL pública o
 * path. Reemplaza los fetch(urlPublica), que fallan con el bucket privado.
 */
export async function descargarArchivo(
  ref: string | null | undefined,
): Promise<{ buffer: Buffer; contentType: string; nombre: string } | null> {
  const path = pathDeArchivo(ref);
  if (!path) return null;
  const { data, error } = await supabaseAdmin.storage.from(DOCS_BUCKET).download(path);
  if (error || !data) return null;
  return {
    buffer: Buffer.from(await data.arrayBuffer()),
    contentType: data.type || "application/octet-stream",
    nombre: path.slice(path.lastIndexOf("/") + 1),
  };
}
