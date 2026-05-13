import type { SgccAcreencia, SgccCase, SgccCenter, SgccParty, ClaseCredito } from "@/types";
import { partyDisplayName } from "@/types";
import { prepararGruposRelacion } from "@/lib/doc-generator";

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

  // Carta vertical con margenes verticales 1 in y horizontales ~1.5 cm para
  // dar mas ancho util a las 13 columnas y que palabras/cifras no se trunquen.
  const PAGE_W = 612;
  const PAGE_H = 792;
  const MARGIN_VER = 72;
  const MARGIN_HOR = 43;
  const USABLE_W = PAGE_W - 2 * MARGIN_HOR; // 526 pt

  // Distribucion ponderada: Acreedor + montos importantes mas anchos que
  // identif./pequeño para nombres de empresas y montos COP completos.
  // Clase y Peq tienen el ancho minimo para que "Clase" y "Peq." quepan
  // en una sola linea sin romperse por caracteres.
  const COLS = [
    { key: "n", label: "#", w: 18, align: "center" as const },
    { key: "acreedor", label: "Acreedor", w: 96, align: "left" as const },
    { key: "doc", label: "Doc.", w: 44, align: "left" as const },
    { key: "ident", label: "Identif.", w: 44, align: "left" as const },
    { key: "clase", label: "Clase", w: 30, align: "center" as const },
    { key: "capital", label: "Capital", w: 54, align: "right" as const },
    { key: "intCorr", label: "Int. corr.", w: 46, align: "right" as const },
    { key: "intMora", label: "Int. mora", w: 46, align: "right" as const },
    { key: "seguros", label: "Seguros", w: 36, align: "right" as const },
    { key: "otros", label: "Otros", w: 36, align: "right" as const },
    { key: "total", label: "Total", w: 56, align: "right" as const },
    { key: "pctVoto", label: "% Voto", w: 26, align: "center" as const },
    { key: "peq", label: "Peq.", w: 22, align: "center" as const },
  ];
  const SUM_W = COLS.reduce((s, c) => s + c.w, 0);
  const SCALE = USABLE_W / SUM_W;
  COLS.forEach((c) => (c.w = c.w * SCALE));

  const FONT_HEADER = 7.5;
  const FONT_BODY = 7;
  const FONT_TOTAL = 7.5;
  const ROW_PAD_Y = 3;

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN_VER;

  function drawEncabezado() {
    y = PAGE_H - MARGIN_VER;
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
      input.centro.resolucion_habilitacion ? " - " + input.centro.resolucion_habilitacion : ""
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

    page.drawText("Radicado:", { x: MARGIN_HOR, y, ...labelOpts });
    page.drawText(input.caso.numero_radicado, { x: MARGIN_HOR + 60, y, ...valueOpts });
    y -= 12;

    if (input.convocante) {
      const nombre = partyDisplayName(input.convocante);
      const docStr =
        input.convocante.numero_doc ?? input.convocante.nit_empresa ?? "sin doc.";
      page.drawText("Deudor:", { x: MARGIN_HOR, y, ...labelOpts });
      page.drawText(`${nombre}  (${docStr})`, { x: MARGIN_HOR + 60, y, ...valueOpts });
      y -= 12;
    }

    const fechaHoy = new Date().toLocaleDateString("es-CO", { dateStyle: "long" });
    page.drawText("Fecha:", { x: MARGIN_HOR, y, ...labelOpts });
    page.drawText(fechaHoy, { x: MARGIN_HOR + 60, y, ...valueOpts });
    y -= 16;
  }

  // Divide texto en lineas que quepan en maxWidth. Prioriza romper por
  // espacios; si una palabra individual excede el ancho, hace hard-break
  // por caracteres (sin "..."). Asi nombres como "FINANCIERA COMULTRASAN"
  // quedan "FINANCIERA" + "COMULTRASAN" en dos lineas.
  function wrapToLines(text: string, maxWidth: number, size: number, font: typeof fontRegular): string[] {
    if (!text) return [""];
    if (font.widthOfTextAtSize(text, size) <= maxWidth) return [text];

    const lines: string[] = [];
    let current = "";

    const flushIfFits = (candidate: string): boolean => {
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
        return true;
      }
      return false;
    };

    const hardBreakLong = (word: string) => {
      // Si la palabra entera excede el ancho, romperla por chars sin perder nada.
      if (font.widthOfTextAtSize(word, size) <= maxWidth) {
        if (current && !flushIfFits(`${current} ${word}`)) {
          lines.push(current);
          current = word;
        } else if (!current) {
          current = word;
        }
        return;
      }
      // Iterar caracteres acumulando hasta que ya no quepan
      let chunk = current ? `${current} ` : "";
      for (const ch of word) {
        const candidate = chunk + ch;
        if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
          chunk = candidate;
        } else {
          if (chunk.trim()) lines.push(chunk.trim());
          chunk = ch;
        }
      }
      current = chunk;
    };

    const words = text.split(/\s+/);
    for (const w of words) {
      if (!current) {
        if (font.widthOfTextAtSize(w, size) <= maxWidth) current = w;
        else hardBreakLong(w);
        continue;
      }
      const candidate = `${current} ${w}`;
      if (!flushIfFits(candidate)) {
        // No cabe agregando esta palabra: vuelco la linea actual y proceso w
        lines.push(current);
        current = "";
        if (font.widthOfTextAtSize(w, size) <= maxWidth) current = w;
        else hardBreakLong(w);
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  function drawCellLines(
    lines: string[],
    x: number,
    yTop: number,
    rowHeight: number,
    w: number,
    align: "left" | "right" | "center",
    size: number,
    font: typeof fontRegular,
    color = rgb(0, 0, 0)
  ) {
    const padding = 3;
    const lineH = size + 1;
    // Centrar verticalmente el bloque de lineas dentro de la celda.
    const blockH = lines.length * lineH;
    let lineY = yTop - (rowHeight - blockH) / 2 - size;
    for (const line of lines) {
      const tw = font.widthOfTextAtSize(line, size);
      let tx = x + padding;
      if (align === "right") tx = x + w - padding - tw;
      if (align === "center") tx = x + (w - tw) / 2;
      page.drawText(line, { x: tx, y: lineY, size, font, color });
      lineY -= lineH;
    }
  }

  function computeHeaderHeight(): number {
    const padding = 3;
    let maxLines = 1;
    for (const col of COLS) {
      const lines = wrapToLines(col.label, col.w - padding * 2, FONT_HEADER, fontBold);
      if (lines.length > maxLines) maxLines = lines.length;
    }
    const lineH = FONT_HEADER + 1;
    return ROW_PAD_Y * 2 + maxLines * lineH + 2;
  }

  function drawHeaderRow(xStart: number, yTop: number, height: number) {
    const padding = 3;
    page.drawRectangle({
      x: xStart,
      y: yTop - height,
      width: USABLE_W,
      height,
      color: navy,
    });
    let cx = xStart;
    for (const col of COLS) {
      const lines = wrapToLines(col.label, col.w - padding * 2, FONT_HEADER, fontBold);
      drawCellLines(lines, cx, yTop, height, col.w, col.align, FONT_HEADER, fontBold, white);
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
    y = PAGE_H - MARGIN_VER;
  }

  drawEncabezado();
  drawMetadatos();

  // ── Tabla ──
  const HEADER_H = computeHeaderHeight();
  const LINE_H_BODY = FONT_BODY + 1;
  const MIN_ROW_H = LINE_H_BODY + ROW_PAD_Y * 2 + 2;

  function rowHeightFor(values: Record<string, string>): number {
    const padding = 3;
    let maxLines = 1;
    for (const col of COLS) {
      const lines = wrapToLines(values[col.key] ?? "", col.w - padding * 2, FONT_BODY, fontRegular);
      if (lines.length > maxLines) maxLines = lines.length;
    }
    return Math.max(MIN_ROW_H, ROW_PAD_Y * 2 + maxLines * LINE_H_BODY + 2);
  }

  // Header
  drawHeaderRow(MARGIN_HOR, y, HEADER_H);
  y -= HEADER_H;

  const grupos = prepararGruposRelacion(input.acreencias);
  // Mismo tono claro que softBg (TOTALES) para que ninguna fila de datos
  // se vea mas oscura que el subtotal final. La barra azul a la izquierda
  // y la negrita ya distinguen las filas de acreedor principales.
  const parentFill = softBg;
  const subRowFill = rgb(248 / 255, 250 / 255, 253 / 255);
  // Barra azul que identifica cada credito. Color fuerte para filas
  // principales (acreedor) y mas tenue para sub-filas (acreencias hijas).
  const bandColorMain = navy;
  const bandColorChild = rgb(27 / 255, 79 / 255, 155 / 255);
  const BAND_W = 3;

  let totalCapital = 0;
  let totalIntCorr = 0;
  let totalIntMora = 0;
  let totalSeguros = 0;
  let totalOtros = 0;
  let idx = 0;

  function dibujarFila(
    values: Record<string, string>,
    opts: { fill?: any; bold?: boolean; band?: "main" | "child" | "none" },
  ) {
    const rowH = rowHeightFor(values);
    if (y - rowH < MARGIN_VER + 80) {
      nuevaPagina();
      drawHeaderRow(MARGIN_HOR, y, HEADER_H);
      y -= HEADER_H;
    }
    drawGridRow(MARGIN_HOR, y, rowH, opts.fill);
    // Banda azul al borde izquierdo de la fila
    if (opts.band && opts.band !== "none") {
      page.drawRectangle({
        x: MARGIN_HOR,
        y: y - rowH,
        width: BAND_W,
        height: rowH,
        color: opts.band === "child" ? bandColorChild : bandColorMain,
      });
    }
    const padding = 3;
    let cx = MARGIN_HOR;
    for (const col of COLS) {
      const font = opts.bold ? fontBold : col.key === "total" ? fontBold : fontRegular;
      const lines = wrapToLines(values[col.key] ?? "", col.w - padding * 2, FONT_BODY, font);
      drawCellLines(lines, cx, y, rowH, col.w, col.align, FONT_BODY, font);
      cx += col.w;
    }
    y -= rowH;
  }

  for (const grupo of grupos) {
    // Sumar al total general (siempre, viva o no la fila padre)
    totalCapital += grupo.totales.capital;
    totalIntCorr += grupo.totales.intCorr;
    totalIntMora += grupo.totales.intMora;
    totalSeguros += grupo.totales.seguros;
    totalOtros += grupo.totales.otros;

    const multiple = grupo.acreencias.length > 1;

    if (!multiple) {
      idx += 1;
      const f = grupo.acreencias[0];
      dibujarFila(
        {
          n: String(idx),
          acreedor: f.a.acreedor_nombre,
          doc: f.a.acreedor_documento ?? "-",
          ident: f.a.identificacion_credito ?? "-",
          clase: CLASE_LABEL[f.a.clase_credito],
          capital: money(Number(f.a.con_capital)),
          intCorr: money(Number(f.a.con_intereses_corrientes)),
          intMora: money(Number(f.a.con_intereses_moratorios)),
          seguros: money(Number(f.a.con_seguros)),
          otros: money(Number(f.a.con_otros)),
          total: money(f.totalConciliado),
          pctVoto: pctFmt(Number(f.a.porcentaje_voto)),
          peq: f.a.es_pequeno_acreedor ? "Sí" : "-",
        },
        { fill: parentFill, bold: true, band: "main" },
      );
      continue;
    }

    // Fila padre — acreedor con varias acreencias consolidadas
    idx += 1;
    const nombreConDoc = grupo.acreedorDocumento
      ? `${grupo.acreedorNombre} (${grupo.acreedorDocumento})`
      : grupo.acreedorNombre;
    dibujarFila(
      {
        n: String(idx),
        acreedor: `${nombreConDoc} - ${grupo.acreencias.length} acreencias`,
        doc: "-",
        ident: "-",
        clase: grupo.claseMixta ? "Mixta" : grupo.claseLabel ?? "",
        capital: money(grupo.totales.capital),
        intCorr: money(grupo.totales.intCorr),
        intMora: money(grupo.totales.intMora),
        seguros: money(grupo.totales.seguros),
        otros: money(grupo.totales.otros),
        total: money(grupo.totalConciliado),
        pctVoto: pctFmt(grupo.pctVotoGrupo),
        peq: grupo.todosPequenos ? "Sí" : "-",
      },
      { fill: parentFill, bold: true, band: "main" },
    );

    // Sub-filas — cada acreencia desplegada
    for (const f of grupo.acreencias) {
      dibujarFila(
        {
          n: "",
          acreedor: `      > ${f.a.identificacion_credito ?? "Sin identificación"}`,
          doc: "",
          ident: f.a.identificacion_credito ?? "-",
          clase: CLASE_LABEL[f.a.clase_credito],
          capital: money(Number(f.a.con_capital)),
          intCorr: money(Number(f.a.con_intereses_corrientes)),
          intMora: money(Number(f.a.con_intereses_moratorios)),
          seguros: money(Number(f.a.con_seguros)),
          otros: money(Number(f.a.con_otros)),
          total: money(f.totalConciliado),
          pctVoto: pctFmt(Number(f.a.porcentaje_voto)),
          peq: f.a.es_pequeno_acreedor ? "Sí" : "-",
        },
        { fill: subRowFill, band: "child" },
      );
    }
  }

  // Fila de totales
  const totalValues: Record<string, { text: string; align: "left" | "right" | "center" }> = {
    n: { text: "", align: "center" },
    acreedor: { text: "TOTALES", align: "left" },
    doc: { text: "", align: "left" },
    ident: { text: "", align: "left" },
    clase: { text: "", align: "center" },
    capital: { text: money(totalCapital), align: "right" },
    intCorr: { text: money(totalIntCorr), align: "right" },
    intMora: { text: money(totalIntMora), align: "right" },
    seguros: { text: money(totalSeguros), align: "right" },
    otros: { text: money(totalOtros), align: "right" },
    total: { text: money(totalCapital + totalIntCorr + totalIntMora + totalSeguros + totalOtros), align: "right" },
    pctVoto: { text: "100.00%", align: "center" },
    peq: { text: "", align: "center" },
  };
  const totalRowH = rowHeightFor(
    Object.fromEntries(Object.entries(totalValues).map(([k, v]) => [k, v.text])),
  ) + 2;

  if (y - totalRowH < MARGIN_VER + 60) {
    nuevaPagina();
    drawHeaderRow(MARGIN_HOR, y, HEADER_H);
    y -= HEADER_H;
  }

  drawGridRow(MARGIN_HOR, y, totalRowH, softBg);
  const paddingT = 3;
  let tx = MARGIN_HOR;
  for (const col of COLS) {
    const v = totalValues[col.key];
    const lines = wrapToLines(v.text, col.w - paddingT * 2, FONT_TOTAL, fontBold);
    drawCellLines(lines, tx, y, totalRowH, col.w, v.align, FONT_TOTAL, fontBold, navy);
    tx += col.w;
  }
  y -= totalRowH;

  // Leyenda
  y -= 16;
  const leyenda =
    'Cifras en pesos colombianos (COP). "Peq." indica pequeño acreedor (suma acumulada <= 5% del total). El % de voto se calcula sobre el capital conciliado.';
  const leyendaWrapped = wrapText(leyenda, USABLE_W, 8, fontItalic);
  for (const line of leyendaWrapped) {
    if (y < MARGIN_VER) {
      nuevaPagina();
    }
    page.drawText(line, { x: MARGIN_HOR, y, size: 8, font: fontItalic, color: gray });
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
