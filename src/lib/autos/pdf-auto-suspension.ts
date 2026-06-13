// ============================================================
// Generador PDF del Auto de Suspensión y Reprogramación
// (Art. 551 C.G.P) de insolvencia.
//
// Réplica FIEL del generador Word (generar-auto-suspension.ts): mismo
// texto legal VERBATIM, mismo membrete del centro con logo, mismas tablas
// de quórum y acreencias, mismo RESUELVE y firmas. Implementado con pdf-lib
// reutilizando los patrones de pdf-solicitud-conciliacion.ts (cursor/
// paginación/helpers) y pdf-relacion.ts (sistema de tablas con salto por
// fila). El dynamic import de pdf-lib sigue el patrón de firma/pdf.ts.
//
// NOTA legal: el título cita el Art. 551 pero el RESUELVE cita el Art. 550
// — así está en los autos originales y se deja igual a propósito (idéntico
// al Word).
// ============================================================
import {
  BLOQUES_ESTANDAR,
  type ResolvedAutoVars,
  type AutoSuspensionOpciones,
  type QuorumFila,
} from "./types";

// ── Helpers de formato (idénticos al Word) ──────────────────

/** Formatea un monto en pesos colombianos (sin decimales, separador de miles). */
function money(n: number): string {
  return new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

/** Formatea un porcentaje de voto (0..100) como "12,34%". */
function pctVoto(n: number): string {
  return `${(Number.isFinite(n) ? n : 0).toFixed(2).replace(".", ",")}%`;
}

/** Estado de asistencia para el quórum. */
function estado(presente: boolean | null | undefined): string {
  return presente ? "PRESENTE" : "AUSENTE";
}

/** Devuelve el valor si tiene contenido, o "________" para no romper. */
function oBlank(v: string | null | undefined): string {
  const s = (v ?? "").trim();
  return s.length > 0 ? s : "________";
}

/**
 * Descarga el logo del centro y detecta su tipo por magic bytes (igual que
 * el `fetchLogo` del Word). pdf-lib solo soporta PNG y JPG, así que solo
 * esos formatos se embeben; cualquier otro o un fallo devuelve null y el
 * membrete se arma sin logo (no debe romper la generación).
 */
async function fetchLogo(
  url: string | null,
): Promise<{ data: Uint8Array; type: "png" | "jpg" } | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = new Uint8Array(await res.arrayBuffer());
    if (data.length === 0) return null;
    if (data[0] === 0x89 && data[1] === 0x50) return { data, type: "png" };
    if (data[0] === 0xff && data[1] === 0xd8) return { data, type: "jpg" };
    const lower = url.toLowerCase();
    if (lower.includes(".png")) return { data, type: "png" };
    if (lower.includes(".jpg") || lower.includes(".jpeg")) return { data, type: "jpg" };
    return null;
  } catch {
    return null;
  }
}

// ── Generador principal ─────────────────────────────────────

