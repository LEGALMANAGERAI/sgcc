import { supabaseAdmin } from "./supabase";
import { Resend } from "resend";
import { randomUUID } from "crypto";
import type { NotifTipo } from "@/types";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY || "re_placeholder");
}

interface NotifyOptions {
  centerId: string;
  caseId?: string;
  tipo: NotifTipo;
  titulo: string;
  mensaje: string;
  recipients: Array<{ staffId?: string; partyId?: string; email?: string }>;
  canal?: "in_app" | "email" | "both";
  attachmentUrl?: string;
}

export async function notify(opts: NotifyOptions) {
  const canal = opts.canal ?? "both";

  for (const r of opts.recipients) {
    // 1. Notificación in-app
    if (canal === "in_app" || canal === "both") {
      await supabaseAdmin.from("sgcc_notifications").insert({
        id: randomUUID(),
        center_id: opts.centerId,
        case_id: opts.caseId ?? null,
        staff_id: r.staffId ?? null,
        party_id: r.partyId ?? null,
        tipo: opts.tipo,
        titulo: opts.titulo,
        mensaje: opts.mensaje,
        canal,
        email_enviado: false,
        leida: false,
        created_at: new Date().toISOString(),
      });
    }

    // 2. Email
    if ((canal === "email" || canal === "both") && r.email) {
      try {
        const result = await getResend().emails.send({
          from: "SGCC <notificaciones@sgcc.app>",
          to: r.email,
          subject: opts.titulo,
          html: buildEmailHtml(opts.titulo, opts.mensaje, opts.attachmentUrl),
        });

        if (result.data?.id && (r.staffId || r.partyId)) {
          await supabaseAdmin
            .from("sgcc_notifications")
            .update({ email_enviado: true, email_enviado_at: new Date().toISOString(), resend_id: result.data.id })
            .eq("center_id", opts.centerId)
            .eq("tipo", opts.tipo)
            .order("created_at", { ascending: false })
            .limit(1);
        }
      } catch (e) {
        console.error("Error enviando email:", e);
      }
    }
  }
}

function buildEmailHtml(titulo: string, mensaje: string, url?: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      <div style="background: #0D2340; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="color: white; margin: 0; font-size: 18px;">SGCC — Centro de Conciliación</h2>
      </div>
      <div style="background: #f9f9f9; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0; border-top: none;">
        <h3 style="color: #0D2340; margin-top: 0;">${titulo}</h3>
        <p style="white-space: pre-line; line-height: 1.6;">${mensaje}</p>
        ${url ? `<a href="${url}" style="display: inline-block; background: #B8860B; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; margin-top: 16px;">Ver documento</a>` : ""}
        <hr style="margin-top: 24px; border: none; border-top: 1px solid #e0e0e0;" />
        <p style="font-size: 12px; color: #888; margin-bottom: 0;">Este es un mensaje automático del Sistema de Gestión de Centros de Conciliación.</p>
      </div>
    </body>
    </html>
  `;
}
