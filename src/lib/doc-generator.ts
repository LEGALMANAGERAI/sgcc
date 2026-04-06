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
import type { SgccCase, SgccCenter, SgccParty, SgccStaff, SgccActa, ObligacionItem } from "@/types";
import { partyDisplayName } from "@/types";

interface CaseContext {
  caso: SgccCase;
  centro: SgccCenter;
  convocante: SgccParty;
  convocados: SgccParty[];
  conciliador: SgccStaff | null;
  acta?: SgccActa;
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
    "conciliador.nombre": ctx.conciliador?.nombre ?? "",
    "conciliador.tarjeta": ctx.conciliador?.tarjeta_profesional ?? "",
    "fecha.hoy": new Date().toLocaleDateString("es-CO", { dateStyle: "long" }),
    "acta.numero": ctx.acta?.numero_acta ?? "",
    "acta.tipo": ctx.acta?.tipo ?? "",
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
          color: "B8860B",
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
