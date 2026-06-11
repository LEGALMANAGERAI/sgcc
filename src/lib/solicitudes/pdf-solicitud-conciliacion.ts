// Genera el PDF de la solicitud de conciliación a nombre del convocante.
// Replica el look & feel del generador de insolvencia (pdf-solicitud.ts):
// pdf-lib, márgenes/fuentes/colores institucionales, encabezado del centro,
// pie de página numerado y bloque de firma electrónica (Ley 527 de 1999).

import type { FormDataConciliacion, AdjuntoDraft } from "@/types/solicitudes";

const MATERIA_LABEL: Record<string, string> = {
  civil: "Civil",
  comercial: "Comercial",
  laboral: "Laboral",
  familiar: "Familiar",
  consumidor: "Consumidor",
  arrendamiento: "Arrendamiento",
  otro: "Otro",
};

const TIPO_ANEXO_LABEL: Record<string, string> = {
  cedula: "Copia de cédula",
  redam: "Certificado REDAM",
  poder: "Poder al apoderado",
  tradicion: "Certificado de tradición y libertad",
  soporte_acreencia: "Soporte de acreencia",
  ingresos_contador: "Certificación de ingresos por contador",
  certif_laboral: "Certificación laboral (empleador)",
  certif_pension: "Certificación del fondo de pensiones",
  declaracion_independiente: "Declaración de ingresos (independiente)",
  liquidacion_sociedad_conyugal: "Liquidación de sociedad conyugal/patrimonial",
  documento_bien: "Documento idóneo de bien",
  matricula_mercantil: "Matrícula mercantil",
  otro: "Otro documento",
};

export interface GenerarPdfConciliacionInput {
  fd: Partial<FormDataConciliacion>;
  solicitante: { nombre: string; cedula: string; email: string; telefono?: string };
  adjuntos: AdjuntoDraft[];
  centro: { nombre: string; codigo?: string };
}

const COP = (n: number | undefined | null) =>
  typeof n === "number" && !Number.isNaN(n)
    ? `$${n.toLocaleString("es-CO")}`
    : "—";

const txt = (v: unknown): string => {
  if (v === null || v === undefined) return "—";
  const s = String(v).trim();
  return s.length === 0 ? "—" : s;
};

// Nombre legible de una PersonaFormData (natural o jurídica).
function personaNombre(p: {
  tipo_persona?: "natural" | "juridica";
  nombres?: string;
  apellidos?: string;
  razon_social?: string;
} | undefined | null): string {
  if (!p) return "—";
  if (p.tipo_persona === "juridica") {
    return txt(p.razon_social);
  }
  const completo = [p.nombres, p.apellidos].filter(Boolean).join(" ").trim();
  return completo.length > 0 ? completo : "—";
}

function personaDocumento(p: {
  tipo_persona?: "natural" | "juridica";
  tipo_doc?: string;
  numero_doc?: string;
  nit_empresa?: string;
} | undefined | null): string {
  if (!p) return "—";
  if (p.tipo_persona === "juridica") {
    return p.nit_empresa ? `NIT ${p.nit_empresa}` : "—";
  }
  const prefijo = p.tipo_doc ? `${p.tipo_doc} ` : "";
  return p.numero_doc ? `${prefijo}${p.numero_doc}`.trim() : "—";
}

const materiaLabel = (m: string | undefined): string =>
  m ? MATERIA_LABEL[m] ?? m : "—";

