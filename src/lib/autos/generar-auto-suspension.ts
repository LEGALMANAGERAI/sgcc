// ============================================================
// Generador de Word del Auto de Suspensión y Reprogramación
// (Art. 551 C.G.P) de insolvencia.
//
// El texto fijo es VERBATIM de docs/autos/auto-suspension-estructura.md
// (no parafrasear). Las variables vienen de ResolvedAutoVars /
// AutoSuspensionOpciones. NOTA legal: el título cita el Art. 551 pero
// el RESUELVE cita el Art. 550 — así está en los autos originales y se
// deja igual a propósito.
// ============================================================
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  Header,
  Footer,
  ImageRun,
} from "docx";
import {
  BLOQUES_ESTANDAR,
  type ResolvedAutoVars,
  type AutoSuspensionOpciones,
  type QuorumFila,
} from "./types";

// ── Helpers locales ─────────────────────────────────────────

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

/** Devuelve el valor si tiene contenido, o un espacio "________" para no romper. */
function oBlank(v: string | null | undefined): string {
  const s = (v ?? "").trim();
  return s.length > 0 ? s : "________";
}

/**
 * Descarga el logo del centro y detecta su tipo para ImageRun (docx 9.x
 * requiere `type`). Si algo falla, retorna null y el membrete se arma sin
 * logo (no debe romper la generación).
 */
async function fetchLogo(
  url: string | null,
): Promise<{ data: Buffer; type: "png" | "jpg" | "gif" | "bmp" } | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = Buffer.from(await res.arrayBuffer());
    if (data.length === 0) return null;
    // Detección por firma de bytes (magic numbers).
    if (data[0] === 0x89 && data[1] === 0x50) return { data, type: "png" };
    if (data[0] === 0xff && data[1] === 0xd8) return { data, type: "jpg" };
    if (data[0] === 0x47 && data[1] === 0x49) return { data, type: "gif" };
    if (data[0] === 0x42 && data[1] === 0x4d) return { data, type: "bmp" };
    // Fallback por extensión de la URL.
    const lower = url.toLowerCase();
    if (lower.includes(".png")) return { data, type: "png" };
    if (lower.includes(".jpg") || lower.includes(".jpeg")) return { data, type: "jpg" };
    if (lower.includes(".gif")) return { data, type: "gif" };
    if (lower.includes(".bmp")) return { data, type: "bmp" };
    return null;
  } catch {
    return null;
  }
}

// Estilos compartidos (consistentes con docx-votacion / doc-generator).
const NAVY = "0D2340";
const GRAY = "4B5563";
const BODY_SIZE = 22; // 11 pt
const SMALL_SIZE = 16; // 8 pt (tablas)

/** Párrafo de cuerpo justificado con un solo run de texto. */
function bodyPara(
  text: string,
  opts: { bold?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; spacingAfter?: number } = {},
): Paragraph {
  return new Paragraph({
    alignment: opts.align ?? AlignmentType.JUSTIFIED,
    spacing: { after: opts.spacingAfter ?? 160 },
    children: [new TextRun({ text, bold: opts.bold, size: BODY_SIZE })],
  });
}

// ── Generador principal ─────────────────────────────────────

