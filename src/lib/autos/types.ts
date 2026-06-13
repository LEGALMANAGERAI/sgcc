// ============================================================
// Tipos compartidos del motor de autos de insolvencia.
// Los consumen: resolver-variables.ts, generar-auto-suspension.ts,
// el endpoint /api/casos/[id]/autos y el formulario de la UI.
// ============================================================

/** Datos legales del centro (perfil legal, migración 045 + base). */
export interface AutoCentro {
  nombre: string;
  resolucion_habilitacion: string | null; // resolución de creación/autorización
  resolucion_insolvencia: string | null;
  codigo_ministerio: string | null;
  direccion: string | null;
  ciudad: string | null;
  telefono: string | null;
  email_radicacion: string | null;
  email_secretaria: string | null;
  email_contacto: string | null;
  pie_vigilado: string | null;
  logo_url: string | null;
}

/** Operador/conciliador que firma el auto (sgcc_staff). */
export interface AutoOperador {
  nombre: string;
  cargo: string; // "OPERADOR DE INSOLVENCIA"
  cedula: string | null;
  ciudad_cedula: string | null;
  tarjeta_profesional: string | null;
  codigo_inscripcion: string | null;
  email: string | null; // para firma electrónica del auto
}

/** Apoderado (del deudor o de un acreedor). */
export interface AutoApoderado {
  nombre: string | null;
  cedula: string | null;
  tarjeta_profesional: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
}

/** Deudor/solicitante de la insolvencia. */
export interface AutoDeudor {
  nombre: string;
  tipo_doc: string | null;
  documento: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  apoderado: AutoApoderado | null;
  presente: boolean | null; // asistencia del insolvente a la audiencia (para firma)
}

/** Acreedor (fila del quórum + tabla de acreencias). */
export interface AutoAcreedor {
  id: string; // sgcc_acreencias.id (para selección parcial de la tabla)
  nombre: string;
  documento: string | null; // NIT/CC
  clase_credito: string | null; // primera..quinta / mixta
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  apoderado: AutoApoderado | null;
  presente: boolean | null; // estado de asistencia (pre-fill)
  // montos conciliados (para la tabla de acreencias opcional)
  capital: number;
  intereses_corrientes: number;
  intereses_moratorios: number;
  seguros: number;
  otros: number;
  total: number;
  porcentaje_voto: number;
  es_pequeno: boolean;
}

export interface AutoCaso {
  radicado: string;
  numero_auto_admisorio: string | null;
  fecha_auto_admisorio: string | null;
}

export interface AutoAudiencia {
  fecha: string | null; // ISO de la audiencia
  hora: string | null;
}

/**
 * Valores SUGERIDOS para pre-llenar el formulario (heredados de la audiencia,
 * de la sala o de autos anteriores). El operador puede editarlos todos.
 */
export interface AutoSugerencias {
  numero_auto: string; // siguiente consecutivo (último auto del caso + 1)
  hora_inicio_corta: string; // "10:23 AM" calculada desde la fecha/hora de la audiencia
  hora_terminacion: string; // "11:23 AM" = inicio + duración de la audiencia
  zoom_url: string;
  zoom_id: string;
  zoom_codigo: string;
  zoom_clave: string;
}

/**
 * Todo lo que el resolver junta del sistema (pre-llenado). El operador lo
 * ajusta en el formulario (las opciones de abajo) antes de generar.
 */
export interface ResolvedAutoVars {
  centro: AutoCentro;
  operador: AutoOperador;
  caso: AutoCaso;
  deudor: AutoDeudor;
  acreedores: AutoAcreedor[];
  audiencia: AutoAudiencia;
  sugerencias: AutoSugerencias;
}

/** Fila editable del quórum en el formulario. */
export interface QuorumFila {
  nombre: string;
  documento: string;
  clase: string; // clase de crédito (o "" para el deudor)
  email: string;
  telefono: string;
  direccion: string;
  presente: boolean;
  apoderado_nombre: string;
  apoderado_cedula: string;
  apoderado_tp: string;
  apoderado_email: string;
  apoderado_telefono: string;
  apoderado_direccion: string;
  apoderado_presente: boolean | null; // null = sin apoderado
  es_deudor: boolean;
}

/**
 * Lo que el operador llena/edita en el formulario del auto de suspensión
 * (los "huecos a diligenciar en vivo"). El esqueleto fijo lo pone el generador.
 */
