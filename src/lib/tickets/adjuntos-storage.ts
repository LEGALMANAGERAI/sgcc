// src/lib/tickets/adjuntos-storage.ts
// Subida de adjuntos de tickets al bucket PRIVADO "sgcc-tickets".
// La columna `url` guarda el proxy autenticado /api/tickets/adjuntos/<id>,
// nunca una URL pública de Storage. El límite de 5 por ticket lo garantiza
// el trigger de la migración 050 (atómico); el conteo previo es solo para
// no subir el archivo en vano.

import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { detectarMimeAdjunto, extensionAdjunto } from "./adjunto-archivo";

export const TICKETS_BUCKET = "sgcc-tickets";
export const MAX_ADJUNTO_BYTES = 10 * 1024 * 1024;
export const MAX_ADJUNTOS = 5;
// Debe coincidir con el RAISE de sgcc_ticket_adjuntos_limite() (migración 050).
const ERROR_LIMITE_BD = "MAX_ADJUNTOS_TICKET";

export const urlProxyAdjunto = (id: string) => `/api/tickets/adjuntos/${id}`;

type Resultado =
  | { data: Record<string, unknown>; error?: never }
  | { error: string; status: number; data?: never };

const errorLimite = (): Resultado => ({
  error: `Máximo ${MAX_ADJUNTOS} adjuntos por ticket`,
  status: 400,
});

export async function guardarAdjuntoTicket(opts: {
  ticketId: string;
  centerId: string;
  file: File;
  subidoPor: { party: string } | { staff: string };
}): Promise<Resultado> {
  const { ticketId, centerId, file, subidoPor } = opts;

  const { count } = await supabaseAdmin
    .from("sgcc_ticket_adjuntos")
    .select("id", { count: "exact", head: true })
    .eq("ticket_id", ticketId);
  if ((count ?? 0) >= MAX_ADJUNTOS) return errorLimite();

  if (file.size > MAX_ADJUNTO_BYTES) {
    return { error: "Archivo excede 10 MB", status: 413 };
  }

  const body = Buffer.from(await file.arrayBuffer());
  const mime = detectarMimeAdjunto(body);
  if (!mime) {
    return { error: "Tipo no permitido (PDF, JPG, PNG, WebP)", status: 415 };
  }

  const id = randomUUID();
  const storagePath = `tickets/${centerId}/${ticketId}/${id}.${extensionAdjunto(mime)}`;

  const { error: upErr } = await supabaseAdmin.storage
    .from(TICKETS_BUCKET)
    .upload(storagePath, body, { contentType: mime, upsert: false });
  if (upErr) return { error: `Error subiendo archivo: ${upErr.message}`, status: 500 };

  const { data, error } = await supabaseAdmin
    .from("sgcc_ticket_adjuntos")
    .insert({
      id,
      ticket_id: ticketId,
      nombre_archivo: file.name.slice(0, 200),
      storage_path: storagePath,
      url: urlProxyAdjunto(id),
      mime_type: mime,
      tamano_bytes: file.size,
      subido_por_party: "party" in subidoPor ? subidoPor.party : null,
      subido_por_staff: "staff" in subidoPor ? subidoPor.staff : null,
    })
    .select()
    .single();

  if (error) {
    // No dejar el archivo huérfano en Storage si la fila no entró.
    await supabaseAdmin.storage.from(TICKETS_BUCKET).remove([storagePath]).catch(() => {});
    if (error.message.includes(ERROR_LIMITE_BD)) return errorLimite();
    return { error: error.message, status: 500 };
  }
  return { data };
}
