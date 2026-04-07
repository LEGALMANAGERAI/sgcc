import { createHash } from "crypto";

export function calcularHashSHA256(buffer: Buffer | ArrayBuffer): string {
  const buf = buffer instanceof ArrayBuffer ? Buffer.from(buffer) : buffer;
  return createHash("sha256").update(buf).digest("hex");
}

export async function sellarDocumento(opts: {
  pdfBuffer: Buffer;
  firmante: {
    nombre: string;
    cedula: string;
    email: string;
    telefono?: string;
  };
  fotoBase64?: string;
  ip: string;
  transactionId: string;
  hashOriginal: string;
  canalOtp: string;
  documentoId: string;
  baseUrl: string;
}): Promise<Buffer> {
  // Dynamic imports para que no falle el build si no están instalados
  const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");

  const pdfDoc = await PDFDocument.load(opts.pdfBuffer);

  // Agregar página de certificado al final
  const page = pdfDoc.addPage([595, 842]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const navy = rgb(13 / 255, 35 / 255, 64 / 255);
  const gold = rgb(184 / 255, 134 / 255, 11 / 255);
  const gray = rgb(0.4, 0.4, 0.4);
  const white = rgb(1, 1, 1);

  // Header
  page.drawRectangle({ x: 0, y: 770, width: 595, height: 72, color: navy });
  page.drawText("CERTIFICADO DE FIRMA ELECTRÓNICA", {
    x: 50,
    y: 800,
    size: 16,
    font: fontBold,
    color: white,
  });
  page.drawText(
    "Sistema de Gestión de Centros de Conciliación — SGCC",
    {
      x: 50,
      y: 782,
      size: 9,
      font,
      color: rgb(0.7, 0.7, 0.8),
    }
  );

  // Línea dorada
  page.drawRectangle({ x: 0, y: 768, width: 595, height: 3, color: gold });

  let y = 740;
  const lineHeight = 18;

  // Datos del firmante
  page.drawText("DATOS DEL FIRMANTE", {
    x: 50,
    y,
    size: 12,
    font: fontBold,
    color: navy,
  });
  y -= lineHeight * 1.5;

  const datos: [string, string][] = [
    ["Nombre:", opts.firmante.nombre],
    ["Cédula:", opts.firmante.cedula],
    ["Email:", opts.firmante.email],
    ["Teléfono:", opts.firmante.telefono ?? "No registrado"],
  ];

  for (const [label, value] of datos) {
    page.drawText(label, { x: 50, y, size: 10, font: fontBold, color: gray });
    page.drawText(value, { x: 150, y, size: 10, font, color: navy });
    y -= lineHeight;
  }

  y -= lineHeight;
  page.drawText("DATOS DE AUDITORÍA", {
    x: 50,
    y,
    size: 12,
    font: fontBold,
    color: navy,
  });
  y -= lineHeight * 1.5;

  const fechaColombia = new Date().toLocaleString("es-CO", {
    timeZone: "America/Bogota",
  });

  const auditoria: [string, string][] = [
    ["Fecha y hora:", fechaColombia],
    ["IP:", opts.ip],
    ["Transaction ID:", opts.transactionId],
    ["Hash SHA-256:", opts.hashOriginal.substring(0, 32) + "..."],
    ["Verificación OTP:", `Canal: ${opts.canalOtp}`],
  ];

  for (const [label, value] of auditoria) {
    page.drawText(label, { x: 50, y, size: 10, font: fontBold, color: gray });
    page.drawText(value, { x: 180, y, size: 10, font, color: navy });
    y -= lineHeight;
  }

  // QR Code
  y -= lineHeight;
  try {
    const QRCode = await import("qrcode");
    const qrUrl = `${opts.baseUrl}/verificar/${opts.documentoId}`;
    const qrBuffer = await QRCode.toBuffer(qrUrl, { width: 120, margin: 1 });
    const qrImage = await pdfDoc.embedPng(qrBuffer);
    page.drawImage(qrImage, { x: 50, y: y - 120, width: 120, height: 120 });
    page.drawText("Escanea para verificar", {
      x: 55,
      y: y - 135,
      size: 8,
      font,
      color: gray,
    });
  } catch (e) {
    page.drawText("[QR no disponible]", {
      x: 50,
      y: y - 20,
      size: 10,
      font,
      color: gray,
    });
  }

  // Foto del firmante (si hay)
  if (opts.fotoBase64) {
    try {
      const fotoData = opts.fotoBase64.replace(
        /^data:image\/\w+;base64,/,
        ""
      );
      const fotoBuffer = Buffer.from(fotoData, "base64");
      const fotoImage = await pdfDoc.embedJpg(fotoBuffer);
      page.drawImage(fotoImage, {
        x: 200,
        y: y - 120,
        width: 90,
        height: 90,
      });
      page.drawText("Foto de identidad", {
        x: 205,
        y: y - 135,
        size: 8,
        font,
        color: gray,
      });
    } catch (e) {
      // Si falla la imagen, continuar sin ella
    }
  }

  // Footer legal
  const footerY = 60;
  page.drawRectangle({
    x: 0,
    y: 40,
    width: 595,
    height: 1,
    color: rgb(0.85, 0.85, 0.85),
  });
  page.drawText(
    "Documento firmado electrónicamente conforme a la Ley 527 de 1999 y el Decreto 2364 de 2012 de Colombia.",
    { x: 50, y: footerY - 5, size: 7, font, color: gray }
  );
  page.drawText(
    "La validez jurídica de la firma electrónica no puede ser descartada por el solo hecho de estar en formato electrónico.",
    { x: 50, y: footerY - 15, size: 7, font, color: gray }
  );

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
