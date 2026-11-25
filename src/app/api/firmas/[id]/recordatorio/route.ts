import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { enviarCorreo } from "@/lib/resend";
import { lmConfigured, lmEnviarRecordatorio, LmApiError } from "@/lib/firma/lm-client";

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
      firmantes:sgcc_firmantes(id, nombre, email, token, estado, lm_firmante_id)
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

  // En documentos LM decide LM (el estado local de firmantes secuenciales puede ir atrasado).
  if (!pendientes.length && documento.proveedor !== "lm") {
    return NextResponse.json({ error: "No hay firmantes pendientes de recordatorio" }, { status: 400 });
  }

  // Documentos de Legal Manager: LM recuerda a los pendientes (respeta el turno).
  if (documento.proveedor === "lm" && documento.lm_solicitud_id) {
    if (!lmConfigured()) {
      return NextResponse.json(
        { error: "La firma con Legal Manager no está configurada (faltan credenciales del partner)." },
        { status: 502 },
      );
    }
    try {
      await lmEnviarRecordatorio(documento.lm_solicitud_id);
    } catch (err: any) {
      if (err instanceof LmApiError && err.status === 429) {
        return NextResponse.json(
          { error: "Ya se envió un recordatorio hace menos de 1 hora. Intente más tarde." },
          { status: 429 },
        );
      }
      if (err instanceof LmApiError && err.status === 409) {
        return NextResponse.json(
          {
            error:
              err.message ||
              "Legal Manager no puede enviar el recordatorio: el firmante ya firmó, no es su turno o el documento no está activo.",
          },
          { status: 409 },
        );
      }
      console.error("Error enviando recordatorio en Legal Manager:", err?.message);
      return NextResponse.json(
        { error: `No se pudo enviar el recordatorio en Legal Manager: ${err?.message ?? "error desconocido"}` },
        { status: 502 },
      );
    }

    await supabaseAdmin.from("sgcc_firma_registros").insert({
      firma_documento_id: id,
      firmante_id: null,
      accion: "recordatorio_enviado",
      ip: req.headers.get("x-forwarded-for") || "unknown",
      user_agent: req.headers.get("user-agent") || "unknown",
      metadatos: { proveedor: "lm" },
    });

    return NextResponse.json({ ok: true, proveedor: "lm" });
  }

  let enviados = 0;

  for (const firmante of pendientes) {
    const linkFirma = `${APP_URL}/firmar/${firmante.token}`;

    try {
      await enviarCorreo({
        from: "SIGECC <notificaciones@sgcc.app>",
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