export async function generarAutoSuspension(
  vars: ResolvedAutoVars,
  opciones: AutoSuspensionOpciones,
): Promise<Buffer> {
  const { centro, operador, caso, deudor } = vars;

  const logo = await fetchLogo(centro.logo_url);

  // ── Header (membrete) — en todas las páginas ──────────────
  const membreteLineas: TextRun[][] = [
    [new TextRun({ text: centro.nombre ?? "", bold: true, size: 20, color: NAVY })],
    [new TextRun({ text: centro.resolucion_habilitacion ?? "", size: 14, color: GRAY })],
    [
      new TextRun({
        text: `${centro.resolucion_insolvencia ?? ""} Ministerio de Justicia – Código ${centro.codigo_ministerio ?? ""}`,
        size: 14,
        color: GRAY,
      }),
    ],
    [new TextRun({ text: centro.direccion ?? "", size: 14, color: GRAY })],
    [
      new TextRun({
        text: `Teléfono ${centro.telefono ?? ""} ${centro.email_radicacion ?? ""} y ${centro.email_secretaria ?? ""}`,
        size: 14,
        color: GRAY,
      }),
    ],
  ];

  const membreteTextParas = membreteLineas.map(
    (children) => new Paragraph({ alignment: AlignmentType.RIGHT, children }),
  );

  let headerChildren: (Paragraph | Table)[];
  if (logo) {
    // Logo a la izquierda, datos a la derecha (tabla sin bordes de 2 columnas).
    const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
    headerChildren = [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: noBorder,
          bottom: noBorder,
          left: noBorder,
          right: noBorder,
          insideHorizontal: noBorder,
          insideVertical: noBorder,
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 30, type: WidthType.PERCENTAGE },
                borders: {
                  top: noBorder,
                  bottom: noBorder,
                  left: noBorder,
                  right: noBorder,
                },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [
                      new ImageRun({
                        type: logo.type,
                        data: logo.data,
                        transformation: { width: 90, height: 90 },
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 70, type: WidthType.PERCENTAGE },
                borders: {
                  top: noBorder,
                  bottom: noBorder,
                  left: noBorder,
                  right: noBorder,
                },
                children: membreteTextParas,
              }),
            ],
          }),
        ],
      }),
      new Paragraph({ text: "" }),
    ];
  } else {
    headerChildren = [...membreteTextParas, new Paragraph({ text: "" })];
  }

  const header = new Header({ children: headerChildren as Paragraph[] });

  // ── Footer (pie VIGILADO) — en todas las páginas ──────────
  const pie = centro.pie_vigilado ?? "";
  const idxVig = pie.indexOf("VIGILADO");
  let footerRuns: TextRun[];
  if (idxVig >= 0) {
    // "VIGILADO" en negrita, el resto normal.
    const before = pie.slice(0, idxVig);
    const vigiladoWord = "VIGILADO";
    const after = pie.slice(idxVig + vigiladoWord.length);
    footerRuns = [
      ...(before ? [new TextRun({ text: before, size: 14, color: GRAY })] : []),
      new TextRun({ text: vigiladoWord, bold: true, size: 14, color: GRAY }),
      ...(after ? [new TextRun({ text: after, size: 14, color: GRAY })] : []),
    ];
  } else {
    footerRuns = [new TextRun({ text: pie, size: 14, color: GRAY })];
  }
  const footer = new Footer({
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, children: footerRuns }),
    ],
  });

  // ── Cuerpo del documento ──────────────────────────────────
  const children: (Paragraph | Table)[] = [];

  // 2. Ciudad y fecha
  children.push(
    bodyPara(`${oBlank(centro.ciudad)}, ${opciones.fecha_audiencia_texto || "________"}.`, {
      spacingAfter: 240,
    }),
  );

  // 3. Título
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [new TextRun({ text: `AUTO No. ${opciones.numero_auto || "________"}`, bold: true, size: 24, color: NAVY })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [new TextRun({ text: "SUSPENSIÓN Y REPROGRAMACIÓN", bold: true, size: 24, color: NAVY })],
    }),
  );

  // 4. Identificación
  children.push(
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({ text: "Radicado: ", bold: true, size: BODY_SIZE }),
        new TextRun({ text: oBlank(caso.radicado), size: BODY_SIZE }),
      ],
    }),
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({ text: "Deudor: ", bold: true, size: BODY_SIZE }),
        new TextRun({
          text: `${oBlank(deudor.nombre)} ${deudor.tipo_doc ?? ""} No. ${oBlank(deudor.documento)}`,
          size: BODY_SIZE,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 240 },
      children: [
        new TextRun({ text: "Asunto: ", bold: true, size: BODY_SIZE }),
        new TextRun({ text: "Auto de suspensión y reprogramación (Art. 551 C.G.P)", size: BODY_SIZE }),
      ],
    }),
  );

  // 5. Párrafo de apertura (VERBATIM con huecos)
  const aperturaTexto =
    `El ${opciones.fecha_audiencia_texto || "________"}, siendo ${opciones.hora_audiencia_texto || "________"} ` +
    `(${opciones.hora_audiencia_corta || "________"}), se da inicio a la audiencia de negociación de pasivos del proceso ` +
    `de referencia, admitido mediante Auto No. ${oBlank(caso.numero_auto_admisorio)} del ${oBlank(caso.fecha_auto_admisorio)}, ` +
    `se procede con las siguientes actividades las cuales se desarrollan de manera virtual mediante (LINK AUDIENCIA DE ` +
    `CONCILIACIÓN Join Zoom Meeting ${opciones.zoom_apertura_url || "________"} ID de reunión: ${opciones.zoom_apertura_id || "________"} ` +
    `Código de acceso: ${opciones.zoom_apertura_codigo || "________"}), en atención a implementar las tecnologías de la ` +
    `información y las comunicaciones en las actuaciones judiciales según la LEY 2213 DE 2022.`;
  children.push(bodyPara(aperturaTexto, { spacingAfter: 240 }));

  // 6. I. VERIFICACION DEL QUORUM
  children.push(
    bodyPara("I.    VERIFICACION DEL QUORUM", { bold: true, align: AlignmentType.CENTER, spacingAfter: 120 }),
    bodyPara("Registrada la asistencia se encuentran las siguientes personas:", { spacingAfter: 160 }),
    construirTablaQuorum(opciones.quorum, deudor),
    new Paragraph({ text: "", spacing: { after: 160 } }),
  );

  // 7. II. CONSIDERACIONES
  children.push(
    bodyPara("II.    CONSIDERACIONES", { bold: true, align: AlignmentType.CENTER, spacingAfter: 120 }),
    bodyPara("Una vez instalada la audiencia se presenta lo siguiente:", { spacingAfter: 160 }),
  );

  // Numeral 1 — FIJO verbatim, siempre.
  const NUMERAL_1 =
    "Verificado el quórum reglamentario, el suscrito operador procede a dejar constancia de que la convocatoria fue " +
    "realizada en debida forma, conforme a los términos previstos por la normativa aplicable. Así mismo, se hace constar " +
    "que la fecha y hora de inicio del presente procedimiento transcurren sin que se advierta irregularidad alguna.";
  let n = 1;
  children.push(bodyPara(`${n}) ${NUMERAL_1}`, { spacingAfter: 160 }));

  // Numerales siguientes: primero bloques estándar (en el orden de BLOQUES_ESTANDAR),
  // luego cada considerando libre.
  for (const bloque of BLOQUES_ESTANDAR) {
    if (opciones.bloques_estandar.includes(bloque.id)) {
      n += 1;
      children.push(bodyPara(`${n}) ${bloque.texto}`, { spacingAfter: 160 }));

      // 8. Tabla de acreencias — va justo tras el bloque que la anuncia.
      if (bloque.id === "relacion_acreencias" && opciones.incluir_tabla_acreencias) {
        children.push(
          construirTablaAcreencias(vars),
          new Paragraph({ text: "", spacing: { after: 160 } }),
        );
      }
    }
  }

  for (const cons of opciones.considerandos) {
    const texto = (cons ?? "").trim();
    if (texto.length === 0) continue;
    n += 1;
    children.push(bodyPara(`${n}) ${texto}`, { spacingAfter: 160 }));
  }

  // 9. Motivo de suspensión (último numeral si no está vacío) + frase puente.
  const motivo = (opciones.motivo_suspension ?? "").trim();
  if (motivo.length > 0) {
    n += 1;
    children.push(bodyPara(`${n}) ${motivo}`, { spacingAfter: 160 }));
  }
  children.push(
    bodyPara("En virtud de lo anterior, se han tomado las siguientes decisiones:", { spacingAfter: 200 }),
  );

  // 10. III. RESUELVE (VERBATIM con huecos)
  children.push(bodyPara("III.    RESUELVE:", { bold: true, align: AlignmentType.CENTER, spacingAfter: 160 }));

  const primero =
    `PRIMERO. SUSPENDER la audiencia y fijar como fecha de continuación el día ${opciones.continuacion_fecha || "________"} ` +
    `a las ${opciones.continuacion_hora || "________"}, para llevar a cabo la continuación de la audiencia de negociación de ` +
    `deudas contemplada en el artículo 550 del C.G.P., de manera virtual a través Del link ` +
    `${opciones.continuacion_zoom_url || "________"} Código de Acceso: ${opciones.continuacion_zoom_codigo || "________"}.`;
  children.push(bodyPara(primero, { spacingAfter: 160 }));
  children.push(bodyPara("SEGUNDO: Los presentes quedan notificados en audiencia.", { spacingAfter: 480 }));

  // 11. Firmas
  // Operador.
  children.push(
    new Paragraph({
      spacing: { before: 200, after: 40 },
      children: [new TextRun({ text: "___________________________________", size: BODY_SIZE })],
    }),
    new Paragraph({
      spacing: { after: 20 },
      children: [new TextRun({ text: oBlank(operador.nombre), bold: true, size: BODY_SIZE })],
    }),
    new Paragraph({
      spacing: { after: 20 },
      children: [new TextRun({ text: oBlank(operador.cargo), size: BODY_SIZE })],
    }),
    new Paragraph({
      spacing: { after: 20 },
      children: [
        new TextRun({
          text: `C.C. No. ${oBlank(operador.cedula)} de ${oBlank(operador.ciudad_cedula)}`,
          size: BODY_SIZE,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: `T.P. No. ${oBlank(operador.tarjeta_profesional)} del C.S. de la J.`,
          size: BODY_SIZE,
        }),
      ],
    }),
  );

  // Apoderado del deudor (si existe), centrado.
  const apo = deudor.apoderado;
  if (apo && (apo.nombre || apo.cedula || apo.tarjeta_profesional)) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 40 },
        children: [new TextRun({ text: "___________________________________", size: BODY_SIZE })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 20 },
        children: [new TextRun({ text: oBlank(apo.nombre), bold: true, size: BODY_SIZE })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 20 },
        children: [new TextRun({ text: `C. C. ${oBlank(apo.cedula)}`, size: BODY_SIZE })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 20 },
        children: [
          new TextRun({ text: `T.P. ${oBlank(apo.tarjeta_profesional)} del C.S. de la J.`, size: BODY_SIZE }),
        ],
      }),
    );
  }

  const doc = new Document({
    creator: "SIGECC",
    title: `Auto de suspensión y reprogramación — ${caso.radicado}`,
    sections: [
      {
        properties: {
          page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
        },
        headers: { default: header },
        footers: { default: footer },
        children: children as unknown as Paragraph[],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

// ── Tabla del quórum ────────────────────────────────────────

/**
 * Construye la tabla del quórum (2 columnas: ACREEDORES | APODERADO/REP. LEGAL),
 * agrupada por clase de crédito con una fila separadora a todo el ancho por
 * cada clase. Las filas del deudor (es_deudor=true) van al final con celdas
 * tituladas DEUDOR / APODERADO.
 */
function construirTablaQuorum(
  quorum: QuorumFila[],
  deudor: ResolvedAutoVars["deudor"],
): Table {
  const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: "C4CEDE" };

  const acreedores = quorum.filter((q) => !q.es_deudor);
  const deudores = quorum.filter((q) => q.es_deudor);

  // Encabezado.
  const headerCell = (text: string) =>
    new TableCell({
      width: { size: 50, type: WidthType.PERCENTAGE },
      shading: { fill: NAVY },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text, bold: true, size: SMALL_SIZE, color: "FFFFFF" })],
        }),
      ],
    });

  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [headerCell("ACREEDORES"), headerCell("APODERADO/REPRESENTANTE LEGAL")],
    }),
  ];

  // Fila separadora a todo el ancho con la clase en negrita centrada.
  const separadorClase = (clase: string) =>
    new TableRow({
      children: [
        new TableCell({
          columnSpan: 2,
          shading: { fill: "E8EEF7" },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: clase.toUpperCase() || "SIN CLASIFICAR", bold: true, size: SMALL_SIZE, color: NAVY }),
              ],
            }),
          ],
        }),
      ],
    });

  // Celda izquierda (acreedor): nombre, doc, email, tel, dir, estado.
  const celdaAcreedor = (q: QuorumFila) =>
    new TableCell({
      width: { size: 50, type: WidthType.PERCENTAGE },
      children: [
        parrafoLinea(oBlank(q.nombre), { bold: false }),
        parrafoLinea(`NIT/C.C. No.: ${oBlank(q.documento)}`),
        parrafoLinea(`Email: ${oBlank(q.email)}`),
        parrafoLinea(`Teléfono: ${oBlank(q.telefono)}`),
        parrafoLinea(`Dirección: ${oBlank(q.direccion)}`),
        parrafoLinea(estado(q.presente), { bold: true }),
      ],
    });

  // Celda derecha (apoderado). Si no hay apoderado, solo el estado.
  const celdaApoderado = (q: QuorumFila) => {
    const tieneApoderado = q.apoderado_presente !== null && (q.apoderado_nombre || q.apoderado_cedula);
    const hijos: Paragraph[] = tieneApoderado
      ? [
          parrafoLinea(`Apoderado: ${oBlank(q.apoderado_nombre)}`),
          parrafoLinea(`C.C. No.: ${oBlank(q.apoderado_cedula)}`),
          parrafoLinea(`T.P. No.: ${oBlank(q.apoderado_tp)} del C.S de la J.`),
          parrafoLinea(`Email: ${oBlank(q.apoderado_email)}`),
          parrafoLinea(`Teléfono: ${oBlank(q.apoderado_telefono)}`),
          parrafoLinea(`Dirección: ${oBlank(q.apoderado_direccion)}`),
          parrafoLinea(estado(q.apoderado_presente), { bold: true }),
        ]
      : [parrafoLinea(estado(q.apoderado_presente), { bold: true })];
    return new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: hijos });
  };

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
    rows.push(separadorClase(clase));
    for (const q of porClase.get(clase)!) {
      rows.push(new TableRow({ children: [celdaAcreedor(q), celdaApoderado(q)] }));
    }
  }

  // Filas del deudor al final: izquierda titulada DEUDOR, derecha APODERADO.
  for (const q of deudores) {
    const apo = deudor.apoderado;
    rows.push(
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              parrafoLinea("DEUDOR", { bold: true }),
              parrafoLinea(oBlank(q.nombre)),
              parrafoLinea(`NIT/C.C. No.: ${oBlank(q.documento)}`),
              parrafoLinea(`Email: ${oBlank(q.email)}`),
              parrafoLinea(`Teléfono: ${oBlank(q.telefono)}`),
              parrafoLinea(`Dirección: ${oBlank(q.direccion)}`),
              parrafoLinea(estado(q.presente), { bold: true }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              parrafoLinea("APODERADO", { bold: true }),
              parrafoLinea(`Apoderado: ${oBlank(apo?.nombre ?? q.apoderado_nombre)}`),
              parrafoLinea(`C.C. No.: ${oBlank(apo?.cedula ?? q.apoderado_cedula)}`),
              parrafoLinea(`T.P. No.: ${oBlank(apo?.tarjeta_profesional ?? q.apoderado_tp)} del C.S de la J.`),
              parrafoLinea(`Email: ${oBlank(apo?.email ?? q.apoderado_email)}`),
              parrafoLinea(`Teléfono: ${oBlank(apo?.telefono ?? q.apoderado_telefono)}`),
              parrafoLinea(`Dirección: ${oBlank(apo?.direccion ?? q.apoderado_direccion)}`),
              parrafoLinea(estado(q.apoderado_presente), { bold: true }),
            ],
          }),
        ],
      }),
    );
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: thinBorder,
      bottom: thinBorder,
      left: thinBorder,
      right: thinBorder,
      insideHorizontal: thinBorder,
      insideVertical: thinBorder,
    },
    rows,
  });
}

