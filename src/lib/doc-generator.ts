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
  const filas = prepararFilasRelacion(ctx.acreencias);

  const totalCapital = filas.reduce((s, f) => s + Number(f.a.con_capital), 0);
  const totalIntCorr = filas.reduce((s, f) => s + Number(f.a.con_intereses_corrientes), 0);
  const totalIntMora = filas.reduce((s, f) => s + Number(f.a.con_intereses_moratorios), 0);
  const totalSeguros = filas.reduce((s, f) => s + Number(f.a.con_seguros), 0);
  const totalOtros = filas.reduce((s, f) => s + Number(f.a.con_otros), 0);
  const totalGeneral = totalCapital + totalIntCorr + totalIntMora + totalSeguros + totalOtros;

  const headers = [
    "#",
    "Acreedor",
    "Documento",
    "Clase",
    "Capital",
    "Int. corr.",
    "Int. mora",
    "Seguros",
    "Otros",
    "Total conciliado",
    "% Voto",
    "Peq.",
  ];

  const headerCell = (text: string) =>
    new TableCell({
      children: [
        new Paragraph({
          children: [new TextRun({ text, bold: true, size: 16, color: "FFFFFF" })],
          alignment: AlignmentType.CENTER,
        }),
      ],
      shading: { fill: "0D2340" },
      margins: { top: 80, bottom: 80, left: 60, right: 60 },
    });

  type AlignValue = (typeof AlignmentType)[keyof typeof AlignmentType];
  const bodyCell = (text: string, align: AlignValue = AlignmentType.LEFT, bold = false) =>
    new TableCell({
      children: [
        new Paragraph({
          children: [new TextRun({ text, size: 16, bold })],
          alignment: align,
        }),
      ],
      margins: { top: 60, bottom: 60, left: 60, right: 60 },
    });

  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: headers.map(headerCell),
    }),
  ];

  filas.forEach((f, idx) => {
    rows.push(
      new TableRow({
        children: [
          bodyCell(String(idx + 1), AlignmentType.CENTER),
          bodyCell(f.a.acreedor_nombre),
          bodyCell(f.a.acreedor_documento ?? "—"),
          bodyCell(CLASE_LABEL[f.a.clase_credito], AlignmentType.CENTER),
          bodyCell(money(Number(f.a.con_capital)), AlignmentType.RIGHT),
          bodyCell(money(Number(f.a.con_intereses_corrientes)), AlignmentType.RIGHT),
          bodyCell(money(Number(f.a.con_intereses_moratorios)), AlignmentType.RIGHT),
          bodyCell(money(Number(f.a.con_seguros)), AlignmentType.RIGHT),
          bodyCell(money(Number(f.a.con_otros)), AlignmentType.RIGHT),
          bodyCell(money(f.totalConciliado), AlignmentType.RIGHT, true),
          bodyCell(pctFmt(Number(f.a.porcentaje_voto)), AlignmentType.CENTER),
          bodyCell(f.a.es_pequeno_acreedor ? "Sí" : "—", AlignmentType.CENTER),
        ],
      })
    );
  });

  // Fila de totales
  const totalCell = (text: string, align: AlignValue = AlignmentType.RIGHT) =>
    new TableCell({
      children: [
        new Paragraph({
          children: [new TextRun({ text, size: 16, bold: true })],
          alignment: align,
        }),
      ],
      shading: { fill: "E8EEF7" },
      margins: { top: 80, bottom: 80, left: 60, right: 60 },
    });

  rows.push(
    new TableRow({
      children: [
        totalCell("", AlignmentType.CENTER),
        totalCell("TOTALES", AlignmentType.LEFT),
        totalCell("", AlignmentType.LEFT),
        totalCell("", AlignmentType.CENTER),
        totalCell(money(totalCapital)),
        totalCell(money(totalIntCorr)),
        totalCell(money(totalIntMora)),
        totalCell(money(totalSeguros)),
        totalCell(money(totalOtros)),
        totalCell(money(totalGeneral)),
        totalCell("100.00%", AlignmentType.CENTER),
        totalCell("", AlignmentType.CENTER),
      ],
    })
  );

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
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
