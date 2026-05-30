/**
 * Genera un documento Word ejecutivo del Plan de Pricing y Go-to-Market de SIGECC.
 * Uso: node scripts/generar-pricing-gtm.mjs
 */
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  PageOrientation, LevelFormat, convertInchesToTwip,
} from "docx";
import { writeFileSync } from "fs";

const NAVY = "0D2340";
const GOLD = "1B4F9B";
const GRAY_LIGHT = "F3F4F6";
const GRAY_BORDER = "E5E7EB";

/* ─── helpers ─────────────────────────────────────────────────────────────── */

const txt = (text, opts = {}) =>
  new TextRun({
    text,
    bold: opts.bold,
    italics: opts.italics,
    color: opts.color,
    size: opts.size,
    font: opts.font ?? "Calibri",
  });

const p = (text, opts = {}) =>
  new Paragraph({
    spacing: { after: opts.after ?? 120, before: opts.before ?? 0, line: 300 },
    alignment: opts.alignment,
    children: Array.isArray(text) ? text : [txt(text, opts)],
  });

const h1 = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 160 },
    children: [txt(text, { bold: true, color: NAVY, size: 32 })],
  });

const h2 = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 100 },
    children: [txt(text, { bold: true, color: NAVY, size: 26 })],
  });

const h3 = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 160, after: 80 },
    children: [txt(text, { bold: true, color: GOLD, size: 22 })],
  });

const bullet = (text) =>
  new Paragraph({
    spacing: { after: 60, line: 300 },
    bullet: { level: 0 },
    children: Array.isArray(text) ? text : [txt(text)],
  });

const cellBorders = {
  top:    { style: BorderStyle.SINGLE, size: 4, color: GRAY_BORDER },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: GRAY_BORDER },
  left:   { style: BorderStyle.SINGLE, size: 4, color: GRAY_BORDER },
  right:  { style: BorderStyle.SINGLE, size: 4, color: GRAY_BORDER },
};

const cell = (children, opts = {}) =>
  new TableCell({
    children: children.map((c) => (typeof c === "string" ? p(c, { after: 0 }) : c)),
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined,
    borders: cellBorders,
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
  });

const headerCell = (text, width) =>
  new TableCell({
    children: [p([txt(text, { bold: true, color: "FFFFFF", size: 20 })], { after: 0 })],
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    shading: { fill: NAVY, type: ShadingType.CLEAR },
    borders: cellBorders,
    margins: { top: 120, bottom: 120, left: 120, right: 120 },
  });

/** Construye una tabla simple. `rows` = array de array de strings o objetos {text, opts} */
const table = (headers, rows, widths) => {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => headerCell(h, widths?.[i])),
  });

  const bodyRows = rows.map((row, ri) =>
    new TableRow({
      children: row.map((c, ci) => {
        const isObj = typeof c === "object" && c !== null && !Array.isArray(c);
        const content = isObj ? c.text : c;
        const opts = isObj ? c.opts ?? {} : {};
        const shading = ri % 2 === 0 ? "FFFFFF" : GRAY_LIGHT;
        return cell(
          [p([txt(content, { bold: opts.bold, color: opts.color, size: 19 })], { after: 0 })],
          { width: widths?.[ci], shading: opts.shading ?? shading },
        );
      }),
    }),
  );

  return new Table({
    rows: [headerRow, ...bodyRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
  });
};

const spacer = (height = 200) =>
  new Paragraph({ spacing: { before: height, after: 0 }, children: [txt("")] });

/* ─── Contenido del documento ─────────────────────────────────────────────── */

const today = new Date().toLocaleDateString("es-CO", { dateStyle: "long" });

const children = [];