export async function generarAutoSuspensionPdf(
  vars: ResolvedAutoVars,
  opciones: AutoSuspensionOpciones,
): Promise<Buffer> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");

  const { centro, operador, caso, deudor } = vars;

  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Paleta institucional (consistente con los demás PDF).
  const navy = rgb(13 / 255, 35 / 255, 64 / 255);
  const gold = rgb(184 / 255, 134 / 255, 11 / 255);
  const gray = rgb(0.35, 0.35, 0.35);
  const gridLine = rgb(196 / 255, 206 / 255, 222 / 255);
  const softBg = rgb(232 / 255, 238 / 255, 247 / 255);
  const white = rgb(1, 1, 1);
  const ink = rgb(0.1, 0.1, 0.1);

  // Carta vertical con márgenes de 1 pulgada (igual que el Word: 1440 twips).
  const PAGE_W = 612;
  const PAGE_H = 792;
  const MARGIN = 72;
  const RIGHT = PAGE_W - MARGIN;
  const USABLE_W = PAGE_W - 2 * MARGIN; // 468 pt
  // Reserva inferior antes de invadir el pie de página.
  const BOTTOM_LIMIT = MARGIN + 28;

  // Embeber el logo (PNG/JPG) una sola vez; se redibuja en cada página.
  const logoRaw = await fetchLogo(centro.logo_url);
  let logoImage: Awaited<ReturnType<typeof doc.embedPng>> | null = null;
  if (logoRaw) {
    try {
      logoImage =
        logoRaw.type === "png"
          ? await doc.embedPng(logoRaw.data)
          : await doc.embedJpg(logoRaw.data);
    } catch {
      logoImage = null;
    }
  }

  // Texto del pie VIGILADO (con "VIGILADO" en bold). OBLIGATORIO: si el centro
  // no lo tiene configurado, se usa el texto legal por defecto.
  const pieVigilado =
    (centro.pie_vigilado ?? "").trim() || "VIGILADO Ministerio de Justicia y del Derecho";

  // ── Estado del cursor ─────────────────────────────────────
  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  // ── Wrapping de texto ─────────────────────────────────────
  type PdfFont = typeof fontRegular;

  function wrapToLines(
    text: string,
    maxWidth: number,
    size: number,
    font: PdfFont,
  ): string[] {
    if (!text) return [""];
    const explicitLines = text.split(/\n/);
    const out: string[] = [];
    for (const segment of explicitLines) {
      if (!segment) {
        out.push("");
        continue;
      }
      if (font.widthOfTextAtSize(segment, size) <= maxWidth) {
        out.push(segment);
        continue;
      }
      const words = segment.split(/\s+/);
      let current = "";
      const pushWord = (w: string) => {
        if (!current) {
          // Palabra suelta: si excede el ancho, hard-break por caracteres.
          if (font.widthOfTextAtSize(w, size) <= maxWidth) {
            current = w;
            return;
          }
          let chunk = "";
          for (const ch of w) {
            if (font.widthOfTextAtSize(chunk + ch, size) <= maxWidth) {
              chunk += ch;
            } else {
              if (chunk) out.push(chunk);
              chunk = ch;
            }
          }
          current = chunk;
          return;
        }
        const candidate = `${current} ${w}`;
        if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
          current = candidate;
        } else {
          out.push(current);
          current = "";
          pushWord(w);
        }
      };
      for (const w of words) pushWord(w);
      if (current) out.push(current);
    }
    return out;
  }

  // ── Membrete (header) + pie (footer) — en cada página ──────
  function drawMembrete() {
    let topY = PAGE_H - MARGIN;

    // Logo a la izquierda (90x90), datos legales a la derecha alineados.
    const textRight = RIGHT;
    let logoBottom = topY;
    if (logoImage) {
      const dim = 64;
      page.drawImage(logoImage, {
        x: MARGIN,
        y: topY - dim,
        width: dim,
        height: dim,
      });
      logoBottom = topY - dim;
    }

    const lineas: Array<{ text: string; bold?: boolean; size: number }> = [
      { text: centro.nombre ?? "", bold: true, size: 10 },
      { text: centro.resolucion_habilitacion ?? "", size: 7 },
      {
        text: `${centro.resolucion_insolvencia ?? ""} Ministerio de Justicia – Código ${centro.codigo_ministerio ?? ""}`,
        size: 7,
      },
      { text: centro.direccion ?? "", size: 7 },
      {
        text: `Teléfono ${centro.telefono ?? ""} ${centro.email_radicacion ?? ""} y ${centro.email_secretaria ?? ""}`,
        size: 7,
      },
    ];

    let ty = topY - 9;
    for (const ln of lineas) {
      const font = ln.bold ? fontBold : fontRegular;
      const color = ln.bold ? navy : gray;
      // Cada línea puede envolver; alineada a la derecha.
      const wrapped = wrapToLines(ln.text, USABLE_W * 0.66, ln.size, font);
      for (const w of wrapped) {
        const tw = font.widthOfTextAtSize(w, ln.size);
        page.drawText(w, { x: textRight - tw, y: ty, size: ln.size, font, color });
        ty -= ln.size + 2;
      }
    }

    // El cuerpo arranca debajo de lo más bajo entre logo y texto + margen.
    y = Math.min(logoBottom, ty) - 18;
  }

  function drawPie() {
    const footerY = MARGIN - 18;
    // Línea separadora del pie.
    page.drawLine({
      start: { x: MARGIN, y: footerY + 12 },
      end: { x: RIGHT, y: footerY + 12 },
      thickness: 0.4,
      color: gridLine,
    });
    // Pie VIGILADO centrado, con la palabra "VIGILADO" en bold.
    const size = 7;
    const idx = pieVigilado.indexOf("VIGILADO");
    let segments: Array<{ text: string; font: PdfFont }>;
    if (idx >= 0) {
      const before = pieVigilado.slice(0, idx);
      const after = pieVigilado.slice(idx + "VIGILADO".length);
      segments = [
        ...(before ? [{ text: before, font: fontRegular }] : []),
        { text: "VIGILADO", font: fontBold },
        ...(after ? [{ text: after, font: fontRegular }] : []),
      ];
    } else {
      segments = pieVigilado ? [{ text: pieVigilado, font: fontRegular }] : [];
    }
    const totalW = segments.reduce(
      (s, seg) => s + seg.font.widthOfTextAtSize(seg.text, size),
      0,
    );
    let sx = MARGIN + (USABLE_W - totalW) / 2;
    for (const seg of segments) {
      page.drawText(seg.text, { x: sx, y: footerY, size, font: seg.font, color: gray });
      sx += seg.font.widthOfTextAtSize(seg.text, size);
    }
  }

  function nuevaPagina() {
    drawPie();
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
    drawMembrete();
  }

  /** Asegura `need` puntos verticales libres; si no, abre página nueva. */
  function ensure(need: number) {
    if (y - need < BOTTOM_LIMIT) {
      nuevaPagina();
    }
  }

  // ── Helpers de cuerpo ─────────────────────────────────────
  const BODY_SIZE = 11; // 11 pt (igual al Word)

  /** Párrafo justificado a una sola tirada de texto (multilinea). */
  function parrafo(
    text: string,
    opts: { bold?: boolean; size?: number; color?: ReturnType<typeof rgb>; spacingAfter?: number; center?: boolean } = {},
  ) {
    const size = opts.size ?? BODY_SIZE;
    const font = opts.bold ? fontBold : fontRegular;
    const color = opts.color ?? ink;
    const lineHeight = size + 3;
    const lines = wrapToLines(text, USABLE_W, size, font);
    for (const line of lines) {
      ensure(lineHeight);
      const tw = font.widthOfTextAtSize(line, size);
      const x = opts.center ? MARGIN + (USABLE_W - tw) / 2 : MARGIN;
      page.drawText(line, { x, y, size, font, color });
      y -= lineHeight;
    }
    y -= opts.spacingAfter ?? 6;
  }

  /** Título centrado en navy (AUTO No., I. ..., II. ..., III. ...). */
  function tituloCentrado(text: string, opts: { size?: number; spacingAfter?: number } = {}) {
    const size = opts.size ?? 12;
    const lineHeight = size + 3;
    const lines = wrapToLines(text, USABLE_W, size, fontBold);
    for (const line of lines) {
      ensure(lineHeight);
      const tw = fontBold.widthOfTextAtSize(line, size);
      page.drawText(line, { x: MARGIN + (USABLE_W - tw) / 2, y, size, font: fontBold, color: navy });
      y -= lineHeight;
    }
    y -= opts.spacingAfter ?? 8;
  }

  /** Línea "Label: valor" — label en bold, valor normal (puede envolver). */
  function campoLinea(label: string, value: string, opts: { spacingAfter?: number } = {}) {
    const size = BODY_SIZE;
    const lineHeight = size + 3;
    ensure(lineHeight);
    page.drawText(label, { x: MARGIN, y, size, font: fontBold, color: ink });
    const labelW = fontBold.widthOfTextAtSize(label, size);
    const valueX = MARGIN + labelW + 4;
    const maxW = RIGHT - valueX;
    const lines = wrapToLines(value, maxW, size, fontRegular);
    let first = true;
    for (const line of lines) {
      if (!first) {
        y -= lineHeight;
        ensure(lineHeight);
      }
      page.drawText(line, { x: first ? valueX : MARGIN, y, size, font: fontRegular, color: ink });
      first = false;
    }
    y -= lineHeight + (opts.spacingAfter ?? 2);
  }

  // ── Tablas: motor genérico de filas con salto de página ───
  interface Col {
    w: number;
    align: "left" | "right" | "center";
  }

  /** Dibuja una celda multilinea centrada verticalmente dentro de su alto. */
  function drawCellLines(
    lines: string[],
    x: number,
    yTop: number,
    rowHeight: number,
    w: number,
    align: "left" | "right" | "center",
    size: number,
    font: PdfFont,
    color: ReturnType<typeof rgb>,
  ) {
    const padding = 3;
    const lineH = size + 1;
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

  /** Rejilla (verticales + borde inferior) de una fila a `cols`. */
  function drawGrid(cols: Col[], xStart: number, yTop: number, height: number, fill?: ReturnType<typeof rgb>) {
    const totalW = cols.reduce((s, c) => s + c.w, 0);
    if (fill) {
      page.drawRectangle({ x: xStart, y: yTop - height, width: totalW, height, color: fill });
    }
    let cx = xStart;
    for (let i = 0; i <= cols.length; i++) {
      page.drawLine({
        start: { x: cx, y: yTop },
        end: { x: cx, y: yTop - height },
        thickness: 0.4,
        color: gridLine,
      });
      if (i < cols.length) cx += cols[i].w;
    }
    page.drawLine({
      start: { x: xStart, y: yTop - height },
      end: { x: xStart + totalW, y: yTop - height },
      thickness: 0.4,
      color: gridLine,
    });
  }

  // ── Tabla del quórum (2 columnas) ─────────────────────────
  function construirTablaQuorum(quorum: QuorumFila[]) {
    const Q_FONT = 7;
    const lineH = Q_FONT + 1;
    const cols: Col[] = [
      { w: USABLE_W / 2, align: "left" },
      { w: USABLE_W / 2, align: "left" },
    ];

    // Líneas de una celda de acreedor/deudor.
    const celdaAcreedorLines = (q: QuorumFila, titulo?: string): string[] => {
      const base = [
        oBlank(q.nombre),
        `NIT/C.C. No.: ${oBlank(q.documento)}`,
        `Email: ${oBlank(q.email)}`,
        `Teléfono: ${oBlank(q.telefono)}`,
        `Dirección: ${oBlank(q.direccion)}`,
        estado(q.presente),
      ];
      return titulo ? [titulo, ...base] : base;
    };

    // Líneas de una celda de apoderado.
    const celdaApoderadoLines = (q: QuorumFila, titulo?: string): string[] => {
      const tieneApoderado =
        q.apoderado_presente !== null && (q.apoderado_nombre || q.apoderado_cedula);
      const cuerpo = tieneApoderado
        ? [
            `Apoderado: ${oBlank(q.apoderado_nombre)}`,
            `C.C. No.: ${oBlank(q.apoderado_cedula)}`,
            `T.P. No.: ${oBlank(q.apoderado_tp)} del C.S de la J.`,
            `Email: ${oBlank(q.apoderado_email)}`,
            `Teléfono: ${oBlank(q.apoderado_telefono)}`,
            `Dirección: ${oBlank(q.apoderado_direccion)}`,
            estado(q.apoderado_presente),
          ]
        : [estado(q.apoderado_presente)];
      return titulo ? [titulo, ...cuerpo] : cuerpo;
    };

    // Para el deudor, la columna derecha mezcla apo del deudor con la fila.
    const apo = deudor.apoderado;
    const celdaDeudorApoderadoLines = (q: QuorumFila): string[] => [
      "APODERADO",
      `Apoderado: ${oBlank(apo?.nombre ?? q.apoderado_nombre)}`,
      `C.C. No.: ${oBlank(apo?.cedula ?? q.apoderado_cedula)}`,
      `T.P. No.: ${oBlank(apo?.tarjeta_profesional ?? q.apoderado_tp)} del C.S de la J.`,
      `Email: ${oBlank(apo?.email ?? q.apoderado_email)}`,
      `Teléfono: ${oBlank(apo?.telefono ?? q.apoderado_telefono)}`,
      `Dirección: ${oBlank(apo?.direccion ?? q.apoderado_direccion)}`,
      estado(q.apoderado_presente),
    ];

    // Negrita por línea: nombre del DEUDOR/APODERADO/estado.
    const isBoldLine = (line: string): boolean =>
      line === "DEUDOR" ||
      line === "APODERADO" ||
      line === "PRESENTE" ||
      line === "AUSENTE";

    const halfW = cols[0].w;

    // Dibuja una fila de 2 celdas (con wrapping y alto automático).
    const drawDualRow = (leftLines: string[], rightLines: string[]) => {
      const wrappedL: string[] = [];
      for (const l of leftLines) wrappedL.push(...wrapToLines(l, halfW - 6, Q_FONT, fontRegular));
      const wrappedR: string[] = [];
      for (const l of rightLines) wrappedR.push(...wrapToLines(l, halfW - 6, Q_FONT, fontRegular));
      const rowH = Math.max(wrappedL.length, wrappedR.length, 1) * lineH + 6;

      if (y - rowH < BOTTOM_LIMIT) {
        nuevaPagina();
        drawQuorumHeader();
      }
      drawGrid(cols, MARGIN, y, rowH);
      // Dibujo manual por línea para poder poner en bold ciertas líneas.
      const drawColumn = (lines: string[], colX: number) => {
        const blockH = lines.length * lineH;
        let lineY = y - (rowH - blockH) / 2 - Q_FONT;
        for (const line of lines) {
          const font = isBoldLine(line) ? fontBold : fontRegular;
          page.drawText(line, { x: colX + 3, y: lineY, size: Q_FONT, font, color: ink });
          lineY -= lineH;
        }
      };
      drawColumn(wrappedL, MARGIN);
      drawColumn(wrappedR, MARGIN + halfW);
      y -= rowH;
    };

    // Encabezado de la tabla (se repite al saltar de página).
    function drawQuorumHeader() {
      const headerH = lineH + 6;
      if (y - headerH < BOTTOM_LIMIT) nuevaPagina();
      drawGrid(cols, MARGIN, y, headerH, navy);
      drawCellLines(["ACREEDORES"], MARGIN, y, headerH, halfW, "center", Q_FONT, fontBold, white);
      drawCellLines(
        ["APODERADO/REPRESENTANTE LEGAL"],
        MARGIN + halfW,
        y,
        headerH,
        halfW,
        "center",
        Q_FONT,
        fontBold,
        white,
      );
      y -= headerH;
    }

    // Fila separadora de clase a todo el ancho.
    const drawSeparadorClase = (clase: string) => {
      const sepH = lineH + 4;
      if (y - sepH < BOTTOM_LIMIT) {
        nuevaPagina();
        drawQuorumHeader();
      }
      drawGrid([{ w: USABLE_W, align: "center" }], MARGIN, y, sepH, softBg);
      drawCellLines(
        [clase.toUpperCase() || "SIN CLASIFICAR"],
        MARGIN,
        y,
        sepH,
        USABLE_W,
        "center",
        Q_FONT,
        fontBold,
        navy,
      );
      y -= sepH;
    };

    drawQuorumHeader();

    const acreedores = quorum.filter((q) => !q.es_deudor);
    const deudores = quorum.filter((q) => q.es_deudor);

    // Acreedores agrupados por clase, separador antes de cada grupo.
    const clasesOrden: string[] = [];
    const porClase = new Map<string, QuorumFila[]>();
    for (const q of acreedores) {
      const clase = q.clase || "";
      if (!porClase.has(clase)) {
        porClase.set(clase, []);
        clasesOrden.push(clase);
      }
      porClase.get(clase)!.push(q);
    }
    for (const clase of clasesOrden) {
      drawSeparadorClase(clase);
      for (const q of porClase.get(clase)!) {
        drawDualRow(celdaAcreedorLines(q), celdaApoderadoLines(q));
      }
    }

    // Filas del deudor al final: izquierda DEUDOR, derecha APODERADO.
    for (const q of deudores) {
      drawDualRow(celdaAcreedorLines(q, "DEUDOR"), celdaDeudorApoderadoLines(q));
    }
  }

  // ── Tabla de acreencias (opcional) ────────────────────────
  function construirTablaAcreencias() {
    const T_FONT = 7;
    const lineH = T_FONT + 1;
    const HEADERS = [
      "#",
      "Acreedor",
      "Clase",
      "Capital",
      "Int. corr.",
      "Int. mora",
      "Seguros",
      "Otros",
      "Total",
      "% Voto",
      "Peq.",
    ];
    const ALIGNS: Array<"left" | "right" | "center"> = [
      "center",
      "left",
      "center",
      "right",
      "right",
      "right",
      "right",
      "right",
      "right",
      "center",
      "center",
    ];
    // Anchos relativos (mismas proporciones que el Word) escalados a USABLE_W.
    const REL = [340, 2400, 460, 980, 860, 860, 780, 730, 1010, 540, 400];
    const sum = REL.reduce((s, w) => s + w, 0);
    const scale = USABLE_W / sum;
    const cols: Col[] = REL.map((w, i) => ({ w: w * scale, align: ALIGNS[i] }));

    const headerH = lineH + 6;
    function drawTableHeader() {
      if (y - headerH < BOTTOM_LIMIT) nuevaPagina();
      drawGrid(cols, MARGIN, y, headerH, navy);
      let cx = MARGIN;
      for (let i = 0; i < cols.length; i++) {
        const lines = wrapToLines(HEADERS[i], cols[i].w - 6, T_FONT, fontBold);
        drawCellLines(lines, cx, y, headerH, cols[i].w, cols[i].align, T_FONT, fontBold, white);
        cx += cols[i].w;
      }
      y -= headerH;
    }

    const drawRow = (values: string[], opts: { bold?: boolean; fill?: ReturnType<typeof rgb> } = {}) => {
      // Alto = máximo de líneas envueltas por celda.
      const wrapped = values.map((v, i) =>
        wrapToLines(v, cols[i].w - 6, T_FONT, opts.bold ? fontBold : fontRegular),
      );
      const maxLines = wrapped.reduce((m, w) => Math.max(m, w.length), 1);
      const rowH = maxLines * lineH + 6;
      if (y - rowH < BOTTOM_LIMIT) {
        nuevaPagina();
        drawTableHeader();
      }
      drawGrid(cols, MARGIN, y, rowH, opts.fill);
      let cx = MARGIN;
      for (let i = 0; i < cols.length; i++) {
        drawCellLines(
          wrapped[i],
          cx,
          y,
          rowH,
          cols[i].w,
          cols[i].align,
          T_FONT,
          opts.bold ? fontBold : fontRegular,
          ink,
        );
        cx += cols[i].w;
      }
      y -= rowH;
    };

    drawTableHeader();

    let totCapital = 0;
    let totIntCorr = 0;
    let totIntMora = 0;
    let totSeguros = 0;
    let totOtros = 0;
    let totTotal = 0;

    // NO se filtra aquí: vars.acreedores ya viene filtrada por el endpoint.
    vars.acreedores.forEach((a, i) => {
      totCapital += a.capital;
      totIntCorr += a.intereses_corrientes;
      totIntMora += a.intereses_moratorios;
      totSeguros += a.seguros;
      totOtros += a.otros;
      totTotal += a.total;
      drawRow([
        String(i + 1),
        a.documento ? `${a.nombre} (${a.documento})` : a.nombre,
        a.clase_credito ?? "-",
        money(a.capital),
        money(a.intereses_corrientes),
        money(a.intereses_moratorios),
        money(a.seguros),
        money(a.otros),
        money(a.total),
        pctVoto(a.porcentaje_voto),
        a.es_pequeno ? "Sí" : "-",
      ]);
    });

    // Fila TOTALES (% Voto = 100,00%).
    drawRow(
      [
        "",
        "TOTALES",
        "",
        money(totCapital),
        money(totIntCorr),
        money(totIntMora),
        money(totSeguros),
        money(totOtros),
        money(totTotal),
        "100,00%",
        "",
      ],
      { bold: true, fill: softBg },
    );
  }

  // ════════════════════════════════════════════════════════════
  //  CUERPO DEL DOCUMENTO (orden y texto VERBATIM del Word)
  // ════════════════════════════════════════════════════════════
  drawMembrete();

  // 2. Ciudad y fecha
  parrafo(`${oBlank(centro.ciudad)}, ${opciones.fecha_audiencia_texto || "________"}.`, {
    spacingAfter: 12,
  });

  // 3. Título (centrado)
  tituloCentrado(`AUTO No. ${opciones.numero_auto || "________"}`, { size: 13, spacingAfter: 2 });
  tituloCentrado("SUSPENSIÓN Y REPROGRAMACIÓN", { size: 13, spacingAfter: 12 });

  // 4. Identificación
  campoLinea("Radicado: ", oBlank(caso.radicado), { spacingAfter: 1 });
  campoLinea(
    "Deudor: ",
    `${oBlank(deudor.nombre)} ${deudor.tipo_doc ?? ""} No. ${oBlank(deudor.documento)}`,
    { spacingAfter: 1 },
  );
  campoLinea("Asunto: ", "Auto de suspensión y reprogramación (Art. 551 C.G.P)", { spacingAfter: 12 });

  // 5. Párrafo de apertura (VERBATIM con huecos)
  const aperturaTexto =
    `El ${opciones.fecha_audiencia_texto || "________"}, siendo ${opciones.hora_audiencia_texto || "________"} ` +
    `(${opciones.hora_audiencia_corta || "________"}), se da inicio a la audiencia de negociación de pasivos del proceso ` +
    `de referencia, admitido mediante Auto No. ${oBlank(caso.numero_auto_admisorio)} del ${oBlank(caso.fecha_auto_admisorio)}, ` +
    `se procede con las siguientes actividades las cuales se desarrollan de manera virtual mediante (LINK AUDIENCIA DE ` +
    `CONCILIACIÓN Join Zoom Meeting ${opciones.zoom_apertura_url || "________"} ID de reunión: ${opciones.zoom_apertura_id || "________"} ` +
    `Código de acceso: ${opciones.zoom_apertura_codigo || "________"}${opciones.zoom_apertura_clave ? ` Clave: ${opciones.zoom_apertura_clave}` : ""}), en atención a implementar las tecnologías de la ` +
    `información y las comunicaciones en las actuaciones judiciales según la LEY 2213 DE 2022.`;
  parrafo(aperturaTexto, { spacingAfter: 12 });

  // 6. I. VERIFICACION DEL QUORUM
  tituloCentrado("I.    VERIFICACION DEL QUORUM", { size: 11, spacingAfter: 6 });
  parrafo("Registrada la asistencia se encuentran las siguientes personas:", { spacingAfter: 8 });
  construirTablaQuorum(opciones.quorum);
  y -= 8;

  // 7. II. CONSIDERACIONES
  tituloCentrado("II.    CONSIDERACIONES", { size: 11, spacingAfter: 6 });
  parrafo("Una vez instalada la audiencia se presenta lo siguiente:", { spacingAfter: 8 });

  // Numeral 1 — FIJO verbatim, siempre.
  const NUMERAL_1 =
    "Verificado el quórum reglamentario, el suscrito operador procede a dejar constancia de que la convocatoria fue " +
    "realizada en debida forma, conforme a los términos previstos por la normativa aplicable. Así mismo, se hace constar " +
    "que la fecha y hora de inicio del presente procedimiento transcurren sin que se advierta irregularidad alguna.";
  let n = 1;
  parrafo(`${n}) ${NUMERAL_1}`, { spacingAfter: 8 });

  // Numerales siguientes: primero bloques estándar (en su orden), luego libres.
  for (const bloque of BLOQUES_ESTANDAR) {
    if (opciones.bloques_estandar.includes(bloque.id)) {
      n += 1;
      parrafo(`${n}) ${bloque.texto}`, { spacingAfter: 8 });

      // 8. Tabla de acreencias — justo tras el bloque que la anuncia.
      if (bloque.id === "relacion_acreencias" && opciones.incluir_tabla_acreencias) {
        construirTablaAcreencias();
        y -= 8;
      }
    }
  }

  for (const cons of opciones.considerandos) {
    const texto = (cons ?? "").trim();
    if (texto.length === 0) continue;
    n += 1;
    parrafo(`${n}) ${texto}`, { spacingAfter: 8 });
  }

  // 9. Motivo de suspensión (último numeral si no está vacío) + frase puente.
  const motivo = (opciones.motivo_suspension ?? "").trim();
  if (motivo.length > 0) {
    n += 1;
    parrafo(`${n}) ${motivo}`, { spacingAfter: 8 });
  }
  parrafo("En virtud de lo anterior, se han tomado las siguientes decisiones:", { spacingAfter: 10 });

  // 10. III. RESUELVE (VERBATIM con huecos)
  tituloCentrado("III.    RESUELVE:", { size: 11, spacingAfter: 8 });

  const primero =
    `PRIMERO. SUSPENDER la audiencia y fijar como fecha de continuación el día ${opciones.continuacion_fecha || "________"} ` +
    `a las ${opciones.continuacion_hora || "________"}, para llevar a cabo la continuación de la audiencia de negociación de ` +
    `deudas contemplada en el artículo 550 del C.G.P., de manera virtual a través Del link ` +
    `${opciones.continuacion_zoom_url || "________"} Código de Acceso: ${opciones.continuacion_zoom_codigo || "________"}.`;
  parrafo(primero, { spacingAfter: 8 });
  const horaFin = (opciones.hora_terminacion ?? "").trim();
  parrafo("SEGUNDO: Los presentes quedan notificados en audiencia.", {
    spacingAfter: horaFin ? 12 : 28,
  });
  if (horaFin) {
    parrafo(`Siendo las ${horaFin}, se da por terminada la presente diligencia.`, {
      spacingAfter: 28,
    });
  }

  // 11. Firmas — operador (alineado a la izquierda).
  ensure(90);
  parrafo("___________________________________", { spacingAfter: 2 });
  parrafo(oBlank(operador.nombre), { bold: true, spacingAfter: 1 });
  parrafo(oBlank(operador.cargo), { spacingAfter: 1 });
  parrafo(`C.C. No. ${oBlank(operador.cedula)} de ${oBlank(operador.ciudad_cedula)}`, { spacingAfter: 1 });
  parrafo(`T.P. No. ${oBlank(operador.tarjeta_profesional)} del C.S. de la J.`, { spacingAfter: 16 });

  // Apoderado del deudor (si existe), centrado.
  const apoDeudor = deudor.apoderado;
  if (apoDeudor && (apoDeudor.nombre || apoDeudor.cedula || apoDeudor.tarjeta_profesional)) {
    ensure(80);
    y -= 16;
    parrafo("___________________________________", { center: true, spacingAfter: 2 });
    parrafo(oBlank(apoDeudor.nombre), { center: true, bold: true, spacingAfter: 1 });
    parrafo(`C. C. ${oBlank(apoDeudor.cedula)}`, { center: true, spacingAfter: 1 });
    parrafo(`T.P. ${oBlank(apoDeudor.tarjeta_profesional)} del C.S. de la J.`, { center: true, spacingAfter: 1 });
  }

  // Pie de la última página.
  drawPie();

  // Numeración de página (todas), abajo a la derecha.
  const pages = doc.getPages();
  pages.forEach((p, idx) => {
    const texto = `Página ${idx + 1} de ${pages.length}`;
    p.drawText(texto, {
      x: RIGHT - fontRegular.widthOfTextAtSize(texto, 7),
      y: MARGIN - 30,
      size: 7,
      font: fontRegular,
      color: gray,
    });
  });

  // Referencia para evitar warning de variables sin uso en builds estrictos.
  void gold;

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
