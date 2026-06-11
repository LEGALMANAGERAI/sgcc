// ============================================================
// Resolver de variables para el motor de autos de insolvencia.
//
// resolverVariablesAuto(caseId, hearingId) junta del sistema TODOS los datos
// disponibles para pre-llenar un auto de insolvencia. Es best-effort: lo que
// no exista queda en null / []  — el operador lo completa en la UI antes de
// generar el documento. NUNCA lanza por datos faltantes.
//
// Devuelve exactamente el shape `ResolvedAutoVars` de ./types.
// ============================================================

import { supabaseAdmin } from "@/lib/supabase";
import type {
  ResolvedAutoVars,
  AutoCentro,
  AutoOperador,
  AutoCaso,
  AutoDeudor,
  AutoAcreedor,
  AutoApoderado,
  AutoAudiencia,
} from "./types";

// ─── Helpers ────────────────────────────────────────────────────────────────

const MESES_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** ISO/timestamptz → "14 de abril de 2026". Devuelve null si no hay fecha válida. */
function formatearFechaEspanol(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return `${d.getUTCDate()} de ${MESES_ES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

/** ISO/timestamptz → "10:23 AM" (zona horaria Colombia, UTC-5). null si no hay. */
function formatearHora(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  // Colombia es UTC-5 (sin horario de verano).
  const colombia = new Date(d.getTime() - 5 * 60 * 60 * 1000);
  let h = colombia.getUTCHours();
  const m = colombia.getUTCMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** Nombre legible de una parte (razón social o nombres + apellidos). */
function nombreParte(p: {
  razon_social?: string | null;
  nombres?: string | null;
  apellidos?: string | null;
} | null | undefined): string {
  if (!p) return "";
  if (p.razon_social) return p.razon_social.trim();
  const full = `${p.nombres ?? ""} ${p.apellidos ?? ""}`.trim();
  return full;
}

function num(v: unknown): number {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return typeof n === "number" && !isNaN(n) ? n : 0;
}

/** Construye un AutoApoderado a partir de una fila enriquecida de sgcc_case_attorneys. */
function buildApoderado(row: any): AutoApoderado | null {
  if (!row || !row.attorney) return null;
  const a = row.attorney;
  return {
    nombre: a.nombre ?? null,
    // sgcc_attorneys.numero_doc es la cédula del abogado.
    cedula: a.numero_doc ?? null,
    tarjeta_profesional: a.tarjeta_profesional ?? null,
    email: a.email ?? null,
    telefono: a.telefono ?? null,
    // sgcc_attorneys NO tiene columna de dirección → siempre null.
    direccion: null,
  };
}

// ─── Resolver principal ──────────────────────────────────────────────────────

export async function resolverVariablesAuto(
  caseId: string,
  hearingId: string | null
): Promise<ResolvedAutoVars> {
  // 1) Caso + centro + conciliador + partes (con su parte registrada).
  const { data: caso } = await supabaseAdmin
    .from("sgcc_cases")
    .select(
      `
      id,
      numero_radicado,
      tipo_tramite,
      fecha_admision,
      conciliador_id,
      center_id,
      conciliador:sgcc_staff!sgcc_cases_conciliador_id_fkey(
        id, nombre, tarjeta_profesional, email, cedula, ciudad_cedula, codigo_inscripcion
      ),
      centro:sgcc_centers!sgcc_cases_center_id_fkey(
        id, nombre, resolucion_habilitacion, resolucion_insolvencia, codigo_ministerio,
        direccion, ciudad, telefono, email_radicacion, email_secretaria, email_contacto,
        pie_vigilado, logo_url
      ),
      partes:sgcc_case_parties(
        id, rol, party_id,
        party:sgcc_parties(
          id, tipo_persona, nombres, apellidos, razon_social,
          tipo_doc, numero_doc, nit_empresa, email, telefono, direccion
        )
      )
    `
    )
    .eq("id", caseId)
    .maybeSingle();

  const casoAny = caso as any;

  // ── Centro ──
  const c = casoAny?.centro ?? null;
  const centro: AutoCentro = {
    nombre: c?.nombre ?? "",
    resolucion_habilitacion: c?.resolucion_habilitacion ?? null,
    resolucion_insolvencia: c?.resolucion_insolvencia ?? null,
    codigo_ministerio: c?.codigo_ministerio ?? null,
    direccion: c?.direccion ?? null,
    ciudad: c?.ciudad ?? null,
    telefono: c?.telefono ?? null,
    email_radicacion: c?.email_radicacion ?? null,
    email_secretaria: c?.email_secretaria ?? null,
    email_contacto: c?.email_contacto ?? null,
    pie_vigilado: c?.pie_vigilado ?? null,
    logo_url: c?.logo_url ?? null,
  };

  // ── Operador (conciliador que firma) ──
  const op = casoAny?.conciliador ?? null;
  const operador: AutoOperador = {
    nombre: op?.nombre ?? "",
    cargo: "OPERADOR DE INSOLVENCIA",
    cedula: op?.cedula ?? null,
    ciudad_cedula: op?.ciudad_cedula ?? null,
    tarjeta_profesional: op?.tarjeta_profesional ?? null,
    codigo_inscripcion: op?.codigo_inscripcion ?? null,
  };

  // ── Caso ──
  const casoVars: AutoCaso = {
    radicado: casoAny?.numero_radicado ?? "",
    numero_auto_admisorio: "01",
    fecha_auto_admisorio: formatearFechaEspanol(casoAny?.fecha_admision),
  };

  // 2) Apoderados vigentes del caso (para deudor y acreedores).
  //    Filtramos solo por activo=true (best-effort, sin filtrar por fecha de
  //    audiencia para no descartar poderes con vigencia mal poblada).
  const { data: apoderados } = await supabaseAdmin
    .from("sgcc_case_attorneys")
    .select(
      `
      id, party_id, attorney_id, activo, created_at,
      attorney:sgcc_attorneys(
        id, nombre, tipo_doc, numero_doc, tarjeta_profesional, email, telefono
      )
    `
    )
    .eq("case_id", caseId)
    .eq("activo", true)
    .order("created_at", { ascending: false });

  // Mapa party_id → apoderado (toma el más reciente activo por parte).
  const apoderadoPorParte = new Map<string, AutoApoderado>();
  for (const row of (apoderados as any[]) ?? []) {
    if (!row.party_id || apoderadoPorParte.has(row.party_id)) continue;
    const ap = buildApoderado(row);
    if (ap) apoderadoPorParte.set(row.party_id, ap);
  }

  // ── Deudor (parte convocante) ──
  const partes = (casoAny?.partes ?? []) as any[];
  const convocante = partes.find((p) => p.rol === "convocante") ?? null;
  const partyDeudor = convocante?.party ?? null;
  const deudorPartyId: string | null = convocante?.party_id ?? partyDeudor?.id ?? null;

  const deudor: AutoDeudor = {
    nombre: nombreParte(partyDeudor),
    tipo_doc: partyDeudor?.tipo_doc ?? null,
    documento: partyDeudor?.numero_doc ?? partyDeudor?.nit_empresa ?? null,
    email: partyDeudor?.email ?? null,
    telefono: partyDeudor?.telefono ?? null,
    direccion: partyDeudor?.direccion ?? null,
    apoderado: deudorPartyId ? apoderadoPorParte.get(deudorPartyId) ?? null : null,
  };

  // 3) Audiencia: la indicada por hearingId, o la última del caso.
  let audienciaRow: any = null;
  if (hearingId) {
    const { data } = await supabaseAdmin
      .from("sgcc_hearings")
      .select("id, fecha_hora")
      .eq("id", hearingId)
      .maybeSingle();
    audienciaRow = data ?? null;
  } else {
    const { data } = await supabaseAdmin
      .from("sgcc_hearings")
      .select("id, fecha_hora")
      .eq("case_id", caseId)
      .order("fecha_hora", { ascending: false })
      .limit(1)
      .maybeSingle();
    audienciaRow = data ?? null;
  }

  const audiencia: AutoAudiencia = {
    fecha: audienciaRow?.fecha_hora ?? null,
    hora: formatearHora(audienciaRow?.fecha_hora),
  };

  // Hearing efectivo para resolver asistencia de acreedores.
  const hearingEfectivo: string | null = hearingId ?? audienciaRow?.id ?? null;

  // 4) Asistencia (pre-fill de "presente" por parte) para la audiencia efectiva.
  const asistenciaPorParte = new Map<string, boolean | null>();
  if (hearingEfectivo) {
    const { data: asistencia } = await supabaseAdmin
      .from("sgcc_hearing_attendance")
      .select("party_id, asistio")
      .eq("hearing_id", hearingEfectivo);
    for (const row of (asistencia as any[]) ?? []) {
      if (row.party_id != null) {
        asistenciaPorParte.set(row.party_id, row.asistio ?? null);
      }
    }
  }

  // 5) Acreedores (acreencias activas).
  const { data: acreenciasData } = await supabaseAdmin
    .from("sgcc_acreencias")
    .select(
      `
      id, party_id, acreedor_nombre, acreedor_documento, clase_credito,
      con_capital, con_intereses_corrientes, con_intereses_moratorios,
      con_seguros, con_otros, porcentaje_voto, es_pequeno_acreedor, deleted_at
    `
    )
    .eq("case_id", caseId)
    .is("deleted_at", null);

  const acreedores: AutoAcreedor[] = ((acreenciasData as any[]) ?? []).map((a) => {
    const capital = num(a.con_capital);
    const intereses_corrientes = num(a.con_intereses_corrientes);
    const intereses_moratorios = num(a.con_intereses_moratorios);
    const seguros = num(a.con_seguros);
    const otros = num(a.con_otros);
    const total = capital + intereses_corrientes + intereses_moratorios + seguros + otros;

    const partyId: string | null = a.party_id ?? null;
    const apoderado = partyId ? apoderadoPorParte.get(partyId) ?? null : null;
    const presente: boolean | null =
      partyId && hearingEfectivo
        ? asistenciaPorParte.has(partyId)
          ? asistenciaPorParte.get(partyId) ?? null
          : null
        : null;

    return {
      nombre: a.acreedor_nombre ?? "",
      documento: a.acreedor_documento ?? null,
      clase_credito: a.clase_credito ?? null,
      // sgcc_acreencias no almacena contacto del acreedor → null (operador completa).
      email: null,
      telefono: null,
      direccion: null,
      apoderado,
      presente,
      capital,
      intereses_corrientes,
      intereses_moratorios,
      seguros,
      otros,
      total,
      porcentaje_voto: num(a.porcentaje_voto),
      es_pequeno: a.es_pequeno_acreedor ?? false,
    };
  });

  return {
    centro,
    operador,
    caso: casoVars,
    deudor,
    acreedores,
    audiencia,
  };
}
