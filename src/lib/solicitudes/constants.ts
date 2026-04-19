// src/lib/solicitudes/constants.ts
// Constantes Ley 2445 de 2025 (insolvencia PNNC + pequeño comerciante) y Ley 1996/2019.
import type { ClasePrelacion, TipoAnexo, TipoDeudor } from "@/types/solicitudes";

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
  tradicion: "Certificado de tradición",
  soporte_acreencia: "Soporte de acreencia",
  ingresos_contador: "Certificación de ingresos por contador",
  matricula_mercantil: "Matrícula mercantil",
  otro: "Otro documento",
};

export const JURAMENTO_TEXTO =
  "Bajo la gravedad del juramento manifiesto que no he incurrido en " +
  "omisiones, imprecisiones o errores que impidan conocer mi verdadera " +
  "situación económica y mi capacidad de pago. (Art. 539 §1 Ley 2445/2025)";
