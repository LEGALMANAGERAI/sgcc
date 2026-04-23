// Genera el PDF de la solicitud de insolvencia (Ley 2445/2025) a nombre del
// deudor, estructurado por los 10 numerales del Art. 539 + Parágrafos 1 y 2.
// El PDF se firma electrónicamente con la infraestructura de sgcc_firma_*.

import type {
  FormDataInsolvencia,
  AcreedorFormData,
  BienFormData,
  CodeudorFormData,
  PropuestaPagoClase,
  AdjuntoDraft,
} from "@/types/solicitudes";
import {
  CLASE_PRELACION_LABEL,
  JURAMENTO_TEXTO,
  SOCIEDAD_CONYUGAL_ESTADO_LABEL,
  TIPO_ANEXO_LABEL,
  TIPO_DEUDOR_LABEL,
  TIPO_FUENTE_INGRESOS_LABEL,
} from "./constants";
import { formatearFechaCorteLarga } from "./fecha-corte";
import {
  generarRedaccionCondonaciones,
  totalesDeCronograma,
} from "./payment-plan";

export interface GenerarPdfSolicitudInput {
  fd: Partial<FormDataInsolvencia>;
  deudor: {
    nombre: string;
    cedula: string;
    email: string;
    telefono?: string;
  };
  adjuntos: AdjuntoDraft[];
  centro: {
    nombre: string;
    codigo?: string;
  };
}

const COP = (n: number | undefined | null) =>
  typeof n === "number" && !Number.isNaN(n)
    ? `$${n.toLocaleString("es-CO")}`
    : "—";

const txt = (v: unknown): string => {
  if (v === null || v === undefined) return "—";
  const s = String(v).trim();
  return s.length === 0 ? "—" : s;
};