export async function generarPdfConciliacion(input: GenerarPdfConciliacionInput): Promise<Buffer> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const { fd, solicitante, adjuntos, centro } = input;

  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await doc.embedFont(StandardFonts.HelveticaOblique);

  const navy = rgb(13 / 255, 35 / 255, 64 / 255);
  const gold = rgb(184 / 255, 134 / 255, 11 / 255);
  const gray = rgb(0.35, 0.35, 0.35);
  const lightGray = rgb(0.88, 0.88, 0.88);
  const white = rgb(1, 1, 1);

  const PAGE_W = 595;
  const PAGE_H = 842;
  const MARGIN = 48;
  const RIGHT = PAGE_W - MARGIN;

  const centroHeader = centro.codigo
    ? `${centro.nombre} (Código ${centro.codigo})`
    : centro.nombre;

  // Estado del cursor
  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  let pageIndex = 1;

  // ── Helpers de dibujo ──────────────────────────────────────────────────
  function nuevoPageSiFalta(minY: number) {
    if (y < minY) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
      pageIndex++;
      encabezado();
    }
  }

  function encabezado() {
    page.drawRectangle({ x: 0, y: PAGE_H - 28, width: PAGE_W, height: 28, color: navy });
    page.drawText("SOLICITUD DE CONCILIACIÓN", {
      x: MARGIN,
      y: PAGE_H - 19,
      size: 9,
      font: fontBold,
      color: white,
    });
    page.drawText(centroHeader, {
      x: RIGHT - fontRegular.widthOfTextAtSize(centroHeader, 8),
      y: PAGE_H - 19,
      size: 8,
      font: fontRegular,
      color: white,
    });
    page.drawRectangle({ x: 0, y: PAGE_H - 30, width: PAGE_W, height: 2, color: gold });
    y = PAGE_H - 50;
  }

  function titulo(s: string) {
    nuevoPageSiFalta(80);
    y -= 4;
    page.drawText(s, { x: MARGIN, y, size: 14, font: fontBold, color: navy });
    y -= 6;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: RIGHT, y },
      thickness: 0.7,
      color: navy,
    });
    y -= 16;
  }

  function subtitulo(s: string) {
    nuevoPageSiFalta(60);
    page.drawText(s, { x: MARGIN, y, size: 11, font: fontBold, color: navy });
    y -= 16;
  }

  function parrafo(s: string, opts: { size?: number; bold?: boolean; italic?: boolean; color?: any } = {}) {
    const size = opts.size ?? 10;
    const font = opts.bold ? fontBold : opts.italic ? fontItalic : fontRegular;
    const color = opts.color ?? rgb(0.1, 0.1, 0.1);
    const lineHeight = size + 3;
    const maxWidth = RIGHT - MARGIN;
    const palabras = s.split(/\s+/);
    let linea = "";
    for (const p of palabras) {
      const test = linea ? `${linea} ${p}` : p;
      if (font.widthOfTextAtSize(test, size) > maxWidth) {
        nuevoPageSiFalta(lineHeight + 10);
        page.drawText(linea, { x: MARGIN, y, size, font, color });
        y -= lineHeight;
        linea = p;
      } else {
        linea = test;
      }
    }
    if (linea) {
      nuevoPageSiFalta(lineHeight + 10);
      page.drawText(linea, { x: MARGIN, y, size, font, color });
      y -= lineHeight;
    }
  }

  function campoLinea(label: string, value: string) {
    const size = 10;
    const lineHeight = 14;
    nuevoPageSiFalta(lineHeight + 10);
    page.drawText(label, { x: MARGIN, y, size, font: fontBold, color: gray });
    const labelW = fontBold.widthOfTextAtSize(label, size);
    const valueX = MARGIN + labelW + 6;
    const maxW = RIGHT - valueX;
    const palabras = value.split(/\s+/);
    let linea = "";
    let first = true;
    for (const p of palabras) {
      const test = linea ? `${linea} ${p}` : p;
      if (fontRegular.widthOfTextAtSize(test, size) > maxW) {
        page.drawText(linea, {
          x: first ? valueX : MARGIN,
          y,
          size,
          font: fontRegular,
          color: navy,
        });
        y -= lineHeight;
        nuevoPageSiFalta(lineHeight + 10);
        linea = p;
        first = false;
      } else {
        linea = test;
      }
    }
    if (linea) {
      page.drawText(linea, {
        x: first ? valueX : MARGIN,
        y,
        size,
        font: fontRegular,
        color: navy,
      });
      y -= lineHeight;
    }
  }

  function separador() {
    y -= 4;
    nuevoPageSiFalta(12);
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: RIGHT, y },
      thickness: 0.4,
      color: lightGray,
    });
    y -= 10;
  }

  function fechaLarga(iso: string): string {
    const meses = [
      "enero", "febrero", "marzo", "abril", "mayo", "junio",
      "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
    ];
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
  }

  // ── Portada ───────────────────────────────────────────────────────────
  encabezado();

  y -= 30;
  page.drawText("SOLICITUD DE", {
    x: MARGIN,
    y,
    size: 22,
    font: fontBold,
    color: navy,
  });
  y -= 26;
  page.drawText("CONCILIACIÓN", {
    x: MARGIN,
    y,
    size: 18,
    font: fontBold,
    color: gold,
  });
  y -= 40;
  parrafo(
    "El suscrito, identificado al pie, respetuosamente presenta ante el centro " +
      "de conciliación la presente solicitud de conciliación, con el fin de procurar " +
      "un arreglo directo respecto del asunto que a continuación se relaciona, " +
      "manifestando su disposición de asistir a la audiencia que se convoque.",
    { italic: true, color: gray }
  );

  y -= 10;
  campoLinea("Convocante:", txt(solicitante.nombre));
  campoLinea("C.C.:", txt(solicitante.cedula));
  campoLinea("Correo electrónico:", txt(solicitante.email));
  campoLinea("Teléfono:", txt(solicitante.telefono));
  campoLinea("Centro de conciliación:", centroHeader);
  campoLinea("Fecha de la solicitud:", fechaLarga(new Date().toISOString().slice(0, 10)));

  // ── 1. Datos del convocante ───────────────────────────────────────────
  titulo("1. Datos del convocante");
  campoLinea("Nombre completo:", txt(solicitante.nombre));
  campoLinea("Documento de identidad:", txt(solicitante.cedula));
  campoLinea("Correo electrónico:", txt(solicitante.email));
  campoLinea("Teléfono:", txt(solicitante.telefono));

  // ── 2. Convocado(s) ───────────────────────────────────────────────────
  titulo("2. Convocado(s)");
  const convocados = fd.convocados ?? [];
  if (convocados.length === 0) {
    parrafo("No se relacionaron convocados.", { italic: true });
  } else {
    convocados.forEach((c, i) => {
      subtitulo(`${i + 1}. ${personaNombre(c)}`);
      campoLinea(
        "Tipo:",
        c.tipo_persona === "juridica" ? "Persona jurídica" : "Persona natural"
      );
      campoLinea("Documento:", personaDocumento(c));
      if (c.tipo_persona === "juridica" && c.representante_legal) {
        campoLinea("Representante legal:", txt(c.representante_legal));
      }
      campoLinea("Correo:", txt(c.email));
      campoLinea("Teléfono:", txt(c.telefono));
      campoLinea("Ciudad:", txt(c.ciudad));
      campoLinea("Dirección:", txt(c.direccion));
      separador();
    });
  }

  // ── 3. Materia y cuantía ──────────────────────────────────────────────
  titulo("3. Materia y cuantía");
  campoLinea("Materia / asunto:", materiaLabel(fd.materia));
  campoLinea(
    "Cuantía:",
    fd.cuantia_indeterminada ? "Indeterminada" : COP(fd.cuantia)
  );

  // ── 4. Hechos y pretensiones ──────────────────────────────────────────
  titulo("4. Hechos y pretensiones");
  parrafo(fd.descripcion?.trim() ? fd.descripcion : "El convocante no aportó la descripción de los hechos y pretensiones.");

  // ── 5. Apoderado ──────────────────────────────────────────────────────
  if (fd.apoderado) {
    const ap = fd.apoderado;
    titulo("5. Apoderado");
    campoLinea("Nombre:", personaNombre(ap));
    campoLinea("Documento:", personaDocumento(ap));
    campoLinea("Tarjeta profesional:", txt(ap.tarjeta_profesional));
    campoLinea("Correo:", txt(ap.email));
    campoLinea("Teléfono:", txt(ap.telefono));
    campoLinea("Ciudad:", txt(ap.ciudad));
    campoLinea("Dirección:", txt(ap.direccion));
  }

  // ── Anexos ────────────────────────────────────────────────────────────
  titulo("Anexos aportados");
  if (adjuntos.length === 0) {
    parrafo("No se relacionaron anexos.", { italic: true });
  } else {
    const adjuntosPorTipo = new Map<string, AdjuntoDraft[]>();
    for (const a of adjuntos) {
      const lista = adjuntosPorTipo.get(a.tipo_anexo) ?? [];
      lista.push(a);
      adjuntosPorTipo.set(a.tipo_anexo, lista);
    }
    for (const [tipo, lista] of adjuntosPorTipo.entries()) {
      const label = TIPO_ANEXO_LABEL[tipo] ?? tipo;
      subtitulo(label);
      lista.forEach((a, i) => {
        parrafo(`${i + 1}. ${a.nombre_archivo} (${Math.round(a.tamano_bytes / 1024)} KB)`, {
          size: 9,
        });
      });
    }
  }

  // ── Pie de firma ──────────────────────────────────────────────────────
  y -= 20;
  nuevoPageSiFalta(150);
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: MARGIN + 220, y },
    thickness: 0.7,
    color: navy,
  });
  y -= 12;
  page.drawText("Firma del convocante solicitante", { x: MARGIN, y, size: 9, font: fontBold, color: gray });
  y -= 12;
  page.drawText(txt(solicitante.nombre), { x: MARGIN, y, size: 10, font: fontBold, color: navy });
  y -= 12;
  page.drawText(`C.C. ${txt(solicitante.cedula)}`, { x: MARGIN, y, size: 9, font: fontRegular, color: gray });
  y -= 14;
  page.drawText(
    "Documento firmado electrónicamente (Ley 527 de 1999).",
    { x: MARGIN, y, size: 8, font: fontItalic, color: gray }
  );

  // Pie de página en cada página con numeración
  const pages = doc.getPages();
  pages.forEach((p, idx) => {
    p.drawLine({
      start: { x: MARGIN, y: 36 },
      end: { x: RIGHT, y: 36 },
      thickness: 0.4,
      color: lightGray,
    });
    p.drawText(`${txt(solicitante.nombre)} — Solicitud de conciliación`, {
      x: MARGIN,
      y: 24,
      size: 7.5,
      font: fontRegular,
      color: gray,
    });
    const texto = `Página ${idx + 1} de ${pages.length}`;
    p.drawText(texto, {
      x: RIGHT - fontRegular.widthOfTextAtSize(texto, 7.5),
      y: 24,
      size: 7.5,
      font: fontRegular,
      color: gray,
    });
  });

  // referencia para evitar warning de variable no usada en builds estrictos
  void pageIndex;

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

export function nombreArchivoConciliacion(
  solicitante: { cedula: string; nombre: string },
  draftId: string
): string {
  const cc = solicitante.cedula || "sin-cc";
  const slug = (solicitante.nombre || "convocante")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `solicitud-conciliacion_${slug}_cc${cc}_${draftId.slice(0, 8)}.pdf`;
}
