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
} from "docx";
import { partyDisplayName } from "@/types";
import type {
  VotacionPdfInput as VotacionExportInput,
} from "./pdf-votacion";

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

type AlignmentValue = (typeof AlignmentType)[keyof typeof AlignmentType];

function celda(text: string, opts: { bold?: boolean; align?: AlignmentValue; bg?: string; color?: string; width?: number } = {}) {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.bg ? { fill: opts.bg } : undefined,
    children: [
      new Paragraph({
        alignment: opts.align ?? AlignmentType.LEFT,
        children: [new TextRun({ text, bold: opts.bold, size: 16, color: opts.color })],
      }),
    ],
  });
}

/**
 * Genera un Word (.docx) con el acta de votación de la propuesta de pago.
 */
export async function generarVotacionDocx(input: VotacionExportInput): Promise<Buffer> {
  const { caso, centro, convocante, propuesta, votos, resumen } = input;

  const fechaVot = propuesta.fecha_votacion
    ? new Date(propuesta.fecha_votacion).toLocaleDateString("es-CO", { dateStyle: "long" })
    : new Date().toLocaleDateString("es-CO", { dateStyle: "long" });

  const headerCells = ["#", "Acreedor", "Documento", "Capital conc.", "% Voto", "Voto", "Observaciones"].map(
    (h) => celda(h, { bold: true, align: AlignmentType.CENTER, bg: "0D2340", color: "FFFFFF" }),
  );

  const filas: TableRow[] = [
    new TableRow({ tableHeader: true, children: headerCells }),
    ...votos.map(
      (v, idx) =>
        new TableRow({
          children: [
            celda(String(idx + 1), { align: AlignmentType.CENTER }),
            celda(
              v.num_creditos > 1
                ? `${v.acreedor_nombre} (${v.num_creditos} créditos)`
                : v.acreedor_nombre,
            ),
            celda(v.acreedor_documento ?? "-"),
            celda(money(v.capital_total), { align: AlignmentType.RIGHT }),
            celda(pctFmt(v.porcentaje_voto), { align: AlignmentType.CENTER }),
            celda(v.voto ? VOTO_LABEL[v.voto] : "Pendiente", {
              align: AlignmentType.CENTER,
              bold: !!v.voto,
              color: v.voto === "positivo" ? "166534" : v.voto === "negativo" ? "991B1B" : undefined,
            }),
            celda(v.observaciones ?? ""),
          ],
        }),
    ),
  ];

  const resultadoLabel =
    resumen.estado_resultado === "aprobada"
      ? "PROPUESTA APROBADA"
      : resumen.estado_resultado === "rechazada"
        ? "PROPUESTA RECHAZADA"
        : "VOTACIÓN EN CURSO";
  const resultadoColor =
    resumen.estado_resultado === "aprobada"
      ? "166534"
      : resumen.estado_resultado === "rechazada"
        ? "991B1B"
        : "1B4F9B";

  const docInst = new Document({
    creator: "SGCC",
    title: `Acta de votación — ${caso.numero_radicado}`,
    sections: [
      {
        properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: centro.nombre.toUpperCase(), bold: true, size: 26, color: "0D2340" })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `${centro.ciudad}${centro.resolucion_habilitacion ? " - " + centro.resolucion_habilitacion : ""}`,
                size: 18,
                color: "4B5563",
              }),
            ],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: "ACTA DE VOTACIÓN — PROPUESTA DE PAGO", bold: true, color: "1B4F9B" })],
          }),
          new Paragraph({ text: "" }),

          new Paragraph({
            children: [
              new TextRun({ text: "Radicado: ", bold: true, color: "0D2340" }),
              new TextRun({ text: caso.numero_radicado }),
            ],
          }),
          ...(convocante
            ? [
                new Paragraph({
                  children: [
                    new TextRun({ text: "Deudor: ", bold: true, color: "0D2340" }),
                    new TextRun({
                      text: `${partyDisplayName(convocante)} (${convocante.numero_doc ?? convocante.nit_empresa ?? "sin doc."})`,
                    }),
                  ],
                }),
              ]
            : []),
          new Paragraph({
            children: [
              new TextRun({ text: "Fecha votación: ", bold: true, color: "0D2340" }),
              new TextRun({ text: fechaVot }),
            ],
          }),
          ...(propuesta.modo_votacion
            ? [
                new Paragraph({
                  children: [
                    new TextRun({ text: "Modalidad: ", bold: true, color: "0D2340" }),
                    new TextRun({ text: MODO_LABEL[propuesta.modo_votacion] }),
                  ],
                }),
              ]
            : []),
          new Paragraph({ text: "" }),

          new Paragraph({
            heading: HeadingLevel.HEADING_3,
            children: [new TextRun({ text: "Propuesta de pago", bold: true, color: "1B4F9B" })],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Título: ", bold: true, color: "0D2340" }),
              new TextRun({ text: propuesta.titulo }),
            ],
          }),
          ...(propuesta.plazo_meses != null || propuesta.tasa_interes || propuesta.periodo_gracia_meses
            ? [
                new Paragraph({
                  children: [
                    new TextRun({ text: "Condiciones: ", bold: true, color: "0D2340" }),
                    new TextRun({
                      text: [
                        propuesta.plazo_meses != null ? `Plazo: ${propuesta.plazo_meses} meses` : null,
                        propuesta.tasa_interes ? `Tasa: ${propuesta.tasa_interes}` : null,
                        propuesta.periodo_gracia_meses ? `Gracia: ${propuesta.periodo_gracia_meses} meses` : null,
                      ]
                        .filter(Boolean)
                        .join("  ·  "),
                    }),
                  ],
                }),
              ]
            : []),
          ...(propuesta.descripcion
            ? [
                new Paragraph({
                  children: [new TextRun({ text: "Descripción: ", bold: true, color: "0D2340" })],
                }),
                ...propuesta.descripcion.split("\n").map(
                  (line) => new Paragraph({ children: [new TextRun({ text: line })] }),
                ),
              ]
            : []),
          new Paragraph({ text: "" }),

          new Paragraph({
            heading: HeadingLevel.HEADING_3,
            children: [new TextRun({ text: "Registro de votos por acreedor", bold: true, color: "1B4F9B" })],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: "C4CEDE" },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: "C4CEDE" },
              left: { style: BorderStyle.SINGLE, size: 4, color: "C4CEDE" },
              right: { style: BorderStyle.SINGLE, size: 4, color: "C4CEDE" },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "C4CEDE" },
              insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "C4CEDE" },
            },
            rows: filas,
          }),
          new Paragraph({ text: "" }),

          new Paragraph({
            heading: HeadingLevel.HEADING_3,
            children: [new TextRun({ text: "Resumen y resultado", bold: true, color: "1B4F9B" })],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Total acreedores únicos: ", bold: true, color: "0D2340" }),
              new TextRun({ text: String(resumen.total_acreedores) }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "A favor: ", bold: true, color: "0D2340" }),
              new TextRun({
                text: `${resumen.acreedores_positivos} acreedor(es) — ${pctFmt(resumen.porcentaje_positivo)}`,
                color: "166534",
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "En contra: ", bold: true, color: "0D2340" }),
              new TextRun({
                text: `${resumen.acreedores_negativos} acreedor(es) — ${pctFmt(resumen.porcentaje_negativo)}`,
                color: "991B1B",
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Abstenciones: ", bold: true, color: "0D2340" }),
              new TextRun({ text: `${resumen.acreedores_abstuvieron} acreedor(es)` }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Pendientes: ", bold: true, color: "0D2340" }),
              new TextRun({ text: `${resumen.acreedores_pendientes} acreedor(es)` }),
            ],
          }),
          new Paragraph({ text: "" }),

          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: resultadoLabel, bold: true, size: 24, color: resultadoColor })],
          }),
          new Paragraph({ text: "" }),

          new Paragraph({
            children: [
              new TextRun({
                text: 'Regla de aprobación (Ley 1564/2012): >50% del capital total y al menos 2 acreedores únicos votando a favor. Cifras en pesos colombianos. El % de voto del acreedor consolida los créditos a su nombre.',
                italics: true,
                size: 16,
                color: "4B5563",
              }),
            ],
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(docInst);
  return buffer;
}
