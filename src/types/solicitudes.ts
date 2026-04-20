// src/types/solicitudes.ts
import type { TipoTramite, CaseMateria } from "./index";

export type TipoDeudor = "pnnc" | "pequeno_comerciante";
export type ClasePrelacion = "primera" | "segunda" | "tercera" | "cuarta" | "quinta";
export type TipoBien = "inmueble" | "mueble" | "elemento_hogar";
export type TipoAnexo =
  | "cedula" | "redam" | "poder" | "tradicion"
  | "soporte_acreencia" | "ingresos_contador" | "matricula_mercantil" | "otro";

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
}

export interface ProcesoJudicialFormData {
  juzgado_ciudad?: string;
  numero_radicado?: string;
  demandante?: string;
  tipo_proceso?: string;
  tiene_embargo_remate: boolean;
}

export interface CuotaCronograma {
  cuota: number;
  capital: number;
  intereses_espera: number;
  intereses_futuros: number;
  saldo: number;
  fecha_pago: string;
}

export interface PropuestaPagoClase {
  clase_prelacion: ClasePrelacion;
  tasa_interes_futura_mensual: number;
  tasa_interes_espera_mensual: number;
  numero_cuotas: number;
  cronograma: CuotaCronograma[];
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
  gastos: Partial<Record<
    "alimentacion" | "salud" | "arriendo" | "administracion"
    | "servicios_publicos" | "educacion" | "cuotas_alimentarias"
    | "transporte" | "otros",
    number
  >>;
  gastos_subsistencia_mensual?: number;
  estado_civil?: string;
  sociedad_conyugal_info?: string;
  propuesta_pago: PropuestaPagoClase[];
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