// ───── Portada ─────
children.push(
  new Paragraph({
    spacing: { before: 1200, after: 200 },
    alignment: AlignmentType.CENTER,
    children: [txt("SIGECC", { bold: true, color: NAVY, size: 56 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
    children: [txt("Plan de Pricing y Go-to-Market", { bold: true, color: GOLD, size: 36 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [txt("Mercado colombiano · Centros de conciliación", { color: "555555", size: 22 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 600 },
    children: [txt(`Documento ejecutivo · ${today}`, { color: "888888", size: 18, italics: true })],
  }),
  spacer(400),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [txt(
      "Resumen ejecutivo, diagnóstico de mercado, modelo de pricing,\nunit economics, packaging por plan, estrategia por segmento\ny motion comercial a 180 días.",
      { color: "555555", size: 20 },
    )],
  }),
);

// ───── Resumen ejecutivo ─────
children.push(
  h1("Resumen ejecutivo"),
  p("SIGECC es un SaaS B2B para la gestión integral de centros de conciliación en Colombia. El mercado objetivo accionable son aproximadamente 330 a 380 centros (privados independientes, consultorios jurídicos universitarios y notariales). El único competidor SaaS directo identificado es Litivo (Fundación Liborio Mejía), con comercialización opaca y sin precios públicos, lo que abre espacio para una propuesta moderna, transparente y SaaS-pura."),
  p("Se propone un modelo de plan fijo por centro con cinco tiers — Académico (gratis para captura universitaria), Privado Esencial ($490K COP/mes), Privado Profesional ($1.090K), Notarial/Multi-sede ($1.990K) y Enterprise (desde $3.500K) — más add-ons de consumo para firma electrónica, IA jurídica y vigilancia judicial. Las metas a 12 meses son 30 centros pagos, MRR de $35M COP, ARPU de $1.100K, LTV/CAC ≥ 5× y churn mensual inferior al 1%."),
  p("El Decreto 1136/2025 y la Ley 2445/2025, que exigen infraestructura tecnológica para la habilitación y audiencias virtuales, son el catalizador comercial. El mensaje central recomendado: \"habilitación tecnológica Ley 2445 lista, sin esfuerzo\"."),
);

// ───── 1. Diagnóstico de mercado ─────
children.push(
  h1("1. Diagnóstico de mercado (Colombia)"),

  h2("1.1 Tamaño y segmentos"),
  table(
    ["Métrica", "Cifra", "Fuente"],
    [
      ["Centros de conciliación activos en Colombia", "388 (28 departamentos, 85 ciudades)", "MinJusticia / SICAAC"],
      ["Consultorios jurídicos universitarios (est.)", "~130 centros", "Extrapolación 33,5%"],
      ["Privados independientes (no cámara)", "~150 centros", "Extrapolación 54,25% × 72%"],
      ["Notariales con habilitación", "50 – 100 centros", "Estimación conservadora (UCNC)"],
      [{ text: "TAM accionable SIGECC", opts: { bold: true } }, { text: "≈ 330 – 380 centros", opts: { bold: true, color: NAVY } }, "Excluye cámaras y públicos"],
    ],
    [40, 30, 30],
  ),

  h2("1.2 Marco regulatorio relevante"),
  table(
    ["Norma", "Implicación comercial"],
    [
      ["Ley 2220/2022 (Estatuto de Conciliación)", "Obliga reglamento interno, política de calidad, código de ética y registro SICAAC. Notarios y consultorios pueden formalizar centro propio."],
      ["Ley 2445/2025 (Insolvencia PNNC y pequeño comerciante)", "Reduce plazos (20→10 días), valida audiencias virtuales y exige infraestructura tecnológica → palanca directa de venta."],
      ["Decreto 1136/2025 (DO 53286, 27-oct-2025)", "Reglamenta requisitos tecnológicos para habilitación. Plazo: 1-ene-2026."],
      ["Resolución 0018/2016", "SICAAC como obligatorio para registro de actas y casos."],
    ],
    [38, 62],
  ),

  h2("1.3 Tarifas que cobran los centros (presupuesto disponible)"),
  table(
    ["Trámite", "Tarifa máxima 2025"],
    [
      ["Conciliación sin cuantía", "89,88 UVT  ≈  $1.295.252 COP"],
      ["Conciliación con cuantía < 200 UVT", "7,51 UVT  ≈  $108.000 COP"],
      ["Conciliación con cuantía > 1.301 UVT", "3,50% sobre el monto"],
      [{ text: "Insolvencia PNNC (máxima)", opts: { bold: true } }, { text: "750,68 UVT  ≈  $37.383.113 COP", opts: { bold: true, color: NAVY } }],
    ],
    [55, 45],
  ),
  p([
    txt("Lectura: ", { bold: true }),
    txt("un centro privado mediano que tramite 30 insolvencias y 80 conciliaciones por año puede facturar entre $200M y $1.500M COP. Un SaaS de $300K – $800K mensual representa menos del 3% de sus ingresos — fricción de precio mínima si el ROI operativo está claro."),
  ]),
);

// ───── 2. Competencia ─────
children.push(
  h1("2. Competencia y posicionamiento"),

  h2("2.1 Competencia directa"),
  table(
    ["Producto", "Detalle"],
    [
      ["Litivo (Fundación Liborio Mejía)", "Desde 2018. 333 usuarios declarados. NO publica precios. Comercialización opaca, ligada a la fundación. UX legacy; sin portal de partes moderno ni ticketing."],
      ["SICAAC (MinJusticia)", "Gratuito y obligatorio, pero solo registro/reporte. NO es gestión: sin workflows, portal, generación de actas ni firma electrónica. SIGECC se complementa integrándose con él."],
      ["Otros candidatos investigados", "ConciliApp, iJusticia, Conciliemos: no existen como SaaS comercial. Cámaras de comercio: desarrollos internos. Personería Bogotá: plataforma cautiva."],
    ],
    [32, 68],
  ),
  p([
    txt("Conclusión: ", { bold: true }),
    txt("el espacio SaaS específico para centros de conciliación en Colombia tiene esencialmente UN competidor real (Litivo). SIGECC entra como alternativa moderna, transparente y de mejor UX."),
  ]),

  h2("2.2 Competencia indirecta — gestión legal genérica"),
  table(
    ["Producto", "Precio público", "Notas"],
    [
      ["CM Gestión Abogados (CO)", "$0 / $49.900 / $149.900 COP/mes", "Freemium + IA + sync judicial"],
      ["LegalSurf (LatAm)", "Desde ~$25 USD/mes; Pro ~$64/usuario", "Por tamaño de equipo"],
      ["LemonTech (LatAm, líder)", "No público", "Starter/Pro/Enterprise; cobertura 19 países"],
      ["Clio Manage (US, referente)", "$49 – $159 USD/usuario/mes", "Per-user"],
      ["MyCase (US)", "$39 – $119 USD/usuario/mes", "Per-user"],
      ["PracticePanther (US)", "$49 – $114 USD/usuario/mes", "Per-user"],
    ],
    [30, 32, 38],
  ),

  h2("2.3 Diferenciadores clave de SIGECC"),
  bullet("Integración con SICAAC: elimina la doble digitación de actas y casos."),
  bullet("Portal de partes con widget embebible y ticketing — radicación pública sin papeles."),
  bullet("Firma electrónica certificada vía Legal Manager partner (modelo redirect)."),
  bullet("Cumplimiento Ley 2445/2025 y Decreto 1136/2025 listo desde el día uno."),
  bullet("Multi-tenant SaaS puro: sin instalación, sin servidores, updates continuos."),
  bullet("Módulos diferenciales: SICAAC expedientes, agenda con audiencias, plantillas propias por centro, propuestas de pago estructuradas, librería de cláusulas, votación con quórum, acuerdos."),
  bullet("Formato de radicado totalmente configurable por centro, con contador atómico (concurrencia segura)."),
);

// ───── 3. Modelo de pricing ─────
children.push(
  h1("3. Modelo de pricing"),

  h2("3.1 Decisiones base"),
  table(
    ["Decisión", "Recomendación"],
    [
      ["Modelo base", "Plan fijo por centro + tier por tamaño (volumen de casos/año como anclaje) + add-ons de consumo para firma electrónica e IA."],
      ["Unidad de cobro", "El centro (no por usuario). Usuarios incluidos generosos en cada tier."],
      ["Frecuencia", "Mensual y anual. Anual con 20% de descuento (anclaje LTV). Contrato 12 meses por ciclo regulatorio."],
      ["Moneda", "COP en factura. USD en cotización internacional/referencia."],
      ["Onboarding", "Setup gratis en Esencial y Profesional. Setup tarifa única en Enterprise."],
      ["Trial", "30 días sin tarjeta en Privado Esencial. Demo + piloto 60 días para Profesional/Enterprise."],
    ],
    [25, 75],
  ),

  h2("3.2 Tiers propuestos"),
  table(
    ["Plan", "Target", "Casos/año", "Staff", "Mensual (COP)", "Anual -20%"],
    [
      [{ text: "Académico", opts: { bold: true } }, "Consultorios jurídicos universitarios", "50", "5", { text: "Gratis", opts: { bold: true, color: "16A34A" } }, "Gratis"],
      [{ text: "Privado Esencial", opts: { bold: true } }, "Centro privado pequeño / notarial chico", "100", "5", { text: "$490.000", opts: { bold: true, color: NAVY } }, "$392.000"],
      [{ text: "Privado Profesional ⭐", opts: { bold: true } }, "Centro privado mediano", "400", "15", { text: "$1.090.000", opts: { bold: true, color: NAVY } }, "$872.000"],
      [{ text: "Notarial / Multi-sede", opts: { bold: true } }, "Notarías con centro + multi-sede", "800", "25", { text: "$1.990.000", opts: { bold: true, color: NAVY } }, "$1.592.000"],
      [{ text: "Enterprise", opts: { bold: true } }, "Cámara, red de centros, custom", "Ilimitado", "Ilimitado", { text: "desde $3.500.000", opts: { bold: true, color: NAVY } }, "Custom"],
    ],
    [16, 28, 12, 10, 18, 16],
  ),

  h2("3.3 Excedentes (cuando se pasa el cap)"),
  bullet([txt("Conciliación adicional: ", { bold: true }), txt("$15.000 COP por caso.")]),
  bullet([txt("Insolvencia adicional: ", { bold: true }), txt("$60.000 COP por caso (rentabilidad mayor por intensidad de uso).")]),

  h2("3.4 Add-ons (vendidos sobre cualquier plan)"),
  table(
    ["Add-on", "Precio", "Incluye"],
    [
      ["Firma electrónica certificada (LM)", "$8.000 COP/firma", "Vía partner Legal Manager. Margen sobre el costo partner."],
      ["Norma Leal IA (asistente jurídico)", "$190.000 COP/mes por centro", "200 consultas/mes incluidas. Cross-sell desde LM."],
      ["Vigilancia judicial Rama", "$290.000 COP/mes por centro", "Monitoreo automático de procesos vinculados (fase siguiente)."],
      ["Widget WordPress / radicación pública", "Incluido en Esencial+", "Botón embebible + página de solicitud."],
    ],
    [32, 28, 40],
  ),
);

// ───── 4. Unit economics ─────
children.push(
  h1("4. Unit economics objetivo (12 meses)"),
  table(
    ["Métrica", "Target", "Notas"],
    [
      ["ARPU mensual", "≈ $1.100.000 COP (~$280 USD)", "Mix: 40% Esencial, 45% Profesional, 12% Notarial, 3% Enterprise"],
      ["Costo variable por cliente", "≈ $80.000 COP/mes", "Supabase, Vercel, Resend, almacenamiento"],
      [{ text: "Gross margin", opts: { bold: true } }, { text: "≈ 92%", opts: { bold: true, color: "16A34A" } }, "Típico de SaaS B2B vertical"],
      ["CAC objetivo", "< $1.500 USD por cliente", "Híbrido inbound + outbound directo"],
      [{ text: "LTV proyectado", opts: { bold: true } }, { text: "$8.000 – $12.000 USD", opts: { bold: true } }, "36 – 48 meses promedio (sector regulado, sticky)"],
      [{ text: "LTV/CAC", opts: { bold: true } }, { text: "≥ 5×", opts: { bold: true, color: NAVY } }, "Posible por baja competencia y stickiness"],
      ["Payback period", "< 6 meses", "En anual con -20%, payback ~3 meses"],
      ["Churn mensual", "< 1%", "Stickiness regulatoria + integración SICAAC + portal partes"],
    ],
    [25, 30, 45],
  ),
);

// ───── 5. Packaging por plan ─────
children.push(
  h1("5. Packaging — módulos por plan"),
  table(
    ["Módulo", "Académico", "Esencial", "Profesional", "Notarial", "Enterprise"],
    [
      ["Casos, partes, apoderados", "✓", "✓", "✓", "✓", "✓"],
      ["Agenda + audiencias", "✓", "✓", "✓", "✓", "✓"],
      ["Plantillas del sistema", "✓", "✓", "✓", "✓", "✓"],
      ["Plantillas propias del centro", "—", "✓", "✓", "✓", "✓"],
      ["Reglamento + checklists de admisión", "✓", "✓", "✓", "✓", "✓"],
      ["Insolvencia (acreencias, propuesta, votación, acuerdo)", "Uso académico", "—", "✓", "✓", "✓"],
      ["SICAAC (expedientes, registros manuales)", "✓", "✓", "✓", "✓", "✓"],
      ["Portal partes (widget público)", "—", "✓", "✓", "✓", "✓"],
      ["Ticketing", "—", "—", "✓", "✓", "✓"],
      ["Firma electrónica (LM)", "—", "Add-on", "Add-on", "Add-on", "200/mes incluidas"],
      ["Multi-sede", "—", "—", "—", "✓", "✓"],
      ["Branding propio", "—", "Logo+colores", "Logo+colores", "+ dominio", "White-label"],
      ["Formato de radicado configurable", "✓", "✓", "✓", "✓", "✓"],
      ["API / integraciones externas", "—", "—", "—", "Read-only", "Full"],
      ["Soporte", "Comunidad", "Email", "Email + chat", "+ onboarding", "SLA 4h + CSM"],
      ["Backup / exportación", "Manual", "Mensual", "Semanal", "Diario", "A medida"],
    ],
    [30, 12, 14, 14, 14, 16],
  ),
);

// ───── 6. Estrategia por segmento ─────
children.push(
  h1("6. Estrategia por segmento"),

  h2("6.1 Centros privados y consultorios jurídicos universitarios"),
  p([
    txt("TAM real: ", { bold: true }),
    txt("aproximadamente 280 centros (universitarios + privados independientes)."),
  ]),
  p([
    txt("Wedge: ", { bold: true }),
    txt("el plan Académico gratis captura universidades y genera referidos a profesores que asesoran centros privados. Forma profesionales que llevan SIGECC consigo al graduarse. CAC del Académico cercano a cero (digital + alianzas con facultades)."),
  ]),
  p([
    txt("Conversión: ", { bold: true }),
    txt("Académico → Esencial / Profesional cuando el centro privado prueba con ese profesor referenciador."),
  ]),

  h2("6.2 Centros notariales"),
  p([
    txt("TAM real estimado: ", { bold: true }),
    txt("50 a 100 centros con habilitación bajo Ley 2220."),
  ]),
  p([
    txt("Pitch: ", { bold: true }),
    txt("\"Cumplimiento Ley 2220 + audiencias virtuales Ley 2445 / Decreto 1136 listas para tu habilitación tecnológica.\""),
  ]),
  p([
    txt("Canal: ", { bold: true }),
    txt("UCNC (Unión Colegiada del Notariado Colombiano) — patrocinio o convenio para acceso a base. Eventos del sector."),
  ]),
);

// ───── 7. Motion comercial ─────
children.push(
  h1("7. Motion comercial — 180 días"),

  h3("Días 0 – 30 · Foundation"),
  bullet("Página /precios pública con los 4 tiers + comparador + calculadora \"casos/mes → tu plan\"."),
  bullet("Demo agendable (Cal.com o similar) y formulario de lead."),
  bullet("Caso de éxito de Corprojusticia como referencia social."),
  bullet("Definir el pitch maestro: \"El SaaS de centros de conciliación cumplido con Ley 2445 y Decreto 1136\"."),

  h3("Días 31 – 90 · Motion"),
  bullet("Outbound dirigido: 50 centros privados + 30 notariales identificados (LinkedIn + email)."),
  bullet("Webinar mensual abierto: \"Habilitación tecnológica Ley 2445 / Dec 1136 — qué exige y cómo cumplirlo\"."),
  bullet("Alianza con 3 facultades de derecho para el plan Académico."),
  bullet("Contenido SEO: \"tarifa conciliación 2026\", \"cómo crear centro de conciliación\", \"Ley 2445 requisitos\"."),

  h3("Días 91 – 180 · Escala"),
  bullet("Programa de referidos: $300.000 COP + 1 mes gratis al referente por centro convertido."),
  bullet("Convenio piloto con UCNC para notarías (descuento 30% a los primeros 10)."),
  bullet("Caso de cámara mediana como referencia para Enterprise."),
  bullet("Free trial → conversión: meta 25% trial-to-paid en Esencial."),
);

// ───── 8. KPIs ─────
children.push(
  h1("8. KPIs y roadmap de crecimiento"),
  table(
    ["KPI", "Mes 3", "Mes 6", "Mes 12"],
    [
      ["Centros pagos", "3", "10", "30"],
      [{ text: "MRR (COP)", opts: { bold: true } }, { text: "$3M", opts: { bold: true } }, { text: "$11M", opts: { bold: true } }, { text: "$35M", opts: { bold: true, color: NAVY } }],
      ["ARPU (COP)", "$1.000.000", "$1.100.000", "$1.150.000"],
      ["Trials activos", "5", "15", "25"],
      ["Trial → Paid", "—", "20%", "25%"],
      ["Churn mensual", "n/a", "< 2%", "< 1%"],
      ["Académicos activos", "2", "8", "20"],
    ],
    [40, 20, 20, 20],
  ),
);

// ───── 9. Riesgos y pendientes ─────
children.push(
  h1("9. Pendientes de datos y riesgos"),

  h2("9.1 Datos a levantar antes de publicar precios"),
  bullet([txt("Precio real de Litivo: ", { bold: true }), txt("test-buy o cotización por canal aliado. Es el único anclaje real de mercado.")]),
  bullet([txt("Conteo oficial 2025-2026: ", { bold: true }), txt("descargar el dataset 7p9a-zd9k de datos.gov.co para conteo exacto por tipo de centro.")]),
  bullet([txt("Tarifa partner Legal Manager por firma: ", { bold: true }), txt("fija el margen del add-on de firma electrónica.")]),
  bullet([txt("Costo real de infraestructura: ", { bold: true }), txt("Supabase + Vercel + Anthropic + Resend del último mes — para validar el margen 92% asumido.")]),

  h2("9.2 Riesgos identificados"),
  bullet([txt("Litivo reacciona bajando precios: ", { bold: true }), txt("contramedida — competir en UX moderna, no en precio. Anclar a Ley 2445 y al portal de partes (que ellos no tienen).")]),
  bullet([txt("Ciclo de ventas largo (45 – 120 días): ", { bold: true }), txt("contramedida — trial de 30 días y piloto guiado para acelerar comité interno del centro.")]),
  bullet([txt("Habilitación tecnológica MinJusticia aún no estabilizada: ", { bold: true }), txt("convertirlo en oportunidad de venta consultiva.")]),
);

// ───── 10. Próximos pasos ─────
children.push(
  h1("10. Próximos pasos accionables"),
  table(
    ["#", "Acción", "Dueño", "Plazo"],
    [
      ["1", "Test-buy o cotización a Litivo vía canal aliado", "Comercial", "2 semanas"],
      ["2", "Descargar dataset 7p9a-zd9k y consolidar TAM por tipo de centro", "Producto", "3 días"],
      ["3", "Validar costo real de infraestructura del último mes", "Producto", "1 semana"],
      ["4", "Publicar página /precios con los 5 tiers + calculadora + demo", "Producto + Diseño", "2 semanas"],
      ["5", "Habilitar trial 30 días sin tarjeta para Esencial", "Producto", "3 semanas"],
      ["6", "Lanzar webinar mensual sobre Ley 2445 / Dec 1136", "Marketing", "Mes 1"],
      ["7", "Cerrar primera alianza universitaria (Académico gratis)", "Comercial", "Mes 2"],
      ["8", "Cerrar primer convenio con UCNC para notarías", "Comercial", "Mes 3"],
    ],
    [6, 56, 18, 20],
  ),
);

// Pie
children.push(
  spacer(400),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [txt(
      `SIGECC — Documento ejecutivo interno · Generado el ${today}`,
      { color: "999999", italics: true, size: 16 },
    )],
  }),
);

/* ─── Construir y guardar ─────────────────────────────────────────────────── */

const doc = new Document({
  creator: "SIGECC",
  title: "Plan de Pricing y Go-to-Market — SIGECC",
  description: "Benchmark Colombia + propuesta de tarifas + estrategia GTM",
  styles: {
    default: {
      document: { run: { font: "Calibri", size: 22 } },
    },
  },
  sections: [
    {
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(0.9),
            bottom: convertInchesToTwip(0.9),
            left: convertInchesToTwip(0.9),
            right: convertInchesToTwip(0.9),
          },
          size: { orientation: PageOrientation.PORTRAIT },
        },
      },
      children,
    },
  ],
});

const buffer = await Packer.toBuffer(doc);
const out = "C:/Users/SD21/OneDrive/Escritorio/SIGECC_Pricing_GTM_Plan.docx";
writeFileSync(out, buffer);
console.log(`✔ Documento generado: ${out}`);
console.log(`  Tamaño: ${(buffer.length / 1024).toFixed(1)} KB`);
