import type { SgccCase, SgccCenter, SgccParty } from "@/types";
import { partyDisplayName } from "@/types";

export interface GrupoVotoExport {
  acreedor_nombre: string;
  acreedor_documento: string | null;
  capital_total: number;
  porcentaje_voto: number;
  num_creditos: number;
  voto: "positivo" | "negativo" | "abstiene" | null;
  observaciones?: string | null;
  votado_at?: string | null;
}

export interface PropuestaExport {
  titulo: string;
  descripcion: string;
  plazo_meses: number | null;
  tasa_interes: string | null;
  periodo_gracia_meses: number;
  modo_votacion: "manual" | "link" | "dual" | null;
  fecha_votacion: string | null;
}

export interface ResumenVotacion {
  acreedores_positivos: number;
  acreedores_negativos: number;
  acreedores_abstuvieron: number;
  acreedores_pendientes: number;
  porcentaje_positivo: number;
  porcentaje_negativo: number;
  total_acreedores: number;
  estado_resultado: "aprobada" | "rechazada" | "en_curso";
}

export interface VotacionPdfInput {
  caso: Pick<SgccCase, "numero_radicado" | "materia">;
  centro: Pick<SgccCenter, "nombre" | "ciudad" | "direccion" | "resolucion_habilitacion">;
  convocante?: SgccParty | null;
  propuesta: PropuestaExport;
  votos: GrupoVotoExport[];
  resumen: ResumenVotacion;
}

