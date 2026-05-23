import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { Resend } from "resend";
import { lmConfigured, lmCrearSolicitud } from "@/lib/firma/lm-client";

function getResend() { return new Resend(process.env.RESEND_API_KEY || "re_placeholder"); }
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

type Params = { params: Promise<{ id: string }> };

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

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
      firmantes:sgcc_firmantes(id, nombre, cedula, email, telefono, token, orden, estado, lm_firmante_id, lm_signing_url)
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

  // ─── Proveedor Legal Manager (redirect) ──────────────────────────────
  if (documento.proveedor === "lm") {
    return enviarViaLM(req, id, centerId, documento);
  }

  // Si es secuencial, solo el primero
  const aEnviar = documento.orden_secuencial ? [pendientes[0]] : pendientes;
  const enviados: string[] = [];

  for (const firmante of aEnviar) {
    const linkFirma = `${APP_URL}/firmar/${firmante.token}`;

    try {
      await getResend().emails.send({
        from: "SIGECC <notificaciones@sgcc.app>",
        to: firmante.email,
        subject: `Documento pendiente de firma: ${documento.nombre}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background:#0D2340;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
              <h2 style="color:white;margin:0;">Firma Electrónica — SIGECC</h2>
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

/**
 * Flujo de envío vía Legal Manager (proveedor "lm"):
 *  1. Si aún no existe solicitud en LM, genera una signed URL del PDF, crea la
 *     solicitud en LM y persiste solicitud_id + signing_url por firmante.
 *  2. Envía a cada firmante pendiente un correo con su signing_url (portal LM).
 */
async function enviarViaLM(
  req: NextRequest,
  docId: string,
  centerId: string,
  documento: any,
): Promise<NextResponse> {
  if (!lmConfigured()) {
    return NextResponse.json(
      { error: "La firma con Legal Manager no está configurada (faltan credenciales del partner)." },
      { status: 503 },
    );
  }

  const firmantes: any[] = documento.firmantes ?? [];

  // 1) Crear la solicitud en LM si no existe aún.
  if (!documento.lm_solicitud_id) {
    // Signed URL del PDF para que LM lo descargue (válida 1h).
    const storagePath = `firmas/${centerId}/${docId}.pdf`;
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("sgcc-documents")
      .createSignedUrl(storagePath, 3600);
    if (signErr || !signed?.signedUrl) {
      return NextResponse.json({ error: "No se pudo preparar el documento para Legal Manager." }, { status: 500 });
    }

    let resp;
    try {
      resp = await lmCrearSolicitud({
        centro_id: centerId,
        external_solicitud_id: docId,
        nombre: documento.nombre,
        documento_url: signed.signedUrl,
        firmantes: firmantes.map((f) => ({
          nombre: f.nombre,
          cedula: f.cedula,
          email: f.email,
          telefono: f.telefono,
          orden: f.orden,
        })),
        orden_secuencial: documento.orden_secuencial,
        dias_expiracion: documento.dias_expiracion,
        return_url: `${APP_URL}/firma/retorno`,
        webhook_url: `${APP_URL}/api/firmar/webhook-lm`,
      });
    } catch (err: any) {
      return NextResponse.json({ error: err?.message || "Error al crear la solicitud en Legal Manager." }, { status: 502 });
    }

    // Persistir solicitud_id en el documento.
    await supabaseAdmin
      .from("sgcc_firma_documentos")
      .update({ lm_solicitud_id: resp.solicitud_id })
      .eq("id", docId);
    documento.lm_solicitud_id = resp.solicitud_id;

    // Mapear cada signing_url al firmante de SIGECC (por nombre, fallback posicional).
    resp.firmantes.forEach((lmF, idx) => {
      const match =
        firmantes.find((f) => norm(f.nombre) === norm(lmF.nombre) && !f.lm_firmante_id) ??
        firmantes[idx];
      if (match) {
        match.lm_firmante_id = lmF.firmante_id;
        match.lm_signing_url = lmF.signing_url;
      }
    });
    for (const f of firmantes) {
      if (f.lm_signing_url) {
        await supabaseAdmin
          .from("sgcc_firmantes")
          .update({ lm_firmante_id: f.lm_firmante_id, lm_signing_url: f.lm_signing_url })
          .eq("id", f.id);
      }
    }
  }

  // 2) Enviar el signing_url a cada firmante pendiente (todos, o el primero si es secuencial).
  const pendientes = firmantes
    .filter((f) => f.estado === "pendiente" && f.lm_signing_url)
    .sort((a, b) => a.orden - b.orden);
  const aEnviar = documento.orden_secuencial ? pendientes.slice(0, 1) : pendientes;
  const enviados: string[] = [];

  for (const firmante of aEnviar) {
    try {
      await getResend().emails.send({
        from: "SIGECC <notificaciones@sgcc.app>",
        to: firmante.email,
        subject: `Documento pendiente de firma: ${documento.nombre}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background:#0D2340;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
              <h2 style="color:white;margin:0;">Firma Electrónica</h2>
            </div>
            <div style="padding: 24px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
              <p>Estimado/a <strong>${firmante.nombre}</strong>,</p>
              <p>Tiene un documento pendiente de firma: <strong>${documento.nombre}</strong>.</p>
              <p>La firma se realiza de forma segura en el portal de <strong>Legal Manager</strong>:</p>
              <div style="text-align: center; margin: 24px 0;">
                <a href="${firmante.lm_signing_url}" style="display: inline-block; padding: 12px 32px; background: #0D2340; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
                  Firmar en Legal Manager
                </a>
              </div>
              <p style="color: #6b7280; font-size: 14px;">Este enlace es personal e intransferible. No lo comparta con terceros.</p>
            </div>
          </div>
        `,
      });

      await supabaseAdmin
        .from("sgcc_firmantes")
        .update({ estado: "enviado", enviado_at: new Date().toISOString() })
        .eq("id", firmante.id);
      enviados.push(firmante.id);

      await supabaseAdmin.from("sgcc_firma_registros").insert({
        firma_documento_id: docId,
        firmante_id: firmante.id,
        accion: "enviado",
        ip: req.headers.get("x-forwarded-for") || "unknown",
        user_agent: req.headers.get("user-agent") || "unknown",
        metadatos: { email: firmante.email, proveedor: "lm" },
      });
    } catch (err: any) {
      console.error(`Error enviando (LM) a ${firmante.email}:`, err.message);
    }
  }

  if (enviados.length > 0) {
    await supabaseAdmin.from("sgcc_firma_documentos").update({ estado: "enviado" }).eq("id", docId);
  }

  return NextResponse.json({ ok: true, proveedor: "lm", enviados: enviados.length, total_pendientes: pendientes.length });
}
