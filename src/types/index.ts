// ─── Centros ───────────────────────────────────────────────────────────────

export type CenterTipo =
  | "privado"
  | "camara_comercio"
  | "universidad"
  | "notaria"
  | "otro";

export interface SgccCenter {
  id: string;
  codigo_corto: string;
  nombre: string;
  nit: string | null;
  tipo: CenterTipo;
  rep_legal: string | null;
  direccion: string | null;
  ciudad: string;
  departamento: string | null;
  telefono: string | null;
  email_contacto: string | null;
  logo_url: string | null;
  resolucion_habilitacion: string | null;
  fecha_habilitacion: string | null;
  legados_empresa_id: string | null;
  dias_habiles_citacion: number;
  hora_inicio_audiencias: string;
  hora_fin_audiencias: string;
  metodo_asignacion: "manual" | "aleatorio" | "orden_lista";
  color_primario: string | null;
  color_secundario: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Staff ──────────────────────────────────────────────────────────────────

export type StaffRol = "admin" | "conciliador" | "secretario";

export interface SgccStaff {
  id: string;
  center_id: string;
  legados_user_id: string | null;
  orden_lista: number | null;
  ultima_asignacion: string | null;
  email: string;
  nombre: string;
  telefono: string | null;
  rol: StaffRol;
  tarjeta_profesional: string | null;
  codigo_interno: string | null;
  firma_url: string | null;
  supervisor_id: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Partes ─────────────────────────────────────────────────────────────────

export type TipoPersona = "natural" | "juridica";
export type TipoDoc = "CC" | "CE" | "NIT" | "Pasaporte" | "PPT" | "otro";

export interface SgccParty {
  id: string;
  tipo_persona: TipoPersona;
  // Natural
  nombres: string | null;
  apellidos: string | null;
  tipo_doc: TipoDoc | null;
  numero_doc: string | null;
  // Jurídica
  razon_social: string | null;
  nit_empresa: string | null;
  rep_legal_nombre: string | null;
  rep_legal_doc: string | null;
  // Contacto
  email: string;
  telefono: string | null;
  direccion: string | null;
  ciudad: string | null;
  // Auth
  email_verified: string | null;
  invited_at: string | null;
  created_at: string;
  updated_at: string;
}

export function partyDisplayName(p: SgccParty): string {
  if (p.tipo_persona === "juridica") return p.razon_social ?? p.email;
  return [p.nombres, p.apellidos].filter(Boolean).join(" ") || p.email;
}

// ─── Casos ──────────────────────────────────────────────────────────────────

export type CaseEstado =
  | "solicitud"
  | "admitido"
  | "citado"
  | "audiencia"
  | "cerrado"
  | "rechazado";

export type CaseSubEstado =
  | "acuerdo_total"
  | "acuerdo_parcial"
  | "no_acuerdo"
  | "inasistencia"
  | "desistimiento"
  | null;

export type CaseMateria =
  | "civil"
  | "comercial"
  | "laboral"
  | "familiar"
  | "consumidor"
  | "arrendamiento"
  | "otro";

export type TipoTramite = "conciliacion" | "insolvencia" | "acuerdo_apoyo" | "arbitraje_ejecutivo" | "directiva_anticipada";

export interface SgccCase {
  id: string;
  center_id: string;
  tipo_tramite: TipoTramite;
  numero_radicado: string;
  materia: CaseMateria;
  cuantia: number | null;
  cuantia_indeterminada: boolean;
  descripcion: string;
  estado: CaseEstado;
  sub_estado: CaseSubEstado;
  conciliador_id: string | null;
  secretario_id: string | null;
  sala_id: string | null;
  fecha_solicitud: string;
  fecha_admision: string | null;
  fecha_limite_citacion: string | null;
  fecha_audiencia: string | null;
  fecha_cierre: string | null;
  tarifa_base: number | null;
  tarifa_adicional: number;
  tarifa_pagada: boolean;
  motivo_rechazo: string | null;
  fecha_inicio_termino: string | null;
  dias_termino: number;
  prorrogado: boolean;
  created_by_staff: string | null;
  created_by_party: string | null;
  created_at: string;
  updated_at: string;
}

export type CaseRolParty = "convocante" | "convocado";

export interface SgccCaseParty {
  id: string;
  case_id: string;
  party_id: string;
  rol: CaseRolParty;
  apoderado_nombre: string | null;
  apoderado_doc: string | null;
  citacion_enviada_at: string | null;
  citacion_confirmada_at: string | null;
  asistio: boolean | null;
  firmo_acta: boolean;
  firma_url: string | null;
  created_at: string;
  // joined
  party?: SgccParty;
}

// ─── Salas ──────────────────────────────────────────────────────────────────

export type RoomTipo = "presencial" | "virtual";

export interface SgccRoom {
  id: string;
  center_id: string;
  nombre: string;
  tipo: RoomTipo;
  capacidad: number | null;
  link_virtual: string | null;
  activa: boolean;
  created_at: string;
}

// ─── Audiencias ─────────────────────────────────────────────────────────────

export type HearingEstado =
  | "programada"
  | "en_curso"
  | "suspendida"
  | "finalizada"
  | "cancelada";

export type HearingTipo = "inicial" | "continuacion" | "complementaria";

export type HearingModalidad = "presencial" | "virtual" | "mixta";

export interface SgccHearing {
  id: string;
  case_id: string;
  conciliador_id: string | null;
  sala_id: string | null;
  fecha_hora: string;
  duracion_min: number;
  estado: HearingEstado;
  tipo: HearingTipo;
  modalidad: HearingModalidad;
  plataforma_virtual: string | null;
  notas_previas: string | null;
  created_at: string;
  updated_at: string;
  // joined
  sala?: SgccRoom;
  conciliador?: SgccStaff;
}

// ─── Actas ──────────────────────────────────────────────────────────────────

export type ActaTipo =
  | "acuerdo_total"
  | "acuerdo_parcial"
  | "no_acuerdo"
  | "inasistencia"
  | "desistimiento"
  | "improcedente"
  | "suscripcion_apoyo"
  | "no_suscripcion_apoyo";

export type ActaEstadoFirma =
  | "pendiente"
  | "firmado_parcial"
  | "firmado_completo"
  | "archivado";

export interface ObligacionItem {
  parte: string;
  obligacion: string;
  plazo: string;
  monto?: number;
}

export interface SgccActa {
  id: string;
  case_id: string;
  hearing_id: string | null;
  numero_acta: string;
  tipo: ActaTipo;
  hechos: string | null;
  consideraciones: string | null;
  acuerdo_texto: string | null;
  obligaciones: ObligacionItem[] | null;
  borrador_url: string | null;
  estado_firma: ActaEstadoFirma;
  acta_firmada_url: string | null;
  conciliador_id: string | null;
  fecha_acta: string;
  es_constancia: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Documentos ─────────────────────────────────────────────────────────────

export type DocTipo =
  | "solicitud"
  | "poder"
  | "prueba"
  | "citacion"
  | "acta_borrador"
  | "acta_firmada"
  | "constancia"
  | "admision"
  | "rechazo"
  | "otro";

export interface SgccDocument {
  id: string;
  center_id: string;
  case_id: string | null;
  acta_id: string | null;
  tipo: DocTipo;
  nombre: string;
  descripcion: string | null;
  storage_path: string;
  url: string;
  mime_type: string | null;
  tamano_bytes: number | null;
  subido_por_staff: string | null;
  subido_por_party: string | null;
  created_at: string;
}

// ─── Plantillas ─────────────────────────────────────────────────────────────

export type TemplateTipo =
  | "citacion"
  | "acta_acuerdo"
  | "acta_no_acuerdo"
  | "acta_inasistencia"
  | "constancia"
  | "admision"
  | "rechazo";

export interface SgccTemplate {
  id: string;
  center_id: string | null;
  tipo: TemplateTipo;
  nombre: string;
  contenido: string;
  variables: Record<string, string> | null;
  es_default: boolean;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Cláusulas reutilizables ────────────────────────────────────────────────

export type ClausulaCategoria =
  | "preambulo"
  | "identificacion_partes"
  | "consideraciones"
  | "obligacion_dar"
  | "obligacion_hacer"
  | "obligacion_no_hacer"
  | "garantias"
  | "clausula_penal"
  | "confidencialidad"
  | "domicilio_notificaciones"
  | "desistimiento"
  | "inasistencia"
  | "cierre"
  | "insolvencia_acuerdo_pago"
  | "insolvencia_liquidacion"
  | "apoyo_decision"
  | "otro";

export const CLAUSULA_CATEGORIA_LABEL: Record<ClausulaCategoria, string> = {
  preambulo: "Preámbulo",
  identificacion_partes: "Identificación de partes",
  consideraciones: "Consideraciones",
  obligacion_dar: "Obligación de dar",
  obligacion_hacer: "Obligación de hacer",
  obligacion_no_hacer: "Obligación de no hacer",
  garantias: "Garantías",
  clausula_penal: "Cláusula penal",
  confidencialidad: "Confidencialidad",
  domicilio_notificaciones: "Domicilio y notificaciones",
  desistimiento: "Desistimiento",
  inasistencia: "Inasistencia",
  cierre: "Cierre",
  insolvencia_acuerdo_pago: "Insolvencia — Acuerdo de pago",
  insolvencia_liquidacion: "Insolvencia — Liquidación",
  apoyo_decision: "Acuerdos de apoyo",
  otro: "Otro",
};

export const TIPO_TRAMITE_LABEL: Record<TipoTramite, string> = {
  conciliacion: "Conciliación",
  insolvencia: "Insolvencia",
  acuerdo_apoyo: "Acuerdos de apoyo",
  arbitraje_ejecutivo: "Arbitraje ejecutivo",
  directiva_anticipada: "Directiva anticipada",
};

export interface SgccClausula {
  id: string;
  center_id: string | null;  // null = global del sistema
  titulo: string;
  categoria: ClausulaCategoria;
  tipo_tramite: TipoTramite | null;  // null = aplica a cualquier trámite
  resultado_aplicable: ActaTipo[] | null;  // null = aplica a cualquier resultado
  contenido: string;
  variables_requeridas: string[];
  tags: string[];
  es_default: boolean;
  activo: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Notificaciones ─────────────────────────────────────────────────────────

export type NotifTipo =
  | "nueva_solicitud"
  | "admision"
  | "rechazo"
  | "citacion"
  | "recordatorio_audiencia"
  | "acta_lista"
  | "acta_firmada"
  | "caso_cerrado"
  | "vigilancia"
  | "correspondencia_vencida"
  | "documento_subido"
  | "ticket_nuevo"
  | "ticket_respondido"
  | "ticket_asignado";

export interface SgccNotification {
  id: string;
  center_id: string;
  case_id: string | null;
  staff_id: string | null;
  party_id: string | null;
  tipo: NotifTipo;
  titulo: string;
  mensaje: string;
  canal: "in_app" | "email" | "both";
  email_enviado: boolean;
  leida: boolean;
  leida_at: string | null;
  created_at: string;
}

// ─── Tickets ────────────────────────────────────────────────────────────────

export type TicketCategoria = "soporte" | "administrativo" | "operativo";
export type TicketPrioridad = "Normal" | "Media" | "Alta";
export type TicketEstado = "Pendiente" | "EnRevision" | "Respondido" | "Cerrado";

export interface SgccTicket {
  id: string;
  center_id: string;
  case_id: string | null;
  titulo: string;
  descripcion: string | null;
  categoria: TicketCategoria;
  prioridad: TicketPrioridad;
  estado: TicketEstado;
  solicitante_staff_id: string | null;
  asignado_staff_id: string | null;
  respuesta: string | null;
  respondido_por: string | null;
  respondido_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Timeline ───────────────────────────────────────────────────────────────

export type TimelineEtapa =
  | "solicitud"
  | "admision"
  | "citacion"
  | "audiencia"
  | "acta"
  | "archivo";

export interface SgccTimelineEvent {
  id: string;
  case_id: string;
  etapa: TimelineEtapa;
  descripcion: string;
  completado: boolean;
  fecha: string | null;
  referencia_id: string | null;
  created_at: string;
}

// ─── Apoderados ────────────────────────────────────────────────────────────

export interface SgccAttorney {
  id: string;
  nombre: string;
  tipo_doc: TipoDoc;
  numero_doc: string;
  tarjeta_profesional: string | null;
  email: string | null;
  telefono: string | null;
  verificado: boolean;
  verificado_por: string | null;
  verificado_at: string | null;
  activo: boolean;
  created_at: string;
}

export type MotivoCambioApoderado = "inicial" | "renuncia" | "revocatoria" | "sustitucion";

export interface SgccCaseAttorney {
  id: string;
  case_id: string;
  party_id: string;
  attorney_id: string;
  poder_url: string | null;
  poder_vigente_desde: string | null;
  poder_vigente_hasta: string | null;
  motivo_cambio: MotivoCambioApoderado | null;
  registrado_por: string | null;
  activo: boolean;
  created_at: string;
  // joined
  attorney?: SgccAttorney;
  party?: SgccParty;
}

// ─── Checklists ────────────────────────────────────────────────────────────

export type TipoChecklist = "admision" | "poderes";

export interface ChecklistItem {
  nombre: string;
  requerido: boolean;
  descripcion: string;
}

export interface SgccChecklist {
  id: string;
  center_id: string;
  tipo_tramite: TipoTramite;
  tipo_checklist: TipoChecklist;
  nombre: string;
  items: ChecklistItem[];
  activo: boolean;
  created_at: string;
}

export interface SgccChecklistResponse {
  id: string;
  case_id: string;
  checklist_id: string;
  item_index: number;
  completado: boolean;
  verificado_por_staff: string | null;
  documento_id: string | null;
  notas: string | null;
  completed_at: string | null;
}

// ─── Correspondencia ───────────────────────────────────────────────────────

export type CorrespondenciaTipo = "tutela" | "derecho_peticion" | "requerimiento" | "oficio";
export type CorrespondenciaEstado = "recibido" | "en_tramite" | "respondido" | "vencido";

export interface SgccCorrespondence {
  id: string;
  center_id: string;
  case_id: string | null;
  tipo: CorrespondenciaTipo;
  asunto: string;
  remitente: string;
  destinatario: string;
  fecha_radicacion: string;
  fecha_limite_respuesta: string | null;
  estado: CorrespondenciaEstado;
  responsable_staff_id: string | null;
  notas: string | null;
  created_at: string;
  // joined
  responsable?: SgccStaff;
  documentos?: SgccCorrespondenceDoc[];
}

export interface SgccCorrespondenceDoc {
  id: string;
  correspondence_id: string;
  tipo: "escrito_recibido" | "respuesta" | "anexo";
  nombre: string;
  storage_path: string;
  url: string | null;
  created_at: string;
}

// ─── Vigilancia Judicial ───────────────────────────────────────────────────

export type WatchedProcessEstado = "activo" | "terminado" | "archivado";

export interface SgccWatchedProcess {
  id: string;
  center_id: string;
  case_id: string | null;
  numero_proceso: string;
  despacho: string | null;
  ciudad: string | null;
  partes_texto: string | null;
  ultima_actuacion: string | null;
  ultima_actuacion_fecha: string | null;
  estado: WatchedProcessEstado;
  solicitado_por_staff: string | null;
  created_at: string;
  // joined
  updates?: SgccProcessUpdate[];
}

export interface SgccProcessUpdate {
  id: string;
  watched_process_id: string;
  fecha_actuacion: string | null;
  tipo_actuacion: string | null;
  anotacion: string | null;
  detalles: string | null;
  leida: boolean;
  leida_por: string | null;
  leida_at: string | null;
  created_at: string;
}

// ─── Asistencia a Audiencias ───────────────────────────────────────────────

export interface SgccHearingAttendance {
  id: string;
  hearing_id: string;
  party_id: string;
  attorney_id: string | null;
  asistio: boolean;
  representado_por_nombre: string | null;
  poder_verificado: boolean;
  notas: string | null;
  registrado_por_staff: string | null;
  created_at: string;
  // joined
  party?: SgccParty;
  attorney?: SgccAttorney;
}

// ─── Session types ──────────────────────────────────────────────────────────

export interface SgccSession {
  user: {
    id: string;
    email: string;
    name: string;
    userType: "staff" | "party";
    centerId: string;
    sgccRol: StaffRol | null;
  };
}

// ─── Acreencias Insolvencia ─────────────────────────────────────────────

export interface SgccAcreencia {
  id: string;
  case_id: string;
  center_id: string;
  party_id: string | null;
  acreedor_tipo: "natural" | "juridica";
  acreedor_nombre: string;
  acreedor_documento: string | null;
  identificacion_credito: string | null;
  sol_capital: number;
  sol_intereses_corrientes: number;
  sol_intereses_moratorios: number;
  sol_seguros: number;
  sol_otros: number;
  acr_capital: number;
  acr_intereses_corrientes: number;
  acr_intereses_moratorios: number;
  acr_seguros: number;
  acr_otros: number;
  con_capital: number;
  con_intereses_corrientes: number;
  con_intereses_moratorios: number;
  con_seguros: number;
  con_otros: number;
  fecha_conciliacion: string | null;
  porcentaje_voto: number;
  es_pequeno_acreedor: boolean;
  clase_credito: ClaseCredito;
  dias_mora: number;
  mora_90_dias: boolean;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export type ClaseCredito = "primera" | "segunda" | "tercera" | "cuarta" | "quinta";

export type PropuestaEstado = "borrador" | "socializada" | "en_votacion" | "aprobada" | "rechazada";

export interface SgccPropuestaPago {
  id: string;
  case_id: string;
  center_id: string;
  titulo: string;
  descripcion: string;
  plazo_meses: number | null;
  tasa_interes: string | null;
  periodo_gracia_meses: number;
  notas: string | null;
  estado: PropuestaEstado;
  fecha_socializacion: string | null;
  fecha_votacion: string | null;
  resultado_aprobada: boolean | null;
  votos_positivos: number;
  votos_negativos: number;
  porcentaje_aprobacion: number;
  acreedores_positivos: number;
  created_at: string;
  updated_at: string;
}

export type VotoInsolvencia = "positivo" | "negativo" | "abstiene";

export interface SgccVotacionInsolvencia {
  id: string;
  propuesta_id: string;
  acreencia_id: string;
  voto: VotoInsolvencia;
  porcentaje_voto: number;
  observaciones: string | null;
  registrado_por: string | null;
  created_at: string;
}

export interface SgccAcuerdoPago {
  id: string;
  case_id: string;
  center_id: string;
  propuesta_id: string | null;
  capital_total: number;
  tasa_interes_anual: number;
  plazo_meses: number;
  periodo_gracia_meses: number;
  fecha_inicio_pago: string | null;
  valor_cuota_global: number;
  notas: string | null;
  porcentaje_aprobacion: number;
  created_at: string;
  updated_at: string;
}

export interface SgccAcuerdoDetalle {
  id: string;
  acuerdo_id: string;
  acreencia_id: string;
  capital: number;
  intereses_causados: number;
  intereses_futuros: number;
  descuentos_capital: number;
  total_a_pagar: number;
  valor_cuota: number;
  derecho_voto: number;
  sentido_voto: VotoInsolvencia | null;
  created_at: string;
}

// ─── Portal de Partes — Solicitudes ─────────────────────────────────────────

export * from "./solicitudes";
