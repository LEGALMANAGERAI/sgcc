// src/types/solicitudes.ts
import type { TipoTramite, CaseMateria } from "./index";

export type TipoDeudor = "pnnc" | "pequeno_comerciante";
export type ClasePrelacion = "primera" | "segunda" | "tercera" | "cuarta" | "quinta";
export type TipoBien = "inmueble" | "mueble" | "elemento_hogar";
export type TipoAnexo =
  | "cedula" | "redam" | "poder" | "tradicion"
  | "soporte_acreencia" | "ingresos_contador" | "matricula_mercantil"
  | "certif_laboral" | "certif_pension" | "declaracion_independiente"
  | "liquidacion_sociedad_conyugal" | "documento_bien" | "otro";

export type TipoFuenteIngresos = "empleado" | "pensionado" | "independiente" | "mixto";

export type SociedadConyugalEstado =
  | "no_aplica" | "vigente" | "liquidada_menos_2_anios" | "liquidada_mas_2_anios";

export interface PersonaFormData {
  tipo_persona: "natural" | "juridica";
  nombres?: string;
  apellidos?: string;
  tipo_doc?: string;
  numero_doc?: string;
  razon_social?: string;
  nit_empresa?: string;
  representante_legal?: string;
  email: string;
  telefono?: string;
  ciudad?: string;
  direccion?: string;
}

export interface CodeudorFormData {
  nombre: string;
  rol?: "codeudor" | "fiador" | "avalista";
  domicilio?: string;
  direccion?: string;
  telefono?: string;
  correo?: string;
}

export interface AcreedorFormData {
  nombre: string;
  tipo_doc?: string;
  numero_doc?: string;
  direccion_notif?: string;
  ciudad?: string;
  correo?: string;
  telefono?: string;
  tipo_credito?: string;
  naturaleza_credito?: string;
  clase_prelacion?: ClasePrelacion;
  capital: number;
  intereses: number;
  dias_mora?: number;
  mas_90_dias_mora: boolean;
  info_adicional?: string;
  // Campos Ley 2445/2025 – inciso 7 corregido por Decreto 1136/2025
  tasa_interes_mensual?: number;
  fecha_otorgamiento?: string; // ISO date
  fecha_vencimiento?: string;  // ISO date
  documento_credito?: string;  // pagaré, factura, contrato, etc.
  otros_conceptos?: number;    // cánones leasing u otros
  es_postergado_572a?: boolean;
  es_garantia_mobiliaria_solidaria?: boolean;
  monto_aportes_ahorros?: number;
  info_desconocida?: string;   // manifestación de lo que no conoce
  codeudores?: CodeudorFormData[];
}

export interface BienFormData {
  tipo: TipoBien;
  descripcion?: string;
  valor_estimado?: number;
  porcentaje_dominio?: number;
  gravamen?: string;
  direccion?: string;
  ciudad?: string;
  matricula_inmobiliaria?: string;
  afectacion_vivienda_familiar?: boolean;
  marca_modelo?: string;
  numero_chasis?: string;
  // Campos Ley 2445/2025 – Art. 539 #4
  medidas_cautelares?: string;
  esta_en_exterior?: boolean;
  pais_exterior?: string;
  patrimonio_familia_inembargable?: boolean;
  documento_idoneo_url?: string;
}

export interface ProcesoJudicialFormData {
  juzgado_ciudad?: string;
  numero_radicado?: string;
  demandante?: string;
  tipo_proceso?: string;
  tiene_embargo_remate: boolean;
}

export type TipoAmortizacion = "francesa" | "lineal";

export interface CuotaCronograma {
  cuota: number;
  mes_relativo: number; // mes 1 = primer pago tras la gracia, contado desde suscripción del acuerdo
  cuota_total: number;
  intereses: number;
  amortizacion: number;
  saldo: number;
}

