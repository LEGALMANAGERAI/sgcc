// src/lib/solicitudes/constants.ts
// Constantes Ley 2445 de 2025 (insolvencia PNNC + pequeño comerciante) y Ley 1996/2019.
import type {
  ClasePrelacion, TipoAnexo, TipoDeudor,
  TipoFuenteIngresos, SociedadConyugalEstado,
} from "@/types/solicitudes";

// SMLMV 2026 (ajustar al valor oficial; usar env var si se quiere flexibilidad)
export const SMLMV_2026 = 1_423_500;
export const TOPE_PEQUENO_COMERCIANTE_SMLMV = 1000;
export const TOPE_PEQUENO_COMERCIANTE_COP =
  TOPE_PEQUENO_COMERCIANTE_SMLMV * SMLMV_2026;

export const PORCENTAJE_MORA_MINIMO = 0.30; // 30% Art. 538 Ley 2445/2025
export const UMBRAL_PEQUENO_ACREEDOR = 0.05; // 5% Art. 553 #8

export const TIPO_DEUDOR_LABEL: Record<TipoDeudor, string> = {
  pnnc: "Persona natural no comerciante",
  pequeno_comerciante: "Pequeño comerciante",
};

export const CLASE_PRELACION_LABEL: Record<ClasePrelacion, string> = {
  primera: "Primera clase",
  segunda: "Segunda clase",
  tercera: "Tercera clase",
  cuarta: "Cuarta clase",
  quinta: "Quinta clase",
};

export const TIPO_ANEXO_LABEL: Record<TipoAnexo, string> = {
  cedula: "Copia de cédula",
  redam: "Certificado REDAM",
  poder: "Poder al apoderado",
  tradicion: "Certificado de tradición y libertad",
  soporte_acreencia: "Soporte de acreencia",
  ingresos_contador: "Certificación de ingresos por contador",
  certif_laboral: "Certificación laboral (empleador)",
  certif_pension: "Certificación del fondo de pensiones",
  declaracion_independiente: "Declaración de ingresos (independiente)",
  liquidacion_sociedad_conyugal: "Liquidación de sociedad conyugal/patrimonial",
  documento_bien: "Documento idóneo de bien",
  matricula_mercantil: "Matrícula mercantil",
  otro: "Otro documento",
};

export const TIPO_FUENTE_INGRESOS_LABEL: Record<TipoFuenteIngresos, string> = {
  empleado: "Empleado (dependiente)",
  pensionado: "Pensionado",
  independiente: "Trabajador independiente",
  mixto: "Mixto (varias fuentes)",
};

export const SOCIEDAD_CONYUGAL_ESTADO_LABEL: Record<SociedadConyugalEstado, string> = {
  no_aplica: "No aplica (soltero / sin unión marital)",
  vigente: "Vigente (no liquidada)",
  liquidada_menos_2_anios: "Liquidada en los últimos 2 años",
  liquidada_mas_2_anios: "Liquidada hace más de 2 años",
};

export const JURAMENTO_TEXTO =
  "Bajo la gravedad del juramento manifiesto que no he incurrido en " +
  "omisiones, imprecisiones o errores que impidan conocer mi verdadera " +
  "situación económica y mi capacidad de pago. (Art. 539 §1 Ley 2445/2025)";