export interface AutoSuspensionOpciones {
  numero_auto: string;
  // Apertura de la audiencia
  fecha_audiencia_texto: string; // "11 de mayo de 2026"
  hora_audiencia_texto: string; // "diez y veintitrés de la mañana"
  hora_audiencia_corta: string; // "10:23 AM"
  hora_terminacion: string; // "11:23 AM" — hora de terminación de la audiencia
  zoom_apertura_url: string;
  zoom_apertura_id: string;
  zoom_apertura_codigo: string;
  zoom_apertura_clave: string; // clave/passcode de acceso a la sala
  // Considerandos: el numeral 1 es fijo; estos son del 2 en adelante (texto libre)
  considerandos: string[];
  // ids de bloques estándar opcionales a incluir (ver BLOQUES_ESTANDAR)
  bloques_estandar: string[];
  motivo_suspension: string;
  // Tabla de relación de acreencias (opcional)
  incluir_tabla_acreencias: boolean;
  // IDs de acreencias (sgcc_acreencias.id) a incluir en la tabla; si viene
  // vacío/undefined se incluyen TODAS las relacionadas.
  acreenciasSeleccionadasIds?: string[];
  // RESUELVE — continuación
  continuacion_dt: string; // datetime-local "2026-05-26T10:00" (fuente del calendario)
  continuacion_fecha: string; // derivado: "26 de mayo del 2026"
  continuacion_hora: string; // derivado: "10:00 AM"
  continuacion_zoom_url: string;
  continuacion_zoom_codigo: string;
  // Quórum editado (incluye la fila del deudor con es_deudor=true)
  quorum: QuorumFila[];
}

/**
 * Opciones del Auto de Primera Audiencia (firmeza del admisorio).
 * Reusa el esqueleto del de suspensión pero NO suspende: sin continuación,
 * con el toggle condicional de reparos al auto admisorio.
 */
export interface AutoPrimeraAudienciaOpciones {
  numero_auto: string;
  fecha_audiencia_texto: string;
  hora_audiencia_texto: string;
  hora_audiencia_corta: string;
  zoom_apertura_url: string;
  zoom_apertura_id: string;
  zoom_apertura_codigo: string;
  considerandos: string[];
  bloques_estandar: string[];
  incluir_tabla_acreencias: boolean;
  // Condicional de reparos al auto admisorio
  hubo_reparos: boolean;
  reparos_descripcion: string; // qué reparos se plantearon (si hubo_reparos)
  decision_operador: string; // la decisión del operador sobre los reparos (si hubo_reparos)
  // Quórum editado (incluye fila del deudor con es_deudor=true)
  quorum: QuorumFila[];
}

/** Bloques estándar opcionales para los considerandos (numerales 2-6 del doc 08). */
export const BLOQUES_ESTANDAR: Array<{ id: string; label: string; texto: string }> = [
  {
    id: "ilustracion",
    label: "Ilustración del alcance/objeto/límites",
    texto:
      "A continuación, el suscrito operador procede a informar a los presentes el alcance, objeto y límites del escenario procesal en el cual se desarrolla la presente diligencia. Finalizada dicha intervención, se consulta a los asistentes si existe alguna duda, observación o discrepancia respecto de lo expuesto, no registrándose manifestación alguna en contrario.",
  },
  {
    id: "reparos_admisorio",
    label: "Reparos al auto admisorio (queda en firme)",
    texto:
      "Posteriormente, se consulta con los presentes si se tiene algún reparo jurídico contra el auto que admitió el procedimiento de negociación de deudas, so pena de que al no advertirse nada de esto, se dejará en firme lo actuado hasta el momento, incluido el auto de admisión. Ante lo señalado no se presenta manifestación alguna.",
  },
  {
    id: "expediente_digital",
    label: "Expediente digital disponible en el chat",
    texto:
      "Seguidamente, se informa a los presentes que, a través del chat de la sesión, se dejará disponible el enlace del expediente digital, en el cual se incorporarán las documentales que se alleguen dentro del procedimiento. Dicho expediente será de acceso común para todos los intervinientes en el trámite, garantizando así la debida publicidad y transparencia procesal.",
  },
  {
    id: "reconocimiento_personeria",
    label: "Reconocimiento de personería a los abogados",
    texto:
      "Seguidamente, se reconoce personería para actuar dentro del proceso de referencia a los abogados presentes en la diligencia.",
  },
  {
    id: "relacion_acreencias",
    label: "Puesta en conocimiento de la relación de acreencias",
    texto:
      "En este orden de ideas, se pone en conocimiento de los acreedores presentes la relación detallada de las acreencias presentadas dentro del procedimiento. Acto seguido, se les consulta si manifiestan conformidad con las obligaciones relacionadas por parte del deudor, o si presentan dudas, observaciones o discrepancias respecto de las propias o de otras acreencias. Como resultado de dicha intervención, se dejan relacionadas las siguientes acreencias:",
  },
];
