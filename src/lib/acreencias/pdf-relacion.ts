import type { SgccAcreencia, SgccCase, SgccCenter, SgccParty, ClaseCredito } from "@/types";
import { partyDisplayName } from "@/types";
import { prepararFilasRelacion } from "@/lib/doc-generator";

export interface RelacionAcreenciasPdfInput {
  caso: Pick<SgccCase, "numero_radicado" | "materia">;
  centro: Pick<SgccCenter, "nombre" | "ciudad" | "direccion" | "resolucion_habilitacion">;
  convocante?: SgccParty | null;
  acreencias: SgccAcreencia[];
}

const CLASE_LABEL: Record<ClaseCredito, string> = {
  primera: "1ra",
  segunda: "2da",
  tercera: "3ra",
  cuarta: "4ta",
  quinta: "5ta",
};

const money = (n: number) =>
  new Intl.NumberFormat("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const pctFmt = (n: number) => `${(n * 100).toFixed(2)}%`;

/**
 * PDF carta vertical con márgenes de 2.54cm (72 pt) — coincide con el acta estándar.
 * Tabla de relación definitiva de acreencias con totales y leyenda.
 */
export async function generarRelacionAcreenciasPdf(
  input: RelacionAcreenciasPdfInput
): Promise<Buffer> {
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
  const white = rgb(1, 1, 1);

  // Carta vertical con márgenes de 1 pulgada (72 pt = 2.54 cm), idénticos al acta.
  const PAGE_W = 612;
  const PAGE_H = 792;
  const MARGIN = 72;
  const RIGHT = PAGE_W - MARGIN;
  const USABLE_W = PAGE_W - 2 * MARGIN; // 468 pt

  // Distribución de 12 columnas sobre 468 pt de ancho útil.
  const COLS = [
    { key: "n", label: "#", w: 18, align: "center" as const },
    { key: "acreedor", label: "Acreedor", w: 86, align: "left" as const },
    { key: "doc", label: "Doc.", w: 50, align: "left" as const },
    { key: "clase", label: "Clase", w: 24, align: "center" as const },
    { key: "capital", label: "Capital", w: 48, align: "right" as const },
    { key: "intCorr", label: "Int. corr.", w: 42, align: "right" as const },
    { key: "intMora", label: "Int. mora", w: 42, align: "right" as const },
    { key: "seguros", label: "Seguros", w: 34, align: "right" as const },
    { key: "otros", label: "Otros", w: 34, align: "right" as const },
    { key: "total", label: "Total", w: 52, align: "right" as const },
    { key: "pctVoto", label: "% Voto", w: 28, align: "center" as const },
    { key: "peq", label: "Peq.", w: 20, align: "center" as const },
  ];
  // Sanity: suma de w debe ser ≤ USABLE_W (468)
  const SUM_W = COLS.reduce((s, c) => s + c.w, 0); // 478 — ajustamos al ancho real
  const SCALE = USABLE_W / SUM_W;
  COLS.forEach((c) => (c.w = c.w * SCALE));

  const FONT_HEADER = 7.5;
  const FONT_BODY = 7;
  const FONT_TOTAL = 7.5;
  const ROW_PAD_Y = 3;

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  function drawEncabezado() {
    y = PAGE_H - MARGIN;
    const centroLabel = input.centro.nombre.toUpperCase();
    const cw = fontBold.widthOfTextAtSize(centroLabel, 13);
    page.drawText(centroLabel, {
      x: (PAGE_W - cw) / 2,
      y,
      size: 13,
      font: fontBold,
      color: navy,
    });
    y -= 15;

    const subtitulo = `${input.centro.ciudad}${
      input.centro.resolucion_habilitacion ? " — " + input.centro.resolucion_habilitacion : ""
    }`;
    const sw = fontRegular.widthOfTextAtSize(subtitulo, 9);
    page.drawText(subtitulo, {
      x: (PAGE_W - sw) / 2,
      y,
      size: 9,
      font: fontRegular,
      color: gray,
    });
    y -= 24;

    const titulo = "RELACIÓN DEFINITIVA DE ACREENCIAS";
    const tw = fontBold.widthOfTextAtSize(titulo, 12);
    page.drawText(titulo, {
      x: (PAGE_W - tw) / 2,
      y,
      size: 12,
      font: fontBold,
      color: blue,
    });
    y -= 20;
  }

  function drawMetadatos() {
    const labelOpts = { size: 9, font: fontBold, color: navy };
    const valueOpts = { size: 9, font: fontRegular, color: rgb(0, 0, 0) };

    page.drawText("Radicado:", { x: MARGIN, y, ...labelOpts });
    page.drawText(input.caso.numero_radicado, { x: MARGIN + 60, y, ...valueOpts });
    y -= 12;

    if (input.convocante) {
      const nombre = partyDisplayName(input.convocante);
      const docStr =
        input.convocante.numero_doc ?? input.convocante.nit_empresa ?? "sin doc.";
      page.drawText("Deudor:", { x: MARGIN, y, ...labelOpts });
      page.drawText(`${nombre}  (${docStr})`, { x: MARGIN + 60, y, ...valueOpts });
      y -= 12;
    }

    const fechaHoy = new Date().toLocaleDateString("es-CO", { dateStyle: "long" });
    page.drawText("Fecha:", { x: MARGIN, y, ...labelOpts });
    page.drawText(fechaHoy, { x: MARGIN + 60, y, ...valueOpts });
    y -= 16;
  }

  function truncate(text: string, maxWidth: number, size: number, font: typeof fontRegular): string {
    if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
    const ellipsis = "…";
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
    color = rgb(0, 0, 0)
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
    page.drawRectangle({
      x: xStart,
      y: yTop - height,
      width: USABLE_W,
      height,
      color: navy,
    });
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
        white
      );
      cx += col.w;
    }
  }

  function drawGridRow(xStart: number, yTop: number, height: number, fill?: ReturnType<typeof rgb>) {
    if (fill) {
      page.drawRectangle({
        x: xStart,
        y: yTop - height,
        width: USABLE_W,
        height,
        color: fill,
      });
    }
    // verticales
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
    // horizontal inferior
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

  drawEncabezado();
  drawMetadatos();

  // ── Tabla ──
  const ROW_H = FONT_BODY + ROW_PAD_Y * 2 + 2; // ~13 pt
  const HEADER_H = FONT_HEADER + ROW_PAD_Y * 2 + 4;

  // Header
  drawHeaderRow(MARGIN, y, HEADER_H);
  y -= HEADER_H;

  const filas = prepararFilasRelacion(input.acreencias);

  let totalCapital = 0;
  let totalIntCorr = 0;
  let totalIntMora = 0;
  let totalSeguros = 0;
  let totalOtros = 0;

  filas.forEach((f, idx) => {
    // Nueva página si no cabe (dejamos espacio para totales + leyenda)
    if (y - ROW_H < MARGIN + 80) {
      nuevaPagina();
      drawHeaderRow(MARGIN, y, HEADER_H);
      y -= HEADER_H;
    }

    const capital = Number(f.a.con_capital);
    const intCorr = Number(f.a.con_intereses_corrientes);
    const intMora = Number(f.a.con_intereses_moratorios);
    const seguros = Number(f.a.con_seguros);
    const otros = Number(f.a.con_otros);

    totalCapital += capital;
    totalIntCorr += intCorr;
    totalIntMora += intMora;
    totalSeguros += seguros;
    totalOtros += otros;

    const fill = idx % 2 === 1 ? rgb(248 / 255, 250 / 255, 253 / 255) : undefined;
    drawGridRow(MARGIN, y, ROW_H, fill);

    const textY = y - ROW_H + ROW_PAD_Y + 1;
    let cx = MARGIN;
    const values: Record<string, string> = {
      n: String(idx + 1),
      acreedor: f.a.acreedor_nombre,
      doc: f.a.acreedor_documento ?? "—",
      clase: CLASE_LABEL[f.a.clase_credito],
      capital: money(capital),
      intCorr: money(intCorr),
      intMora: money(intMora),
      seguros: money(seguros),
      otros: money(otros),
      total: money(f.totalConciliado),
      pctVoto: pctFmt(Number(f.a.porcentaje_voto)),
      peq: f.a.es_pequeno_acreedor ? "Sí" : "—",
    };

    for (const col of COLS) {
      const isTotal = col.key === "total";
      drawCellText(
        values[col.key],
        cx,
        textY,
        col.w,
        col.align,
        FONT_BODY,
        isTotal ? fontBold : fontRegular
      );
      cx += col.w;
    }

    y -= ROW_H;
  });

  // Fila de totales
  if (y - ROW_H < MARGIN + 60) {
    nuevaPagina();
    drawHeaderRow(MARGIN, y, HEADER_H);
    y -= HEADER_H;
  }

  const totalGeneral = totalCapital + totalIntCorr + totalIntMora + totalSeguros + totalOtros;
  drawGridRow(MARGIN, y, ROW_H + 2, softBg);
  const totalTextY = y - (ROW_H + 2) + ROW_PAD_Y + 1;
  let tx = MARGIN;
  const totalValues: Record<string, { text: string; align: "left" | "right" | "center" }> = {
    n: { text: "", align: "center" },
    acreedor: { text: "TOTALES", align: "left" },
    doc: { text: "", align: "left" },
    clase: { text: "", align: "center" },
    capital: { text: money(totalCapital), align: "right" },
    intCorr: { text: money(totalIntCorr), align: "right" },
    intMora: { text: money(totalIntMora), align: "right" },
    seguros: { text: money(totalSeguros), align: "right" },
    otros: { text: money(totalOtros), align: "right" },
    total: { text: money(totalGeneral), align: "right" },
    pctVoto: { text: "100.00%", align: "center" },
    peq: { text: "", align: "center" },
  };
  for (const col of COLS) {
    const v = totalValues[col.key];
    drawCellText(v.text, tx, totalTextY, col.w, v.align, FONT_TOTAL, fontBold, navy);
    tx += col.w;
  }
  y -= ROW_H + 2;

  // Leyenda
  y -= 16;
  const leyenda =
    "Cifras en pesos colombianos (COP). «Peq.» indica pequeño acreedor (suma acumulada ≤ 5% del total). El % de voto se calcula sobre el capital conciliado.";
  const leyendaWrapped = wrapText(leyenda, USABLE_W, 8, fontItalic);
  for (const line of leyendaWrapped) {
    if (y < MARGIN) {
      nuevaPagina();
    }
    page.drawText(line, { x: MARGIN, y, size: 8, font: fontItalic, color: gray });
    y -= 11;
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

function wrapText(
  text: string,
  maxWidth: number,
  size: number,
  font: { widthOfTextAtSize: (t: string, s: number) => number }
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const candidate = current.length === 0 ? w : `${current} ${w}`;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines;
}