/** Párrafo pequeño de una línea para celdas del quórum. */
function parrafoLinea(text: string, opts: { bold?: boolean } = {}): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: opts.bold, size: SMALL_SIZE })],
  });
}

// ── Tabla de acreencias ─────────────────────────────────────

/**
 * Construye la tabla de relación de acreencias desde vars.acreedores con
 * fila de TOTALES (% Voto = 100,00%). Montos en pesos colombianos.
 */
function construirTablaAcreencias(vars: ResolvedAutoVars): Table {
  const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: "8A9DB8" };
  const thinInside = { style: BorderStyle.SINGLE, size: 2, color: "C4CEDE" };

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
  const COL_WIDTHS = [340, 2400, 460, 980, 860, 860, 780, 730, 1010, 540, 400];

  type AlignValue = (typeof AlignmentType)[keyof typeof AlignmentType];

  const headerCell = (text: string, width: number) =>
    new TableCell({
      width: { size: width, type: WidthType.DXA },
      shading: { fill: NAVY },
      margins: { top: 60, bottom: 60, left: 40, right: 40 },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text, bold: true, size: 14, color: "FFFFFF" })],
        }),
      ],
    });

  const bodyCell = (text: string, width: number, align: AlignValue = AlignmentType.LEFT, bold = false) =>
    new TableCell({
      width: { size: width, type: WidthType.DXA },
      margins: { top: 50, bottom: 50, left: 40, right: 40 },
      children: [
        new Paragraph({
          alignment: align,
          children: [new TextRun({ text, size: 14, bold })],
        }),
      ],
    });

  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: headers.map((h, i) => headerCell(h, COL_WIDTHS[i])),
    }),
  ];

  let totCapital = 0;
  let totIntCorr = 0;
  let totIntMora = 0;
  let totSeguros = 0;
  let totOtros = 0;
  let totTotal = 0;

  vars.acreedores.forEach((a, i) => {
    totCapital += a.capital;
    totIntCorr += a.intereses_corrientes;
    totIntMora += a.intereses_moratorios;
    totSeguros += a.seguros;
    totOtros += a.otros;
    totTotal += a.total;
    rows.push(
      new TableRow({
        children: [
          bodyCell(String(i + 1), COL_WIDTHS[0], AlignmentType.CENTER),
          bodyCell(
            a.documento ? `${a.nombre} (${a.documento})` : a.nombre,
            COL_WIDTHS[1],
          ),
          bodyCell(a.clase_credito ?? "-", COL_WIDTHS[2], AlignmentType.CENTER),
          bodyCell(money(a.capital), COL_WIDTHS[3], AlignmentType.RIGHT),
          bodyCell(money(a.intereses_corrientes), COL_WIDTHS[4], AlignmentType.RIGHT),
          bodyCell(money(a.intereses_moratorios), COL_WIDTHS[5], AlignmentType.RIGHT),
          bodyCell(money(a.seguros), COL_WIDTHS[6], AlignmentType.RIGHT),
          bodyCell(money(a.otros), COL_WIDTHS[7], AlignmentType.RIGHT),
          bodyCell(money(a.total), COL_WIDTHS[8], AlignmentType.RIGHT),
          bodyCell(pctVoto(a.porcentaje_voto), COL_WIDTHS[9], AlignmentType.CENTER),
          bodyCell(a.es_pequeno ? "Sí" : "-", COL_WIDTHS[10], AlignmentType.CENTER),
        ],
      }),
    );
  });

  // Fila de TOTALES (% Voto = 100,00%).
  const totalCell = (text: string, width: number, align: AlignValue = AlignmentType.RIGHT) =>
    new TableCell({
      width: { size: width, type: WidthType.DXA },
      margins: { top: 60, bottom: 60, left: 40, right: 40 },
      children: [
        new Paragraph({
          alignment: align,
          children: [new TextRun({ text, size: 14, bold: true })],
        }),
      ],
    });

  rows.push(
    new TableRow({
      children: [
        totalCell("", COL_WIDTHS[0], AlignmentType.CENTER),
        totalCell("TOTALES", COL_WIDTHS[1], AlignmentType.LEFT),
        totalCell("", COL_WIDTHS[2], AlignmentType.CENTER),
        totalCell(money(totCapital), COL_WIDTHS[3]),
        totalCell(money(totIntCorr), COL_WIDTHS[4]),
        totalCell(money(totIntMora), COL_WIDTHS[5]),
        totalCell(money(totSeguros), COL_WIDTHS[6]),
        totalCell(money(totOtros), COL_WIDTHS[7]),
        totalCell(money(totTotal), COL_WIDTHS[8]),
        totalCell("100,00%", COL_WIDTHS[9], AlignmentType.CENTER),
        totalCell("", COL_WIDTHS[10], AlignmentType.CENTER),
      ],
    }),
  );

  const tableTotalWidth = COL_WIDTHS.reduce((s, w) => s + w, 0);
  return new Table({
    width: { size: tableTotalWidth, type: WidthType.DXA },
    columnWidths: COL_WIDTHS,
    rows,
    borders: {
      top: thinBorder,
      bottom: thinBorder,
      left: thinBorder,
      right: thinBorder,
      insideHorizontal: thinInside,
      insideVertical: thinInside,
    },
  });
}
