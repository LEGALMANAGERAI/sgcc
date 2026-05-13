import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  PageOrientation,
} from "docx";
import type { SgccCase, SgccCenter, SgccParty, SgccStaff, SgccActa, ObligacionItem, SgccAcreencia, ClaseCredito } from "@/types";
import { partyDisplayName } from "@/types";
import type { SgccHearing } from "@/types";
import { fechaEnLetras, horaEnLetras } from "./numero-a-letras";

interface CaseContext {
  caso: SgccCase;
  centro: SgccCenter;
  convocante: SgccParty;
  convocados: SgccParty[];
  conciliador: SgccStaff | null;
  acta?: SgccActa;
  audiencia?: SgccHearing | null;
}

/**
 * Reemplaza tokens {{variable}} en un texto de plantilla.
 */
export function renderTemplate(template: string, ctx: CaseContext): string {
  const fechaAudiencia = ctx.caso.fecha_audiencia
    ? new Date(ctx.caso.fecha_audiencia).toLocaleString("es-CO", {
        dateStyle: "long",
        timeStyle: "short",
      })
    : "Por definir";

  const tokens: Record<string, string> = {
    "centro.nombre": ctx.centro.nombre,
    "centro.ciudad": ctx.centro.ciudad,
    "centro.direccion": ctx.centro.direccion ?? "",
    "centro.telefono": ctx.centro.telefono ?? "",
    "centro.resolucion": ctx.centro.resolucion_habilitacion ?? "",
    "caso.radicado": ctx.caso.numero_radicado,
    "caso.materia": ctx.caso.materia,
    "caso.descripcion": ctx.caso.descripcion,
    "caso.cuantia": ctx.caso.cuantia_indeterminada
      ? "Cuantía indeterminada"
      : ctx.caso.cuantia
      ? `$${ctx.caso.cuantia.toLocaleString("es-CO")}`
      : "Sin cuantía",
    "caso.fecha_solicitud": new Date(ctx.caso.fecha_solicitud).toLocaleDateString("es-CO"),
    "caso.fecha_audiencia": fechaAudiencia,
    "caso.fecha_limite_citacion": ctx.caso.fecha_limite_citacion
      ? new Date(ctx.caso.fecha_limite_citacion).toLocaleDateString("es-CO")
      : "",
    "convocante.nombre": partyDisplayName(ctx.convocante),
    "convocante.doc": ctx.convocante.numero_doc ?? ctx.convocante.nit_empresa ?? "",
    "convocante.email": ctx.convocante.email,
    "convocante.telefono": ctx.convocante.telefono ?? "",
    "convocante.direccion": ctx.convocante.direccion ?? "",
    "convocados.lista": ctx.convocados.map(partyDisplayName).join(", "),
    // Alias para acuerdos de apoyo (el convocante es el Titular del acto jurídico)
    "titular.nombre": partyDisplayName(ctx.convocante),
    "titular.doc": ctx.convocante.numero_doc ?? ctx.convocante.nit_empresa ?? "",
    "titular.email": ctx.convocante.email,
    "titular.direccion": ctx.convocante.direccion ?? "",
    "apoyo.nombre": ctx.convocados[0] ? partyDisplayName(ctx.convocados[0]) : "",
    "apoyo.doc": ctx.convocados[0]?.numero_doc ?? "",
    "conciliador.nombre": ctx.conciliador?.nombre ?? "",
    "conciliador.doc": "",
    "conciliador.tarjeta": ctx.conciliador?.tarjeta_profesional ?? "",
    "conciliador.codigo_interno": ctx.conciliador?.codigo_interno ?? "",
    "audiencia.modalidad": ctx.audiencia?.modalidad ?? "",
    "audiencia.plataforma": ctx.audiencia?.plataforma_virtual ?? "",
    "audiencia.fecha_hora_letras": ctx.audiencia?.fecha_hora
      ? fechaEnLetras(ctx.audiencia.fecha_hora)
      : "",
    "audiencia.hora_letras": ctx.audiencia?.fecha_hora
      ? horaEnLetras(ctx.audiencia.fecha_hora)
      : "",
    "fecha.hoy": new Date().toLocaleDateString("es-CO", { dateStyle: "long" }),
    "fecha.hoy_letras": fechaEnLetras(new Date()),
    "acta.numero": ctx.acta?.numero_acta ?? "",
    "acta.tipo": ctx.acta?.tipo ?? "",
    "acta.hechos": ctx.acta?.hechos ?? "",
    "acta.consideraciones": ctx.acta?.consideraciones ?? "",
    "acta.acuerdo": ctx.acta?.acuerdo_texto ?? "",
  };

  let result = template;
  for (const [key, value] of Object.entries(tokens)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

/**
 * Genera un documento Word (.docx) a partir del texto de una plantilla ya renderizada.
 */
export async function generateDocx(
  titulo: string,
  contenido: string,
  ctx: CaseContext
): Promise<Buffer> {
  const lines = contenido.split("\n");

  const paragraphs: Paragraph[] = [
    // Header
    new Paragraph({
      children: [
        new TextRun({
          text: ctx.centro.nombre.toUpperCase(),
          bold: true,
          size: 28,
          color: "0D2340",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: titulo.toUpperCase(),
          bold: true,
          size: 24,
          color: "1B4F9B",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Radicado: ${ctx.caso.numero_radicado}`,
          bold: true,
        }),
      ],
      spacing: { after: 200 },
    }),
    // Contenido
    ...lines.map(
      (line) =>
        new Paragraph({
          children: [new TextRun({ text: line })],
          spacing: { after: 160 },
        })
    ),
  ];

  // Si el acta tiene obligaciones, añadir tabla
  if (ctx.acta?.obligaciones?.length) {
    paragraphs.push(
      new Paragraph({
        text: "OBLIGACIONES PACTADAS",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            tableHeader: true,
            children: ["Parte obligada", "Obligación", "Plazo", "Monto"].map(
              (h) =>
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
                  shading: { fill: "0D2340" },
                })
            ),
          }),
          ...(ctx.acta.obligaciones as ObligacionItem[]).map(
            (ob) =>
              new TableRow({
                children: [ob.parte, ob.obligacion, ob.plazo, ob.monto ? `$${ob.monto.toLocaleString("es-CO")}` : ""].map(
                  (cell) =>
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: cell })] })],
                    })
                ),
              })
          ),
        ],
      }) as unknown as Paragraph
    );
  }

  // Sección de firmas
  paragraphs.push(
    new Paragraph({ text: "", spacing: { before: 800 } }),
    new Paragraph({
      children: [new TextRun({ text: "FIRMAS", bold: true })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  const allParties = [ctx.convocante, ...ctx.convocados];
  for (const p of allParties) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({ text: "___________________________________" }),
        ],
        spacing: { before: 400, after: 80 },
      }),
      new Paragraph({
        children: [new TextRun({ text: partyDisplayName(p), bold: true })],
        spacing: { after: 40 },
      }),
      new Paragraph({
        children: [new TextRun({ text: p.numero_doc ?? p.nit_empresa ?? "", color: "666666" })],
        spacing: { after: 200 },
      })
    );
  }

  if (ctx.conciliador) {
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: "___________________________________" })],
        spacing: { before: 400, after: 80 },
      }),
      new Paragraph({
        children: [new TextRun({ text: ctx.conciliador.nombre, bold: true })],
        spacing: { after: 40 },
      }),
      new Paragraph({
        children: [new TextRun({ text: `Conciliador — T.P. ${ctx.conciliador.tarjeta_profesional ?? "N/A"}`, color: "666666" })],
      })
    );
  }

  const doc = new Document({
    sections: [{ properties: {}, children: paragraphs }],
  });

  return Packer.toBuffer(doc);
}

/* ─── Relación definitiva de acreencias ──────────────────────────────── */

export interface RelacionAcreenciasContext {
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

const ORDEN_CLASES: ClaseCredito[] = ["primera", "segunda", "tercera", "cuarta", "quinta"];

interface FilaAcreencia {
  a: SgccAcreencia;
  totalConciliado: number;
}

export function prepararFilasRelacion(acreencias: SgccAcreencia[]): FilaAcreencia[] {
  const filas = acreencias.map((a) => ({
    a,
    totalConciliado:
      Number(a.con_capital) +
      Number(a.con_intereses_corrientes) +
      Number(a.con_intereses_moratorios) +
      Number(a.con_seguros) +
      Number(a.con_otros),
  }));

  filas.sort((x, y) => {
    const ox = ORDEN_CLASES.indexOf(x.a.clase_credito);
    const oy = ORDEN_CLASES.indexOf(y.a.clase_credito);
    if (ox !== oy) return ox - oy;
    return x.a.acreedor_nombre.localeCompare(y.a.acreedor_nombre, "es");
  });

  return filas;
}

/* ─── Agrupacion por acreedor para los exports ────────────────────────────
   Replica la vista expandida de la pantalla: por cada acreedor con varias
   acreencias se muestra una fila padre con totales consolidados, y debajo
   cada acreencia individual con sus propios montos y % de voto. Acreedor
   con UNA sola acreencia se renderiza como fila simple sin padre. */

const normDocAcreedor = (d: string | null | undefined): string =>
  (d ?? "").replace(/[\s.\-_]/g, "").toUpperCase();

export interface GrupoAcreedor {
  acreedorNombre: string;
  acreedorDocumento: string | null;
  acreencias: FilaAcreencia[];
  totales: {
    capital: number;
    intCorr: number;
    intMora: number;
    seguros: number;
    otros: number;
  };
  totalConciliado: number;
  pctVotoGrupo: number;
  todosPequenos: boolean;
  claseLabel: string | null;
  claseMixta: boolean;
}

export function prepararGruposRelacion(acreencias: SgccAcreencia[]): GrupoAcreedor[] {
  // Agrupar prioritariamente por DOCUMENTO normalizado. Si dos acreencias
  // comparten documento (NIT/CC) son el mismo acreedor aunque tengan
  // party_id distintos (datos creados antes del fix de findOrCreateParty).
  // Fallback: party_id si no hay documento, y al final por nombre.
  const map = new Map<string, FilaAcreencia[]>();
  for (const a of acreencias) {
    const docNorm = normDocAcreedor(a.acreedor_documento);
    const key = docNorm
      ? `d:${docNorm}`
      : a.party_id
        ? `p:${a.party_id}`
        : `n:${(a.acreedor_nombre ?? "").trim().toUpperCase() || a.id}`;
    const fila: FilaAcreencia = {
      a,
      totalConciliado:
        Number(a.con_capital) +
        Number(a.con_intereses_corrientes) +
        Number(a.con_intereses_moratorios) +
        Number(a.con_seguros) +
        Number(a.con_otros),
    };
    const arr = map.get(key) ?? [];
    arr.push(fila);
    map.set(key, arr);
  }

  const grupos: GrupoAcreedor[] = Array.from(map.values()).map((filasGrupo) => {
    const first = filasGrupo[0].a;
    const totales = filasGrupo.reduce(
      (acc, f) => ({
        capital: acc.capital + Number(f.a.con_capital),
        intCorr: acc.intCorr + Number(f.a.con_intereses_corrientes),
        intMora: acc.intMora + Number(f.a.con_intereses_moratorios),
        seguros: acc.seguros + Number(f.a.con_seguros),
        otros: acc.otros + Number(f.a.con_otros),
      }),
      { capital: 0, intCorr: 0, intMora: 0, seguros: 0, otros: 0 },
    );
    const totalConciliado =
      totales.capital + totales.intCorr + totales.intMora + totales.seguros + totales.otros;
    const pctVotoGrupo = filasGrupo.reduce(
      (s, f) => s + Number(f.a.porcentaje_voto || 0),
      0,
    );
    const todosPequenos = filasGrupo.every((f) => f.a.es_pequeno_acreedor);
    const clases = new Set(filasGrupo.map((f) => f.a.clase_credito));
    const claseMixta = clases.size > 1;
    const claseLabel = claseMixta ? null : CLASE_LABEL[[...clases][0]];

    return {
      acreedorNombre: first.acreedor_nombre,
      acreedorDocumento: first.acreedor_documento,
      acreencias: filasGrupo,
      totales,
      totalConciliado,
      pctVotoGrupo,
      todosPequenos,
      claseLabel,
      claseMixta,
    };
  });

  // No reordenamos los grupos: respetamos el orden en que vienen las
  // acreencias del backend (sgcc_acreencias ordenada por display_order,
  // que el usuario controla con drag-and-drop en la pantalla).
  return grupos;
}

const money = (n: number) =>
  new Intl.NumberFormat("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
const pctFmt = (n: number) => `${(n * 100).toFixed(2)}%`;

/**
 * Genera un Word (.docx) con la relación definitiva de acreencias como tabla,
 * con los mismos márgenes del acta (carta, 2.54cm) para que pueda incrustarse.
 */
export async function generateRelacionAcreenciasDocx(
  ctx: RelacionAcreenciasContext
): Promise<Buffer> {
  const grupos = prepararGruposRelacion(ctx.acreencias);
  const totalCapital = ctx.acreencias.reduce((s, a) => s + Number(a.con_capital), 0);
  const totalIntCorr = ctx.acreencias.reduce((s, a) => s + Number(a.con_intereses_corrientes), 0);
  const totalIntMora = ctx.acreencias.reduce((s, a) => s + Number(a.con_intereses_moratorios), 0);
  const totalSeguros = ctx.acreencias.reduce((s, a) => s + Number(a.con_seguros), 0);
  const totalOtros = ctx.acreencias.reduce((s, a) => s + Number(a.con_otros), 0);
  const totalGeneral = totalCapital + totalIntCorr + totalIntMora + totalSeguros + totalOtros;

  // Headers cortos. Sin columna Doc. ni Identif. — el documento va entre
  // parentesis junto al nombre, la identificacion va debajo o como
  // sub-fila ">".
  const headers = [
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

  // Suma debe ser <= 9360 (ancho util en pagina carta vertical con
  // margenes de 1 pulgada / 1440 twips cada lado, igual al PDF).
  const COL_WIDTHS = [
    340,   // #
    2400,  // Acreedor (absorbe documento y identif.)
    460,   // Clase
    980,   // Capital
    860,   // Int. corr.
    860,   // Int. mora
    780,   // Seguros
    730,   // Otros
    1010,  // Total
    540,   // % Voto
    400,   // Peq.
  ];

  const headerCell = (text: string, width: number) =>
    new TableCell({
      width: { size: width, type: WidthType.DXA },
      children: [
        new Paragraph({
          children: [new TextRun({ text, bold: true, size: 14, color: "FFFFFF" })],
          alignment: AlignmentType.CENTER,
        }),
      ],
      shading: { fill: "0D2340" },
      margins: { top: 60, bottom: 60, left: 40, right: 40 },
    });

  // Bordes "barra" para identificar cada credito. El borde izquierdo
  // grueso azul reemplaza el borde normal de la tabla en la primera celda
  // de cada fila.
  const bandMain = {
    left: { style: BorderStyle.SINGLE, size: 16, color: "0D2340" },
  };
  const bandChild = {
    left: { style: BorderStyle.SINGLE, size: 16, color: "1B4F9B" },
  };

  type AlignValue = (typeof AlignmentType)[keyof typeof AlignmentType];
  // Convierte "linea1\nlinea2" en N parrafos para que Word respete los
  // saltos de linea dentro de la celda (TextRun no respeta \n).
  const linesAsParagraphs = (
    text: string,
    align: AlignValue,
    style: { size: number; bold?: boolean; color?: string },
  ): Paragraph[] =>
    text.split(/\n/).map(
      (ln) =>
        new Paragraph({
          children: [new TextRun({ text: ln, ...style })],
          alignment: align,
        }),
    );

  const bodyCell = (
    text: string,
    width: number,
    align: AlignValue = AlignmentType.LEFT,
    bold = false,
    band?: "main" | "child",
  ) =>
    new TableCell({
      width: { size: width, type: WidthType.DXA },
      children: linesAsParagraphs(text, align, { size: 14, bold }),
      margins: { top: 50, bottom: 50, left: 40, right: 40 },
      ...(band ? { borders: band === "main" ? bandMain : bandChild } : {}),
    });

  // Variante azul clara con texto bold para filas "padre" (acreedor con
  // varias acreencias consolidadas).
  const parentCell = (
    text: string,
    width: number,
    align: AlignValue = AlignmentType.LEFT,
    band?: "main" | "child",
  ) =>
    new TableCell({
      width: { size: width, type: WidthType.DXA },
      children: linesAsParagraphs(text, align, { size: 14, bold: true, color: "0D2340" }),
      shading: { fill: "E8EEF7" },
      margins: { top: 50, bottom: 50, left: 40, right: 40 },
      ...(band ? { borders: band === "main" ? bandMain : bandChild } : {}),
    });

  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: headers.map((h, i) => headerCell(h, COL_WIDTHS[i])),
    }),
  ];

  let idx = 0;
  for (const grupo of grupos) {
    const multiple = grupo.acreencias.length > 1;

    if (!multiple) {
      idx += 1;
      const f = grupo.acreencias[0];
      const nombreConDocSimple = f.a.acreedor_documento
        ? `${f.a.acreedor_nombre} (${f.a.acreedor_documento})`
        : f.a.acreedor_nombre;
      const acreedorTxt = f.a.identificacion_credito
        ? `${nombreConDocSimple}\n${f.a.identificacion_credito}`
        : nombreConDocSimple;
      rows.push(
        new TableRow({
          children: [
            parentCell(String(idx), COL_WIDTHS[0], AlignmentType.CENTER, "main"),
            parentCell(acreedorTxt, COL_WIDTHS[1]),
            parentCell(CLASE_LABEL[f.a.clase_credito], COL_WIDTHS[2], AlignmentType.CENTER),
            parentCell(money(Number(f.a.con_capital)), COL_WIDTHS[3], AlignmentType.RIGHT),
            parentCell(money(Number(f.a.con_intereses_corrientes)), COL_WIDTHS[4], AlignmentType.RIGHT),
            parentCell(money(Number(f.a.con_intereses_moratorios)), COL_WIDTHS[5], AlignmentType.RIGHT),
            parentCell(money(Number(f.a.con_seguros)), COL_WIDTHS[6], AlignmentType.RIGHT),
            parentCell(money(Number(f.a.con_otros)), COL_WIDTHS[7], AlignmentType.RIGHT),
            parentCell(money(f.totalConciliado), COL_WIDTHS[8], AlignmentType.RIGHT),
            parentCell(pctFmt(Number(f.a.porcentaje_voto)), COL_WIDTHS[9], AlignmentType.CENTER),
            parentCell(f.a.es_pequeno_acreedor ? "Sí" : "-", COL_WIDTHS[10], AlignmentType.CENTER),
          ],
        }),
      );
      continue;
    }

    // Fila padre — acreedor con varias acreencias consolidadas
    idx += 1;
    const claseLabel = grupo.claseMixta ? "Mixta" : grupo.claseLabel ?? "";
    const nombreConDocumento = grupo.acreedorDocumento
      ? `${grupo.acreedorNombre} (${grupo.acreedorDocumento})`
      : grupo.acreedorNombre;
    rows.push(
      new TableRow({
        children: [
          parentCell(String(idx), COL_WIDTHS[0], AlignmentType.CENTER, "main"),
          parentCell(
            `${nombreConDocumento}\n${grupo.acreencias.length} acreencias`,
            COL_WIDTHS[1],
          ),
          parentCell(claseLabel, COL_WIDTHS[2], AlignmentType.CENTER),
          parentCell(money(grupo.totales.capital), COL_WIDTHS[3], AlignmentType.RIGHT),
          parentCell(money(grupo.totales.intCorr), COL_WIDTHS[4], AlignmentType.RIGHT),
          parentCell(money(grupo.totales.intMora), COL_WIDTHS[5], AlignmentType.RIGHT),
          parentCell(money(grupo.totales.seguros), COL_WIDTHS[6], AlignmentType.RIGHT),
          parentCell(money(grupo.totales.otros), COL_WIDTHS[7], AlignmentType.RIGHT),
          parentCell(money(grupo.totalConciliado), COL_WIDTHS[8], AlignmentType.RIGHT),
          parentCell(pctFmt(grupo.pctVotoGrupo), COL_WIDTHS[9], AlignmentType.CENTER),
          parentCell(grupo.todosPequenos ? "Sí" : "-", COL_WIDTHS[10], AlignmentType.CENTER),
        ],
      }),
    );

    // Sub-filas — cada acreencia desplegada (solo identificacion del credito)
    for (const f of grupo.acreencias) {
      rows.push(
        new TableRow({
          children: [
            bodyCell("", COL_WIDTHS[0], AlignmentType.CENTER, false, "child"),
            bodyCell(
              `      > ${f.a.identificacion_credito ?? "Sin identificación"}`,
              COL_WIDTHS[1],
            ),
            bodyCell(CLASE_LABEL[f.a.clase_credito], COL_WIDTHS[2], AlignmentType.CENTER),
            bodyCell(money(Number(f.a.con_capital)), COL_WIDTHS[3], AlignmentType.RIGHT),
            bodyCell(money(Number(f.a.con_intereses_corrientes)), COL_WIDTHS[4], AlignmentType.RIGHT),
            bodyCell(money(Number(f.a.con_intereses_moratorios)), COL_WIDTHS[5], AlignmentType.RIGHT),
            bodyCell(money(Number(f.a.con_seguros)), COL_WIDTHS[6], AlignmentType.RIGHT),
            bodyCell(money(Number(f.a.con_otros)), COL_WIDTHS[7], AlignmentType.RIGHT),
            bodyCell(money(f.totalConciliado), COL_WIDTHS[8], AlignmentType.RIGHT),
            bodyCell(pctFmt(Number(f.a.porcentaje_voto)), COL_WIDTHS[9], AlignmentType.CENTER),
            bodyCell(f.a.es_pequeno_acreedor ? "Sí" : "-", COL_WIDTHS[10], AlignmentType.CENTER),
          ],
        }),
      );
    }
  }

  // Fila de totales
  const totalCell = (text: string, width: number, align: AlignValue = AlignmentType.RIGHT) =>
    new TableCell({
      width: { size: width, type: WidthType.DXA },
      children: [
        new Paragraph({
          children: [new TextRun({ text, size: 14, bold: true })],
          alignment: align,
        }),
      ],
      margins: { top: 60, bottom: 60, left: 40, right: 40 },
    });

  rows.push(
    new TableRow({
      children: [
        totalCell("", COL_WIDTHS[0], AlignmentType.CENTER),
        totalCell("TOTALES", COL_WIDTHS[1], AlignmentType.LEFT),
        totalCell("", COL_WIDTHS[2], AlignmentType.CENTER),
        totalCell(money(totalCapital), COL_WIDTHS[3]),
        totalCell(money(totalIntCorr), COL_WIDTHS[4]),
        totalCell(money(totalIntMora), COL_WIDTHS[5]),
        totalCell(money(totalSeguros), COL_WIDTHS[6]),
        totalCell(money(totalOtros), COL_WIDTHS[7]),
        totalCell(money(totalGeneral), COL_WIDTHS[8]),
        totalCell("100.00%", COL_WIDTHS[9], AlignmentType.CENTER),
        totalCell("", COL_WIDTHS[10], AlignmentType.CENTER),
      ],
    })
  );

  const tableTotalWidth = COL_WIDTHS.reduce((s, w) => s + w, 0);
  const table = new Table({
    width: { size: tableTotalWidth, type: WidthType.DXA },
    columnWidths: COL_WIDTHS,
    rows,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "8A9DB8" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "8A9DB8" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "8A9DB8" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "8A9DB8" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "C4CEDE" },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: "C4CEDE" },
    },
  });

  const fechaHoy = new Date().toLocaleDateString("es-CO", { dateStyle: "long" });

  const children: (Paragraph | Table)[] = [
    new Paragraph({
      children: [
        new TextRun({ text: ctx.centro.nombre.toUpperCase(), bold: true, size: 24, color: "0D2340" }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${ctx.centro.ciudad}${ctx.centro.resolucion_habilitacion ? " — " + ctx.centro.resolucion_habilitacion : ""}`,
          size: 18,
          color: "4C5B73",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 320 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "RELACIÓN DEFINITIVA DE ACREENCIAS", bold: true, size: 22, color: "1B4F9B" }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Radicado: ", bold: true, size: 20 }),
        new TextRun({ text: ctx.caso.numero_radicado, size: 20 }),
      ],
      spacing: { after: 80 },
    }),
  ];

  if (ctx.convocante) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: "Deudor: ", bold: true, size: 20 }),
          new TextRun({ text: partyDisplayName(ctx.convocante), size: 20 }),
          new TextRun({
            text: `  (${ctx.convocante.numero_doc ?? ctx.convocante.nit_empresa ?? "sin doc."})`,
            size: 20,
            color: "4C5B73",
          }),
        ],
        spacing: { after: 80 },
      })
    );
  }

  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: "Fecha de expedición: ", bold: true, size: 20 }),
        new TextRun({ text: fechaHoy, size: 20 }),
      ],
      spacing: { after: 280 },
    }),
    table,
    new Paragraph({
      children: [
        new TextRun({
          text: "Cifras en pesos colombianos (COP). «Peq.» indica pequeño acreedor (suma acumulada ≤ 5% del total). El % de voto se calcula sobre el capital conciliado.",
          size: 16,
          italics: true,
          color: "4C5B73",
        }),
      ],
      spacing: { before: 240 },
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            // Margenes 1 pulgada (1440 twips) en los 4 lados — identicos
            // a los del PDF para que ambos exports se vean iguales.
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
            size: { orientation: PageOrientation.PORTRAIT },
          },
        },
        children: children as unknown as Paragraph[],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
