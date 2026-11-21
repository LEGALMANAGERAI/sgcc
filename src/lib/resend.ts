import { Resend } from "resend";

type CorreoParams = Parameters<Resend["emails"]["send"]>[0];

/**
 * Envía un correo por Resend y LANZA si no se pudo: falta RESEND_API_KEY o
 * Resend respondió error. El SDK no lanza por sí solo (devuelve `{ error }`),
 * por eso antes los fallos pasaban en silencio.
 *
 * El cliente se crea al enviar (no al importar) para no romper el build de
 * Next, donde la variable no existe.
 *
 * @returns el resultado de Resend (`data.id` es el id del correo).
 */
export async function enviarCorreo(params: CorreoParams) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY no configurada: correo no enviado");
  const result = await new Resend(key).emails.send(params);
  if (result.error) throw new Error(`Resend: ${result.error.name} — ${result.error.message}`);
  return result;
}
