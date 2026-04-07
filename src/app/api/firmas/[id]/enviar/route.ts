import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/firmas/[id]/enviar
 * Enviar documento a firmantes. Auth required.
 * Si orden_secuencial: envía solo al primer pendiente.
 * Si no: envía a todos los pendientes.
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
      firmantes:sgcc_firmantes(id, nombre, email, token, orden, estado)
    `)
    .eq("id", id)
    .eq("center_id", centerId)
    .single();

  if (!documento) {
    return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  }

  // Filtrar firmantes pendientes
  const pendientes = (documento.firmantes ?? [])
    .filter((f: any) => f.estado === "pendiente")
    .sort((a: any, b: any) => a.orden - b.orden);

  if (!pendientes.length) {
    return NextResponse.json({ error: "No hay firmantes pendientes" }, { status: 400 });
  }

  // Si es secuencial, solo el primero
  const aEnviar = documento.orden_secuencial ? [pendientes[0]] : pendientes;
  const enviados: string[] = [];

  for (const firmante of aEnviar) {
    const linkFirma = `${APP_URL}/firmar/${firmante.token}`;

    try {
      await resend.emails.send({
        from: "SGCC <notificaciones@sgcc.app>",
        to: firmante.email,
        subject: `Documento pendiente de firma: ${documento.nombre}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background:#0D2340;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
              <h2 style="color:white;margin:0;">Firma Electrónica — SGCC</h2>
            </div>
            <div style="padding: 24px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
              <p>Estimado/a <strong>${firmante.nombre}</strong>,</p>
              <p>Se le ha enviado un documento para firma electrónica:</p>
              <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <p style="margin: 4px 0;"><strong>Documento:</strong> ${documento.nombre}</p>
                ${documento.descripcion ? `<p style="margin: 4px 0;"><strong>Descripción:</strong> ${documento.descripcion}</p>` : ""}
              </div>
              <p>Para revisar y firmar el documento, haga clic en el siguiente enlace:</p>
              <div style="text-align: center; margin: 24px 0;">
                <a href="${linkFirma}" style="display: inline-block; padding: 12px 32px; background: #0D2340; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
                  Firmar Documento
                </a>
              </div>
              <p style="color: #6b7280; font-size: 14px;">
                Este enlace es personal e intransferible. No lo comparta con terceros.
                ${documento.fecha_expiracion ? `<br>Expira el: ${new Date(documento.fecha_expiracion).toLocaleDateString("es-CO")}` : ""}
              </p>
            </div>
          </div>
        `,
      });

      // Actualizar estado del firmante
      await supabaseAdmin
        .from("sgcc_firmantes")
        .update({ estado: "enviado", enviado_at: new Date().toISOString() })
        .eq("id", firmante.id);

      enviados.push(firmante.id);

      // Registrar en audit trail
      await supabaseAdmin.from("sgcc_firma_registros").insert({
        firma_documento_id: id,
        firmante_id: firmante.id,
        accion: "enviado",
        ip: req.headers.get("x-forwarded-for") || "unknown",
        user_agent: req.headers.get("user-agent") || "unknown",
        metadatos: { email: firmante.email },
      });
    } catch (err: any) {
      console.error(`Error enviando a ${firmante.email}:`, err.message);
    }
  }

  // Actualizar estado del documento
  if (enviados.length > 0) {
    await supabaseAdmin
      .from("sgcc_firma_documentos")
      .update({ estado: "enviado" })
      .eq("id", id);
  }

  return NextResponse.json({
    ok: true,
    enviados: enviados.length,
    total_pendientes: pendientes.length,
  });
}
