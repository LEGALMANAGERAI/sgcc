import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/firmas/[id]/recordatorio
 * Enviar recordatorio a firmantes pendientes. Auth required.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id } = await params;

  // Obtener documento con firmantes
  const { data: documento } = await supabaseAdmin
    .from("sgcc_firma_documentos")
    .select(`
      *,
      firmantes:sgcc_firmantes(id, nombre, email, token, estado)
    `)
    .eq("id", id)
    .eq("center_id", centerId)
    .single();

  if (!documento) {
    return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  }

  // Filtrar firmantes con estado "enviado" o "visto"
  const pendientes = (documento.firmantes ?? []).filter(
    (f: any) => f.estado === "enviado" || f.estado === "visto"
  );

  if (!pendientes.length) {
    return NextResponse.json({ error: "No hay firmantes pendientes de recordatorio" }, { status: 400 });
  }

  let enviados = 0;

  for (const firmante of pendientes) {
    const linkFirma = `${APP_URL}/firmar/${firmante.token}`;

    try {
      await resend.emails.send({
        from: "SGCC <notificaciones@sgcc.app>",
        to: firmante.email,
        subject: `Recordatorio: Documento pendiente de firma - ${documento.nombre}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background:#0D2340;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
              <h2 style="color:white;margin:0;">Recordatorio — Firma Electrónica</h2>
            </div>
            <div style="padding: 24px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
              <p>Estimado/a <strong>${firmante.nombre}</strong>,</p>
              <p>Le recordamos que tiene un documento pendiente de firma electrónica:</p>
              <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #f59e0b;">
                <p style="margin: 4px 0;"><strong>Documento:</strong> ${documento.nombre}</p>
                ${documento.fecha_expiracion ? `<p style="margin: 4px 0;"><strong>Expira:</strong> ${new Date(documento.fecha_expiracion).toLocaleDateString("es-CO")}</p>` : ""}
              </div>
              <div style="text-align: center; margin: 24px 0;">
                <a href="${linkFirma}" style="display: inline-block; padding: 12px 32px; background: #0D2340; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
                  Firmar Documento
                </a>
              </div>
              <p style="color: #6b7280; font-size: 14px;">Este enlace es personal e intransferible.</p>
            </div>
          </div>
        `,
      });

      // Registrar recordatorio
      await supabaseAdmin.from("sgcc_firma_recordatorios").insert({
        firma_documento_id: id,
        firmante_id: firmante.id,
        canal: "email",
        enviado_at: new Date().toISOString(),
      });

      // Registrar en audit trail
      await supabaseAdmin.from("sgcc_firma_registros").insert({
        firma_documento_id: id,
        firmante_id: firmante.id,
        accion: "recordatorio_enviado",
        ip: req.headers.get("x-forwarded-for") || "unknown",
        user_agent: req.headers.get("user-agent") || "unknown",
      });

      enviados++;
    } catch (err: any) {
      console.error(`Error enviando recordatorio a ${firmante.email}:`, err.message);
    }
  }

  return NextResponse.json({ ok: true, enviados });
}