export async function generarPdfSolicitud(input: GenerarPdfSolicitudInput): Promise<Buffer> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const { fd, deudor, adjuntos, centro } = input;

  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await doc.embedFont(StandardFonts.HelveticaOblique);

  const navy = rgb(13 / 255, 35 / 255, 64 / 255);
  const gold = rgb(184 / 255, 134 / 255, 11 / 255);
  const gray = rgb(0.35, 0.35, 0.35);
  const lightGray = rgb(0.88, 0.88, 0.88);
  const white = rgb(1, 1, 1);

  const PAGE_W = 595;
  const PAGE_H = 842;
  const MARGIN = 48;
  const RIGHT = PAGE_W - MARGIN;

  // Estado del cursor
  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  let pageIndex = 1;

  // ── Helpers de dibujo ──────────────────────────────────────────────────
  function nuevoPageSiFalta(minY: number) {
    if (y < minY) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
      pageIndex++;
      encabezado();
    }
  }

  function encabezado() {
    page.drawRectangle({ x: 0, y: PAGE_H - 28, width: PAGE_W, height: 28, color: navy });
    page.drawText("SOLICITUD DE INSOLVENCIA — Ley 2445 de 2025", {
      x: MARGIN,
      y: PAGE_H - 19,
      size: 9,
      font: fontBold,
      color: white,
    });
    page.drawText(centro.nombre, {
      x: RIGHT - fontRegular.widthOfTextAtSize(centro.nombre, 8),
      y: PAGE_H - 19,
      size: 8,
      font: fontRegular,
      color: white,
    });
    page.drawRectangle({ x: 0, y: PAGE_H - 30, width: PAGE_W, height: 2, color: gold });
    y = PAGE_H - 50;
  }

  function titulo(s: string) {
    nuevoPageSiFalta(80);
    y -= 4;
    page.drawText(s, { x: MARGIN, y, size: 14, font: fontBold, color: navy });
    y -= 6;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: RIGHT, y },
      thickness: 0.7,
      color: navy,
    });
    y -= 16;
  }

  function subtitulo(s: string) {
    nuevoPageSiFalta(60);
    page.drawText(s, { x: MARGIN, y, size: 11, font: fontBold, color: navy });
    y -= 16;
  }

  function parrafo(s: string, opts: { size?: number; bold?: boolean; italic?: boolean; color?: any } = {}) {
    const size = opts.size ?? 10;
    const font = opts.bold ? fontBold : opts.italic ? fontItalic : fontRegular;
    const color = opts.color ?? rgb(0.1, 0.1, 0.1);
    const lineHeight = size + 3;
    const maxWidth = RIGHT - MARGIN;
    const palabras = s.split(/\s+/);
    let linea = "";
    for (const p of palabras) {
      const test = linea ? `${linea} ${p}` : p;
      if (font.widthOfTextAtSize(test, size) > maxWidth) {
        nuevoPageSiFalta(lineHeight + 10);
        page.drawText(linea, { x: MARGIN, y, size, font, color });
        y -= lineHeight;
        linea = p;
      } else {
        linea = test;
      }
    }
    if (linea) {
      nuevoPageSiFalta(lineHeight + 10);
      page.drawText(linea, { x: MARGIN, y, size, font, color });
      y -= lineHeight;
    }
  }

  function campoLinea(label: string, value: string) {
    const size = 10;
    const lineHeight = 14;
    nuevoPageSiFalta(lineHeight + 10);
    page.drawText(label, { x: MARGIN, y, size, font: fontBold, color: gray });
    const labelW = fontBold.widthOfTextAtSize(label, size);
    const valueX = MARGIN + labelW + 6;
    const maxW = RIGHT - valueX;
    const palabras = value.split(/\s+/);
    let linea = "";
    let first = true;
    for (const p of palabras) {
      const test = linea ? `${linea} ${p}` : p;
      if (fontRegular.widthOfTextAtSize(test, size) > maxW) {
        page.drawText(linea, {
          x: first ? valueX : MARGIN,
          y,
          size,
          font: fontRegular,
          color: navy,
        });
        y -= lineHeight;
        nuevoPageSiFalta(lineHeight + 10);
        linea = p;
        first = false;
      } else {
        linea = test;
      }
    }
    if (linea) {
      page.drawText(linea, {
        x: first ? valueX : MARGIN,
        y,
        size,
        font: fontRegular,
        color: navy,
      });
      y -= lineHeight;
    }
  }

  function separador() {
    y -= 4;
    nuevoPageSiFalta(12);
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: RIGHT, y },
      thickness: 0.4,
      color: lightGray,
    });
    y -= 10;
  }

  // ── Portada ───────────────────────────────────────────────────────────
  encabezado();

  y -= 30;
  page.drawText("SOLICITUD DE NEGOCIACIÓN", {
    x: MARGIN,
    y,
    size: 22,
    font: fontBold,
    color: navy,
  });
  y -= 26;
  page.drawText("DE DEUDAS — LEY 2445 DE 2025", {
    x: MARGIN,
    y,
    size: 18,
    font: fontBold,
    color: gold,
  });
  y -= 40;
  parrafo(
    "El suscrito, identificado al pie, respetuosamente se acoge al procedimiento " +
      "de negociación de deudas previsto en los artículos 538 y siguientes de la " +
      "Ley 2445 de 2025 (modif. Ley 1564 de 2012), por encontrarse en cesación de " +
      "pagos. En desarrollo del Art. 539 ibidem, se aportan los siguientes datos e " +
      "información, bajo la gravedad del juramento, y se formula la correspondiente " +
      "propuesta de negociación.",
    { italic: true, color: gray }
  );

  y -= 10;
  campoLinea("Deudor:", deudor.nombre);
  campoLinea("C.C.:", deudor.cedula);
  campoLinea("Tipo de deudor:", fd.tipo_deudor ? TIPO_DEUDOR_LABEL[fd.tipo_deudor] : "—");
  campoLinea("Correo electrónico:", deudor.email);
  campoLinea("Teléfono:", txt(deudor.telefono));
  campoLinea("Centro de conciliación:", centro.nombre);
  campoLinea(
    "Fecha de corte (Parágrafo 2 Art. 539):",
    fd.fecha_corte ? formatearFechaCorteLarga(fd.fecha_corte) : "—"
  );
  campoLinea("Fecha de la solicitud:", formatearFechaCorteLarga(new Date().toISOString().slice(0, 10)));

  // ── 1. Causas de la cesación de pagos ─────────────────────────────────
  y -= 10;
  titulo("1. Causas de la cesación de pagos (Art. 539 #1)");
  parrafo(fd.causa_insolvencia ?? "El deudor no aportó las causas.");

  // ── 2. Propuesta de negociación ───────────────────────────────────────
  titulo("2. Propuesta de negociación (Art. 539 #2)");
  const propuestas = fd.propuesta_pago ?? [];
  if (fd.condonaciones_globales) {
    const redCond = generarRedaccionCondonaciones(fd.condonaciones_globales);
    if (redCond) parrafo(redCond, { italic: true });
  }
  if (propuestas.length === 0) {
    parrafo("No se registró propuesta de pago.", { italic: true });
  } else {
    for (const p of propuestas as PropuestaPagoClase[]) {
      subtitulo(`Clase ${CLASE_PRELACION_LABEL[p.clase_prelacion] ?? p.clase_prelacion}`);
      if (p.clase_prelacion === "quinta") {
        campoLinea("Número de cuotas (compartido):", String(p.numero_cuotas_compartido ?? "—"));
        campoLinea("Meses de gracia (compartido):", String(p.meses_gracia_compartido ?? 0));
        if (p.prioridad_pequenos) {
          campoLinea("Modalidad:", `Prioridad pequeños acreedores (${p.m_cuotas_pequenos ?? 0} cuotas iniciales)`);
        } else {
          campoLinea("Modalidad:", "A prorrata uniforme");
        }
      }
      for (const c of p.creditos ?? []) {
        parrafo(c.redaccion_narrativa);
        const totales = totalesDeCronograma(c.cronograma);
        campoLinea(
          "Total a pagar proyectado:",
          `${COP(totales.amortizacion + totales.intereses)} (capital ${COP(totales.amortizacion)} + intereses ${COP(totales.intereses)})`,
        );
      }
      separador();
    }
  }

  // ── 3. Acreedores (inciso 7 Dec 1136/2025) ────────────────────────────
  titulo("3. Relación de acreedores (Art. 539 #3, inciso 7 corregido Dec. 1136/2025)");
  parrafo(
    fd.fecha_corte
      ? `Información actualizada al ${formatearFechaCorteLarga(fd.fecha_corte)}.`
      : "La relación debe hacerse con corte al último día del mes anterior (Parágrafo 2).",
    { italic: true, color: gray, size: 9 }
  );
  const acreedores = fd.acreedores ?? [];
  if (acreedores.length === 0) {
    parrafo("No se relacionaron acreedores.", { italic: true });
  } else {
    acreedores.forEach((a: AcreedorFormData, i: number) => {
      subtitulo(
        `${i + 1}. ${a.nombre} — ${a.clase_prelacion ? CLASE_PRELACION_LABEL[a.clase_prelacion] : "(sin clase)"}`
      );
      campoLinea("Documento:", txt(a.numero_doc));
      campoLinea("Domicilio / dirección:", txt(a.direccion_notif));
      campoLinea("Ciudad:", txt(a.ciudad));
      campoLinea("Correo:", txt(a.correo));
      campoLinea("Teléfono:", txt(a.telefono));
      campoLinea("Tipo de crédito:", txt(a.tipo_credito));
      campoLinea("Naturaleza del crédito:", txt(a.naturaleza_credito));
      campoLinea("Capital:", COP(a.capital));
      campoLinea("Intereses:", COP(a.intereses));
      campoLinea("Otros conceptos:", COP(a.otros_conceptos ?? 0));
      campoLinea(
        "Tasa de interés mensual:",
        a.tasa_interes_mensual != null ? `${a.tasa_interes_mensual}%` : "—"
      );
      campoLinea("Fecha otorgamiento:", txt(a.fecha_otorgamiento));
      campoLinea("Fecha vencimiento:", txt(a.fecha_vencimiento));
      campoLinea("Documento del crédito:", txt(a.documento_credito));
      campoLinea("Días de mora:", String(a.dias_mora ?? 0));
      campoLinea(
        "Más de 90 días de mora:",
        a.mas_90_dias_mora ? "Sí (Art. 538)" : "No"
      );
      campoLinea(
        "Postergado (causal 1 Art. 572A):",
        a.es_postergado_572a ? "Sí" : "No"
      );
      if (a.es_garantia_mobiliaria_solidaria) {
        campoLinea("Garantía mobiliaria economía solidaria:", "Sí");
        campoLinea("Monto aportes/ahorros:", COP(a.monto_aportes_ahorros ?? 0));
        parrafo(
          "Nota: Se califica 2.ª clase hasta el monto aportado; el excedente se califica como 5.ª clase (Ley 2445/2025).",
          { italic: true, size: 9, color: gray }
        );
      }
      const codeudores = a.codeudores ?? [];
      if (codeudores.length > 0) {
        parrafo("Codeudores / fiadores / avalistas:", { bold: true, size: 10 });
        codeudores.forEach((c: CodeudorFormData, j: number) => {
          parrafo(
            `${j + 1}. ${c.nombre} (${c.rol ?? "codeudor"}) — ${txt(c.domicilio)} / ${txt(c.direccion)} — Tel: ${txt(c.telefono)} — Correo: ${txt(c.correo)}`,
            { size: 9 }
          );
        });
      }
      if (a.info_desconocida && a.info_desconocida.trim()) {
        parrafo(`Información desconocida: ${a.info_desconocida.trim()}`, {
          italic: true,
          size: 9,
          color: gray,
        });
      }
      separador();
    });
    const total = acreedores.reduce(
      (s, a) => s + (a.capital || 0) + (a.intereses || 0) + (a.otros_conceptos || 0),
      0
    );
    parrafo(`Total pasivo declarado: ${COP(total)}.`, { bold: true });
  }

  // ── 4. Bienes ─────────────────────────────────────────────────────────
  titulo("4. Relación de bienes (Art. 539 #4)");
  const bienes = fd.bienes ?? [];
  if (bienes.length === 0) {
    parrafo("El deudor declara no tener bienes.", { italic: true });
  } else {
    bienes.forEach((b: BienFormData, i: number) => {
      subtitulo(`${i + 1}. ${bienLabel(b)}`);
      if (b.tipo === "inmueble") {
        campoLinea("Dirección:", txt(b.direccion));
        campoLinea("Ciudad:", txt(b.ciudad));
        campoLinea("Matrícula inmobiliaria:", txt(b.matricula_inmobiliaria));
      }
      if (b.tipo === "mueble") {
        campoLinea("Marca/modelo:", txt(b.marca_modelo));
        campoLinea("Chasis/placa:", txt(b.numero_chasis));
      }
      if (b.descripcion) campoLinea("Descripción:", b.descripcion);
      campoLinea("Valor estimado:", COP(b.valor_estimado));
      campoLinea("% de dominio:", b.porcentaje_dominio != null ? `${b.porcentaje_dominio}%` : "—");
      campoLinea("Gravamen:", txt(b.gravamen));
      campoLinea("Medidas cautelares:", txt(b.medidas_cautelares));
      if (b.esta_en_exterior) {
        campoLinea("Ubicación:", `Exterior — ${txt(b.pais_exterior)}`);
      }
      if (b.afectacion_vivienda_familiar) {
        campoLinea("Vivienda familiar:", "Sí");
      }
      if (b.patrimonio_familia_inembargable) {
        campoLinea("Patrimonio de familia inembargable:", "Sí");
      }
      separador();
    });
  }

  // ── 5. Procesos judiciales ────────────────────────────────────────────
  titulo("5. Procesos judiciales, administrativos y privados (Art. 539 #5)");
  const procesos = fd.procesos ?? [];
  if (procesos.length === 0) {
    parrafo("El deudor declara no tener procesos en curso.", { italic: true });
  } else {
    procesos.forEach((p, i) => {
      subtitulo(`${i + 1}. ${txt(p.tipo_proceso)}`);
      campoLinea("Juzgado / oficina:", txt(p.juzgado_ciudad));
      campoLinea("Radicado:", txt(p.numero_radicado));
      campoLinea("Demandante:", txt(p.demandante));
      campoLinea("Embargo o remate:", p.tiene_embargo_remate ? "Sí" : "No");
      separador();
    });
  }

  // ── 6. Ingresos ───────────────────────────────────────────────────────
  titulo("6. Certificación de ingresos (Art. 539 #6)");
  campoLinea(
    "Tipo de fuente:",
    fd.tipo_fuente_ingresos ? TIPO_FUENTE_INGRESOS_LABEL[fd.tipo_fuente_ingresos] : "—"
  );
  campoLinea("Monto mensual:", COP(fd.ingresos_mensuales ?? 0));
  if (fd.empleador_nombre) campoLinea("Empleador:", `${fd.empleador_nombre}${fd.empleador_nit ? ` (NIT ${fd.empleador_nit})` : ""}`);
  if (fd.fondo_pension) campoLinea("Fondo de pensión:", fd.fondo_pension);
  if (fd.fuentes_ingresos) campoLinea("Detalle de fuentes:", fd.fuentes_ingresos);

  // ── 7. Recursos disponibles ───────────────────────────────────────────
  titulo("7. Recursos disponibles para el pago (Art. 539 #7)");
  const totalGastos = fd.gastos_subsistencia_mensual ?? 0;
  const ingresos = fd.ingresos_mensuales ?? 0;
  const disponible = Math.max(0, ingresos - totalGastos);
  campoLinea("Ingresos mensuales:", COP(ingresos));
  campoLinea("Gastos de subsistencia:", COP(totalGastos));
  campoLinea(
    "Disponible mensual (estimado):",
    COP(disponible)
  );
  parrafo(
    "Valor resultante de descontar los gastos necesarios para la subsistencia " +
      "del deudor y de las personas a su cargo, los de conservación de los bienes " +
      "y los del procedimiento.",
    { italic: true, size: 9, color: gray }
  );

  // ── 8. Sociedad conyugal / patrimonial ────────────────────────────────
  titulo("8. Sociedad conyugal y patrimonial (Art. 539 #8)");
  campoLinea("Estado civil:", txt(fd.estado_civil));
  campoLinea(
    "Estado sociedad conyugal:",
    fd.sociedad_conyugal_estado
      ? SOCIEDAD_CONYUGAL_ESTADO_LABEL[fd.sociedad_conyugal_estado]
      : "—"
  );
  if (fd.sociedad_conyugal_estado === "liquidada_menos_2_anios") {
    campoLinea("Fecha de liquidación:", txt(fd.sociedad_conyugal_fecha_liq));
    campoLinea(
      "Valor comercial bienes embargables liquidados:",
      COP(fd.sociedad_conyugal_valor_bienes)
    );
  }
  if (fd.sociedad_conyugal_info) campoLinea("Información adicional:", fd.sociedad_conyugal_info);

  // ── 9. Obligaciones alimentarias ──────────────────────────────────────
  titulo("9. Obligaciones alimentarias y REDAM (Art. 539 #9)");
  const oa = fd.obligaciones_alimentarias;
  campoLinea("¿Tiene obligaciones alimentarias?", oa?.tiene ? "Sí" : "No");
  if (oa?.tiene) {
    campoLinea("Beneficiarios:", txt(oa.beneficiarios));
    campoLinea("Cuantía mensual:", COP(oa.monto_mensual));
  }
  campoLinea("Personas a cargo:", String(fd.personas_a_cargo ?? 0));

  // ── 10. Matrícula mercantil ───────────────────────────────────────────
  if (fd.tipo_deudor === "pequeno_comerciante") {
    titulo("10. Matrícula mercantil (Art. 539 #10)");
    campoLinea("Matrícula mercantil:", txt(fd.matricula_mercantil));
    campoLinea("Activos totales declarados:", COP(fd.activos_totales));
  }

  // ── Juramento (Parágrafo 1) ──────────────────────────────────────────
  titulo("Manifestación bajo juramento (Parágrafo 1 Art. 539)");
  parrafo(JURAMENTO_TEXTO);

  // ── Anexos ───────────────────────────────────────────────────────────
  titulo("Anexos aportados");
  if (adjuntos.length === 0) {
    parrafo("No se relacionaron anexos.", { italic: true });
  } else {
    const adjuntosPorTipo = new Map<string, AdjuntoDraft[]>();
    for (const a of adjuntos) {
      const lista = adjuntosPorTipo.get(a.tipo_anexo) ?? [];
      lista.push(a);
      adjuntosPorTipo.set(a.tipo_anexo, lista);
    }
    for (const [tipo, lista] of adjuntosPorTipo.entries()) {
      const label = (TIPO_ANEXO_LABEL as Record<string, string>)[tipo] ?? tipo;
      subtitulo(label);
      lista.forEach((a, i) => {
        parrafo(`${i + 1}. ${a.nombre_archivo} (${Math.round(a.tamano_bytes / 1024)} KB)`, {
          size: 9,
        });
      });
    }
  }

  // ── Pie de firma ──────────────────────────────────────────────────────
  y -= 20;
  nuevoPageSiFalta(150);
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: MARGIN + 220, y },
    thickness: 0.7,
    color: navy,
  });
  y -= 12;
  page.drawText("Firma del deudor solicitante", { x: MARGIN, y, size: 9, font: fontBold, color: gray });
  y -= 12;
  page.drawText(deudor.nombre, { x: MARGIN, y, size: 10, font: fontBold, color: navy });
  y -= 12;
  page.drawText(`C.C. ${deudor.cedula}`, { x: MARGIN, y, size: 9, font: fontRegular, color: gray });
  y -= 10;
  page.drawText(
    "(La firma electrónica se aplica en la página de certificación al final de este documento.)",
    { x: MARGIN, y, size: 8, font: fontItalic, color: gray }
  );

  // Pie de página en cada página con numeración
  const pages = doc.getPages();
  pages.forEach((p, idx) => {
    p.drawLine({
      start: { x: MARGIN, y: 36 },
      end: { x: RIGHT, y: 36 },
      thickness: 0.4,
      color: lightGray,
    });
    p.drawText(`${deudor.nombre} — Solicitud de insolvencia`, {
      x: MARGIN,
      y: 24,
      size: 7.5,
      font: fontRegular,
      color: gray,
    });
    const texto = `Página ${idx + 1} de ${pages.length}`;
    p.drawText(texto, {
      x: RIGHT - fontRegular.widthOfTextAtSize(texto, 7.5),
      y: 24,
      size: 7.5,
      font: fontRegular,
      color: gray,
    });
  });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

function bienLabel(b: BienFormData): string {
  if (b.tipo === "inmueble") return `Inmueble${b.direccion ? ` — ${b.direccion}` : ""}`;
  if (b.tipo === "mueble") return `Mueble${b.marca_modelo ? ` — ${b.marca_modelo}` : b.descripcion ? ` — ${b.descripcion}` : ""}`;
  return `Elemento del hogar${b.descripcion ? ` — ${b.descripcion}` : ""}`;
}

export function nombreArchivoSolicitud(deudor: { cedula: string; nombre: string }, draftId: string) {
  const cc = deudor.cedula || "sin-cc";
  const slug = (deudor.nombre || "deudor")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `solicitud-insolvencia_${slug}_cc${cc}_${draftId.slice(0, 8)}.pdf`;
}
