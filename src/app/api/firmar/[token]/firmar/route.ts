import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, uploadFile } from "@/lib/supabase";
import { calcularHashSHA256, sellarDocumento } from "@/lib/firma/pdf";
import { randomUUID } from "crypto";
import { Resend } from "resend";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
function getResend() { return new Resend(process.env.RESEND_API_KEY || "re_placeholder"); }

type Params = { params: Promise<{ token: string }> };

/**
 * POST /api/firmar/[token]/firmar
 * PÚBLICA - Ejecutar firma electrónica. Body: { foto_base64?: "data:image/jpeg;base64,..." }
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params;
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  // Obtener firmante por token
  const { data: firmante } = await supabaseAdmin
    .from("sgcc_firmantes")
    .select(`
      id, nombre, cedula, email, telefono, estado, firma_documento_id,
      documento:sgcc_firma_documentos(
        id, center_id, nombre, archivo_url, archivo_hash, estado,
        fecha_expiracion, total_firmantes, firmantes_completados, orden_secuencial
      )
    `)
    .eq("token", token)
    .single();

  if (!firmante) {
    return NextResponse.json({ error: "Token inválido" }, { status: 404 });
  }

  if (firmante.estado === "firmado") {
    return NextResponse.json({ error: "Ya fue firmado" }, { status: 400 });
  }

  if (firmante.estado === "rechazado") {
    return NextResponse.json({ error: "Fue rechazado" }, { status: 400 });
  }

  const documento = firmante.documento as any;

  // Verificar expiración
  if (documento?.fecha_expiracion && new Date(documento.fecha_expiracion) < new Date()) {
    return NextResponse.json({ error: "El documento ha expirado" }, { status: 400 });
  }

  // Verificar OTP verificado en últimos 15 minutos
  const quinceMinsAtras = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: otpRegistro } = await supabaseAdmin
    .from("sgcc_firma_registros")
    .select("id, created_at")
    .eq("firmante_id", firmante.id)
    .eq("accion", "otp_verificado")
    .gte("created_at", quinceMinsAtras)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!otpRegistro) {
    return NextResponse.json(
      { error: "Debe verificar su identidad con un código OTP antes de firmar" },
      { status: 400 }
    );
  }

  const body = await req.json();
  const { foto_base64 } = body;

  try {
    // Descargar PDF original de Supabase Storage
    const archivoUrl = documento.archivo_url as string;
    const storagePath = archivoUrl.split("/sgcc-documents/")[1];

    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from("sgcc-documents")
      .download(storagePath);

    if (downloadError || !fileData) {
      return NextResponse.json({ error: "Error descargando documento original" }, { status: 500 });
    }

    const pdfBuffer = Buffer.from(await fileData.arrayBuffer());

    // Verificar integridad del hash SHA-256
    const hashActual = calcularHashSHA256(pdfBuffer);
    if (hashActual !== documento.archivo_hash) {
      return NextResponse.json(
        { error: "El documento ha sido alterado. La integridad del hash no coincide." },
        { status: 400 }
      );
    }

    // Generar transactionId
    const docIdShort = documento.id.substring(0, 8);
    const uuidShort = randomUUID().substring(0, 18);
    const transactionId = `${docIdShort}-${uuidShort}`;

    const firmadoAt = new Date().toISOString();

    // Sellar documento PDF
    const pdfSellado = await sellarDocumento({
      pdfBuffer,
      firmante: {
        nombre: firmante.nombre,
        cedula: firmante.cedula,
        email: firmante.email,
        telefono: firmante.telefono ?? undefined,
      },
      fotoBase64: foto_base64,
      ip,
      transactionId,
      hashOriginal: documento.archivo_hash,
      canalOtp: "email",
      documentoId: documento.id,
      baseUrl: APP_URL,
    });

    // Subir PDF firmado a Storage
    const firmadoPath = `firmas/${documento.center_id}/${documento.id}_firmado.pdf`;
    const documentoFirmadoUrl = await uploadFile(
      pdfSellado,
      "sgcc-documents",
      firmadoPath,
      "application/pdf"
    );

    // Actualizar firmante: estado="firmado"
    await supabaseAdmin
      .from("sgcc_firmantes")
      .update({
        estado: "firmado",
        firmado_at: firmadoAt,
      })
      .eq("id", firmante.id);

    // Registrar "firmado" en audit trail
    await supabaseAdmin.from("sgcc_firma_registros").insert({
      firma_documento_id: documento.id,
      firmante_id: firmante.id,
      accion: "firmado",
      ip,
      user_agent: userAgent,
      hash_documento: hashActual,
      metadatos: {
        transaction_id: transactionId,
        firmado_at: firmadoAt,
        tiene_foto: !!foto_base64,
      },
    });

    // Verificar si todos los firmantes completaron
    const nuevosCompletados = (documento.firmantes_completados ?? 0) + 1;
    const todosCompletados = nuevosCompletados >= documento.total_firmantes;

    await supabaseAdmin
      .from("sgcc_firma_documentos")
      .update({
        firmantes_completados: nuevosCompletados,
        archivo_firmado_url: documentoFirmadoUrl,
        ...(todosCompletados ? { estado: "completado" } : { estado: "en_proceso" }),
      })
      .eq("id", documento.id);

    // Si es secuencial y no todos completaron, enviar al siguiente firmante
    if (!todosCompletados && documento.orden_secuencial) {
      const { data: siguienteFirmante } = await supabaseAdmin
        .from("sgcc_firmantes")
        .select("id, nombre, email, token")
        .eq("firma_documento_id", documento.id)
        .eq("estado", "pendiente")
        .order("orden", { ascending: true })
        .limit(1)
        .single();

      if (siguienteFirmante) {
        const linkFirma = `${APP_URL}/firmar/${siguienteFirmante.token}`;
        try {
          await getResend().emails.send({
            from: "SGCC <notificaciones@sgcc.app>",
            to: siguienteFirmante.email,
            subject: `Documento pendiente de firma — ${documento.nombre}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background:#0D2340;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
                  <h2 style="color:white;margin:0;">Firma Electrónica</h2>
                </div>
                <div style="padding: 24px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
                  <p>Estimado/a <strong>${siguienteFirmante.nombre}</strong>,</p>
                  <p>Es su turno de firmar el siguiente documento:</p>
                  <div style="background: #f0f9ff; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #1B4F9B;">
                    <p style="margin: 4px 0;"><strong>${documento.nombre}</strong></p>
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

          await supabaseAdmin
            .from("sgcc_firmantes")
            .update({ estado: "enviado", enviado_at: new Date().toISOString() })
            .eq("id", siguienteFirmante.id);

          await supabaseAdmin.from("sgcc_firma_registros").insert({
            firma_documento_id: documento.id,
            firmante_id: siguienteFirmante.id,
            accion: "enviado",
            ip: "system",
            user_agent: "auto-secuencial",
            metadatos: { trigger: "firma_completada_anterior" },
          });
        } catch (err: any) {
          console.error("Error enviando al siguiente firmante:", err.message);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      firmadoAt,
      ip,
      transactionId,
      documentoFirmadoUrl,
    });
  } catch (err: any) {
    console.error("Error ejecutando firma:", err);
    return NextResponse.json({ error: err.message || "Error ejecutando firma" }, { status: 500 });
  }
}
