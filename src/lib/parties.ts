import { supabaseAdmin } from "./supabase";
import { normalizeEmail } from "./normalize-email";
import { randomUUID } from "crypto";

/**
 * Helpers para crear/buscar `sgcc_parties` SIN reutilizar por email.
 *
 * Bug previo (ticket #209a34 de Caren): el codigo buscaba parties por email
 * y reutilizaba la primera coincidencia, sin validar nombre/documento. Como
 * los emails se comparten en la realidad colombiana (info@empresa.com,
 * secretaria@oficina.com), el sistema mostraba "nombres de personas de
 * otros casos".
 *
 * Solucion: identificar SIEMPRE por documento (NIT para juridicas,
 * tipo_doc + numero_doc para naturales). Si no hay documento, crear nueva
 * (no asumir email unico).
 */

export interface PartyInput {
  tipo_persona: "natural" | "juridica";
  nombres?: string | null;
  apellidos?: string | null;
  razon_social?: string | null;
  tipo_doc?: string | null;
  /** Para natural: cedula. Para juridica: NIT. */
  numero_doc?: string | null;
  email: string;
  telefono?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
}

export interface FindOrCreatePartyOptions {
  /** Centro al que se asocia la cuenta. Nullable para invitados sin centro fijo. */
  centerId?: string | null;
  /** Si true, agrega invite_token + invite_expires (flujo "invitado por staff"). */
  comoInvitado?: boolean;
}

export interface FindOrCreatePartyResult {
  partyId: string;
  /** true si se creo nueva, false si se reutilizo una existente. */
  created: boolean;
}

/**
 * Normaliza un documento para comparacion: quita espacios, puntos, guiones,
 * guion bajo y pasa a mayusculas. Tolera variaciones de formato (ej.
 * "1.234.567" vs "1234567" vs "1.234.567-8").
 */
export function normDoc(d: string | null | undefined): string {
  return (d ?? "").replace(/[\s.\-_]/g, "").toUpperCase();
}

/**
 * Busca una party por documento (con normalizacion). Si encuentra, devuelve
 * su id. Si no encuentra o no hay documento, crea una nueva.
 *
 * Nunca reutiliza por email. Nunca sobrescribe los datos de una party
 * existente (si ya estaba con un nombre/email, queda igual; el nuevo caso
 * solo se vincula).
 */
export async function findOrCreateParty(
  input: PartyInput,
  options: FindOrCreatePartyOptions = {},
): Promise<FindOrCreatePartyResult> {
  const docNumero = (input.numero_doc ?? "").trim();
  const docNorm = normDoc(docNumero);

  let existingId: string | null = null;

  if (docNorm) {
    if (input.tipo_persona === "juridica") {
      // Match exacto por NIT
      const { data: exact } = await supabaseAdmin
        .from("sgcc_parties")
        .select("id, nit_empresa")
        .eq("tipo_persona", "juridica")
        .eq("nit_empresa", docNumero)
        .maybeSingle();

      if (exact) {
        existingId = exact.id;
      } else {
        // Match por NIT normalizado (tolera "900.123.456-7" vs "900123456")
        const { data: candidates } = await supabaseAdmin
          .from("sgcc_parties")
          .select("id, nit_empresa")
          .eq("tipo_persona", "juridica")
          .not("nit_empresa", "is", null);
        const match = (candidates ?? []).find(
          (c: any) => normDoc(c.nit_empresa) === docNorm,
        );
        if (match) existingId = match.id;
      }
    } else {
      // Natural: match exacto por (tipo_doc, numero_doc)
      const { data: exact } = await supabaseAdmin
        .from("sgcc_parties")
        .select("id, numero_doc")
        .eq("tipo_persona", "natural")
        .eq("tipo_doc", input.tipo_doc ?? "CC")
        .eq("numero_doc", docNumero)
        .maybeSingle();

      if (exact) {
        existingId = exact.id;
      } else {
        // Match por documento normalizado dentro del mismo tipo_doc
        const { data: candidates } = await supabaseAdmin
          .from("sgcc_parties")
          .select("id, numero_doc")
          .eq("tipo_persona", "natural")
          .eq("tipo_doc", input.tipo_doc ?? "CC")
          .not("numero_doc", "is", null);
        const match = (candidates ?? []).find(
          (c: any) => normDoc(c.numero_doc) === docNorm,
        );
        if (match) existingId = match.id;
      }
    }
  }

  if (existingId) {
    return { partyId: existingId, created: false };
  }

  // No encontrada -> crear nueva. NO buscamos por email para evitar el bug
  // de mezclar personas con emails compartidos.
  const partyId = randomUUID();
  const now = new Date().toISOString();
  const partyEmail = normalizeEmail(input.email);

  const inviteFields = options.comoInvitado
    ? {
        invite_token: randomUUID(),
        invite_expires: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        invited_at: now,
      }
    : {};

  const newRow: Record<string, any> = {
    id: partyId,
    tipo_persona: input.tipo_persona,
    nombres: input.nombres || null,
    apellidos: input.apellidos || null,
    razon_social: input.razon_social || null,
    nit_empresa: input.tipo_persona === "juridica" ? docNumero || null : null,
    tipo_doc: input.tipo_persona === "natural" ? input.tipo_doc ?? "CC" : null,
    numero_doc: input.tipo_persona === "natural" ? docNumero || null : null,
    email: partyEmail,
    telefono: input.telefono || null,
    direccion: input.direccion || null,
    ciudad: input.ciudad || null,
    created_at: now,
    updated_at: now,
    ...inviteFields,
  };

  if (options.centerId !== undefined) {
    newRow.center_id = options.centerId;
  }

  const { error } = await supabaseAdmin.from("sgcc_parties").insert(newRow);
  if (error) {
    throw new Error(`No se pudo crear la parte: ${error.message}`);
  }

  return { partyId, created: true };
}