const money = (n: number) =>
  new Intl.NumberFormat("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const pctFmt = (n: number) => `${(n * 100).toFixed(2)}%`;

const VOTO_LABEL = {
  positivo: "A favor",
  negativo: "En contra",
  abstiene: "Abstención",
} as const;

const MODO_LABEL = {
  manual: "Manual (registrado por operador)",
  link: "Por link con OTP",
  dual: "Dual (link + manual)",
} as const;

/**
 * PDF carta vertical con márgenes de 2.54cm — coincide con el acta estándar.
 * Acta de votación de propuesta de pago: encabezado, datos de propuesta,
 * tabla de votos por acreedor, resumen y resultado.
 */
export async function generarVotacionPdf(input: VotacionPdfInput): Promise<Buffer> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");

  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await doc.embedFont(StandardFonts.HelveticaOblique);

  const navy = rgb(13 / 255, 35 / 255, 64 / 255);
  const blue = rgb(27 / 255, 79 / 255, 155 / 255);
  const gray = rgb(0.3, 0.36, 0.45);
  const softBg = rgb(232 / 255, 238 / 255, 247 / 255);
  const gridLine = rgb(196 / 255, 206 / 255, 222 / 255);
  const green = rgb(22 / 255, 101 / 255, 52 / 255);
  const red = rgb(153 / 255, 27 / 255, 27 / 255);
  const white = rgb(1, 1, 1);

  const PAGE_W = 612;
  const PAGE_H = 792;
  const MARGIN = 72;
  const USABLE_W = PAGE_W - 2 * MARGIN;

  const COLS = [
    { key: "n", label: "#", w: 22, align: "center" as const },
    { key: "acreedor", label: "Acreedor", w: 130, align: "left" as const },
    { key: "doc", label: "Documento", w: 70, align: "left" as const },
    { key: "capital", label: "Capital conc.", w: 76, align: "right" as const },
    { key: "pct", label: "% Voto", w: 50, align: "center" as const },
    { key: "voto", label: "Voto", w: 64, align: "center" as const },
    { key: "obs", label: "Observaciones", w: 56, align: "left" as const },
  ];
  const SUM_W = COLS.reduce((s, c) => s + c.w, 0);
  const SCALE = USABLE_W / SUM_W;
  COLS.forEach((c) => (c.w = c.w * SCALE));

  const FONT_HEADER = 8;
  const FONT_BODY = 8;
  const ROW_PAD_Y = 4;

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  function truncate(text: string, maxWidth: number, size: number, font: typeof fontRegular): string {
    if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
    const ellipsis = "...";
    let lo = 0;
    let hi = text.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi + 1) / 2);
      const candidate = text.slice(0, mid) + ellipsis;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) lo = mid;
      else hi = mid - 1;
    }
    return text.slice(0, lo) + ellipsis;
  }

  function drawCellText(
    text: string,
    x: number,
    y: number,
    w: number,
    align: "left" | "right" | "center",
    size: number,
    font: typeof fontRegular,
    color = rgb(0, 0, 0),
  ) {
    const padding = 3;
    const maxW = w - padding * 2;
    const rendered = truncate(text, maxW, size, font);
    const tw = font.widthOfTextAtSize(rendered, size);
    let tx = x + padding;
    if (align === "right") tx = x + w - padding - tw;
    if (align === "center") tx = x + (w - tw) / 2;
    page.drawText(rendered, { x: tx, y, size, font, color });
  }

  function drawHeaderRow(xStart: number, yTop: number, height: number) {
    page.drawRectangle({ x: xStart, y: yTop - height, width: USABLE_W, height, color: navy });
    let cx = xStart;
    for (const col of COLS) {
      drawCellText(
        col.label,
        cx,
        yTop - height + (height - FONT_HEADER) / 2 + 1,
        col.w,
        col.align,
        FONT_HEADER,
        fontBold,
        white,
      );
      cx += col.w;
    }
  }

  function drawGridRow(xStart: number, yTop: number, height: number, fill?: ReturnType<typeof rgb>) {
    if (fill) {
      page.drawRectangle({ x: xStart, y: yTop - height, width: USABLE_W, height, color: fill });
    }
    let cx = xStart;
    for (let i = 0; i <= COLS.length; i++) {
      page.drawLine({
        start: { x: cx, y: yTop },
        end: { x: cx, y: yTop - height },
        thickness: 0.4,
        color: gridLine,
      });
      if (i < COLS.length) cx += COLS[i].w;
    }
    page.drawLine({
      start: { x: xStart, y: yTop - height },
      end: { x: xStart + USABLE_W, y: yTop - height },
      thickness: 0.4,
      color: gridLine,
    });
  }

  function nuevaPagina() {
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  }

  function wrap(text: string, maxWidth: number, size: number, font: typeof fontRegular): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = "";
    for (const w of words) {
      const candidate = current.length === 0 ? w : `${current} ${w}`;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) current = candidate;
      else {
        if (current) lines.push(current);
        current = w;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  // ── Encabezado ──
  const centroLabel = input.centro.nombre.toUpperCase();
  const cw = fontBold.widthOfTextAtSize(centroLabel, 13);
  page.drawText(centroLabel, { x: (PAGE_W - cw) / 2, y, size: 13, font: fontBold, color: navy });
  y -= 15;

  const subt = `${input.centro.ciudad}${input.centro.resolucion_habilitacion ? " - " + input.centro.resolucion_habilitacion : ""}`;
  const sw = fontRegular.widthOfTextAtSize(subt, 9);
  page.drawText(subt, { x: (PAGE_W - sw) / 2, y, size: 9, font: fontRegular, color: gray });
  y -= 24;

  const titulo = "ACTA DE VOTACIÓN — PROPUESTA DE PAGO";
  const tw = fontBold.widthOfTextAtSize(titulo, 12);
  page.drawText(titulo, { x: (PAGE_W - tw) / 2, y, size: 12, font: fontBold, color: blue });
  y -= 20;

  // ── Metadatos ──
  const labelOpts = { size: 9, font: fontBold, color: navy };
  const valueOpts = { size: 9, font: fontRegular, color: rgb(0, 0, 0) };

  page.drawText("Radicado:", { x: MARGIN, y, ...labelOpts });
  page.drawText(input.caso.numero_radicado, { x: MARGIN + 60, y, ...valueOpts });
  y -= 12;

  if (input.convocante) {
    const nombre = partyDisplayName(input.convocante);
    const docStr = input.convocante.numero_doc ?? input.convocante.nit_empresa ?? "sin doc.";
    page.drawText("Deudor:", { x: MARGIN, y, ...labelOpts });
    page.drawText(`${nombre}  (${docStr})`, { x: MARGIN + 60, y, ...valueOpts });
    y -= 12;
  }

  const fechaVot = input.propuesta.fecha_votacion
    ? new Date(input.propuesta.fecha_votacion).toLocaleDateString("es-CO", { dateStyle: "long" })
    : new Date().toLocaleDateString("es-CO", { dateStyle: "long" });
  page.drawText("Fecha votación:", { x: MARGIN, y, ...labelOpts });
  page.drawText(fechaVot, { x: MARGIN + 90, y, ...valueOpts });
  y -= 12;

  if (input.propuesta.modo_votacion) {
    page.drawText("Modalidad:", { x: MARGIN, y, ...labelOpts });
    page.drawText(MODO_LABEL[input.propuesta.modo_votacion], { x: MARGIN + 90, y, ...valueOpts });
    y -= 16;
  } else {
    y -= 4;
  }

  // ── Datos de propuesta ──
  const subTitulo = "Propuesta de pago";
  page.drawText(subTitulo, { x: MARGIN, y, size: 10, font: fontBold, color: blue });
  y -= 14;

  page.drawText("Título:", { x: MARGIN, y, ...labelOpts });
  page.drawText(input.propuesta.titulo, { x: MARGIN + 60, y, ...valueOpts });
  y -= 12;

  if (input.propuesta.plazo_meses != null || input.propuesta.tasa_interes || input.propuesta.periodo_gracia_meses) {
    const partes: string[] = [];
    if (input.propuesta.plazo_meses != null) partes.push(`Plazo: ${input.propuesta.plazo_meses} meses`);
    if (input.propuesta.tasa_interes) partes.push(`Tasa: ${input.propuesta.tasa_interes}`);
    if (input.propuesta.periodo_gracia_meses) partes.push(`Gracia: ${input.propuesta.periodo_gracia_meses} meses`);
    page.drawText("Condiciones:", { x: MARGIN, y, ...labelOpts });
    page.drawText(partes.join("  ·  "), { x: MARGIN + 80, y, ...valueOpts });
    y -= 12;
  }

  // Descripción (puede ser multi-línea)
  if (input.propuesta.descripcion) {
    page.drawText("Descripción:", { x: MARGIN, y, ...labelOpts });
    y -= 12;
    const descLines = wrap(input.propuesta.descripcion, USABLE_W, 9, fontRegular);
    for (const line of descLines.slice(0, 6)) {
      page.drawText(line, { x: MARGIN, y, ...valueOpts });
      y -= 11;
    }
    if (descLines.length > 6) {
      page.drawText("...", { x: MARGIN, y, ...valueOpts });
      y -= 11;
    }
  }
  y -= 8;

  // ── Tabla de votos ──
  const tablaTitulo = "Registro de votos por acreedor";
  page.drawText(tablaTitulo, { x: MARGIN, y, size: 10, font: fontBold, color: blue });
  y -= 14;

  const ROW_H = FONT_BODY + ROW_PAD_Y * 2 + 2;
  const HEADER_H = FONT_HEADER + ROW_PAD_Y * 2 + 4;

  drawHeaderRow(MARGIN, y, HEADER_H);
  y -= HEADER_H;

  input.votos.forEach((v, idx) => {
    if (y - ROW_H < MARGIN + 120) {
      nuevaPagina();
      drawHeaderRow(MARGIN, y, HEADER_H);
      y -= HEADER_H;
    }

    const fill = idx % 2 === 1 ? rgb(248 / 255, 250 / 255, 253 / 255) : undefined;
    drawGridRow(MARGIN, y, ROW_H, fill);
    const textY = y - ROW_H + ROW_PAD_Y + 1;

    const nombreCompleto = v.num_creditos > 1
      ? `${v.acreedor_nombre} (${v.num_creditos} créditos)`
      : v.acreedor_nombre;

    const votoText = v.voto ? VOTO_LABEL[v.voto] : "Pendiente";
    const votoColor = v.voto === "positivo" ? green : v.voto === "negativo" ? red : gray;

    let cx = MARGIN;
    for (const col of COLS) {
      let value = "";
      let color = rgb(0, 0, 0);
      let font = fontRegular;
      if (col.key === "n") value = String(idx + 1);
      else if (col.key === "acreedor") value = nombreCompleto;
      else if (col.key === "doc") value = v.acreedor_documento ?? "-";
      else if (col.key === "capital") value = money(v.capital_total);
      else if (col.key === "pct") value = pctFmt(v.porcentaje_voto);
      else if (col.key === "voto") {
        value = votoText;
        color = votoColor;
        font = fontBold;
      } else if (col.key === "obs") value = v.observaciones ?? "";

      drawCellText(value, cx, textY, col.w, col.align, FONT_BODY, font, color);
      cx += col.w;
    }
    y -= ROW_H;
  });

  // ── Resumen ──
  if (y < MARGIN + 120) nuevaPagina();
  y -= 16;
  page.drawText("Resumen y resultado", { x: MARGIN, y, size: 10, font: fontBold, color: blue });
  y -= 14;

  const r = input.resumen;
  const lineas: Array<[string, string, ReturnType<typeof rgb>?]> = [
    [`Total acreedores únicos:`, String(r.total_acreedores)],
    [`A favor:`, `${r.acreedores_positivos} acreedor(es) — ${pctFmt(r.porcentaje_positivo)}`, green],
    [`En contra:`, `${r.acreedores_negativos} acreedor(es) — ${pctFmt(r.porcentaje_negativo)}`, red],
    [`Abstenciones:`, `${r.acreedores_abstuvieron} acreedor(es)`],
    [`Pendientes:`, `${r.acreedores_pendientes} acreedor(es)`],
  ];
  for (const [label, value, color] of lineas) {
    page.drawText(label, { x: MARGIN, y, size: 9, font: fontBold, color: navy });
    page.drawText(value, { x: MARGIN + 130, y, size: 9, font: fontRegular, color: color ?? rgb(0, 0, 0) });
    y -= 12;
  }
  y -= 6;

  const resultadoLabel =
    r.estado_resultado === "aprobada"
      ? "PROPUESTA APROBADA"
      : r.estado_resultado === "rechazada"
        ? "PROPUESTA RECHAZADA"
        : "VOTACIÓN EN CURSO";
  const resultadoColor = r.estado_resultado === "aprobada" ? green : r.estado_resultado === "rechazada" ? red : blue;
  page.drawRectangle({
    x: MARGIN,
    y: y - 22,
    width: USABLE_W,
    height: 22,
    color: softBg,
    borderColor: resultadoColor,
    borderWidth: 1,
  });
  const rTw = fontBold.widthOfTextAtSize(resultadoLabel, 11);
  page.drawText(resultadoLabel, {
    x: MARGIN + (USABLE_W - rTw) / 2,
    y: y - 16,
    size: 11,
    font: fontBold,
    color: resultadoColor,
  });
  y -= 30;

  // Leyenda
  const leyenda =
    'Regla de aprobación (Ley 1564/2012): >50% del capital total y al menos 2 acreedores únicos votando a favor. Cifras en pesos colombianos. El % de voto del acreedor consolida los créditos a su nombre.';
  const leyendaWrapped = wrap(leyenda, USABLE_W, 8, fontItalic);
  for (const line of leyendaWrapped) {
    if (y < MARGIN) nuevaPagina();
    page.drawText(line, { x: MARGIN, y, size: 8, font: fontItalic, color: gray });
    y -= 11;
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