export interface CondonacionesConfig {
  intereses_corrientes: boolean;
  intereses_moratorios: boolean;
  otros_conceptos_distintos_capital: boolean;
  detalle_adicional?: string;
}

export interface PropuestaPagoCredito {
  acreedor_index: number;
  capital: number;
  tasa_interes_mensual_pct: number;
  numero_cuotas: number;
  meses_gracia: number;
  tipo_amortizacion: TipoAmortizacion;
  porcentaje_prorrata?: number; // solo 5ª clase en modo a prorrata
  cronograma: CuotaCronograma[];
  redaccion_narrativa: string;
  condonaciones_override?: CondonacionesConfig;
}

export interface PropuestaPagoClase {
  clase_prelacion: ClasePrelacion;
  // Campos compartidos (aplican solo cuando la clase es 5ª)
  numero_cuotas_compartido?: number;
  meses_gracia_compartido?: number;
  tipo_amortizacion_compartido?: TipoAmortizacion;
  prioridad_pequenos?: boolean;
  m_cuotas_pequenos?: number;
  creditos: PropuestaPagoCredito[];
}

export interface FormDataConciliacion {
  convocados: PersonaFormData[];
  materia: CaseMateria;
  cuantia?: number;
  cuantia_indeterminada: boolean;
  descripcion: string;
  apoderado?: PersonaFormData & { tarjeta_profesional?: string };
  acepta_terminos: boolean;
}

export interface FormDataInsolvencia {
  tipo_deudor?: TipoDeudor;
  matricula_mercantil?: string;
  activos_totales?: number;
  deudor?: PersonaFormData;
  causa_insolvencia?: string;
  acreedores: AcreedorFormData[];
  bienes: BienFormData[];
  procesos: ProcesoJudicialFormData[];
  obligaciones_alimentarias?: {
    tiene: boolean;
    beneficiarios?: string;
    monto_mensual?: number;
  };
  personas_a_cargo?: number;
  ingresos_mensuales?: number;
  fuentes_ingresos?: string;
  tipo_fuente_ingresos?: TipoFuenteIngresos;
  empleador_nombre?: string;
  empleador_nit?: string;
  fondo_pension?: string;
  gastos: Partial<Record<
    "alimentacion" | "salud" | "arriendo" | "administracion"
    | "servicios_publicos" | "educacion" | "cuotas_alimentarias"
    | "transporte" | "otros",
    number
  >>;
  gastos_subsistencia_mensual?: number;
  estado_civil?: string;
  sociedad_conyugal_info?: string;
  sociedad_conyugal_estado?: SociedadConyugalEstado;
  sociedad_conyugal_fecha_liq?: string;     // ISO date
  sociedad_conyugal_valor_bienes?: number;
  fecha_corte?: string; // ISO date — Parágrafo 2 Art. 539
  propuesta_pago: PropuestaPagoClase[];
  condonaciones_globales?: CondonacionesConfig;
  solicita_tarifa_especial: boolean;
  juramento_aceptado: boolean;
}

export type FormData = FormDataConciliacion | FormDataInsolvencia | Record<string, unknown>;

export interface SolicitudDraft {
  id: string;
  user_id: string;
  center_id: string;
  tipo_tramite: TipoTramite;
  form_data: FormData;
  step_actual: number;
  completado_pct: number;
  created_at: string;
  updated_at: string;
  // Flujo PDF + firma electrónica del deudor (insolvencia Ley 2445/2025)
  solicitud_pdf_url?: string | null;
  solicitud_pdf_hash?: string | null;
  solicitud_pdf_firmado_url?: string | null;
  solicitud_firma_documento_id?: string | null;
  solicitud_firmada_at?: string | null;
  fecha_corte?: string | null;
}

export interface AdjuntoDraft {
  id: string;
  draft_id: string;
  tipo_anexo: TipoAnexo;
  nombre_archivo: string;
  tamano_bytes: number;
  url: string;
  created_at: string;
}
