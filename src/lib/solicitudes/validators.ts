// src/lib/solicitudes/validators.ts
// Validadores puros Ley 2445/2025 (insolvencia) y Ley 1564/2012 (conciliación).
import type {
  FormDataConciliacion,
  FormDataInsolvencia,
  AcreedorFormData,
} from "@/types/solicitudes";
import {
  PORCENTAJE_MORA_MINIMO,
  TOPE_PEQUENO_COMERCIANTE_COP,
} from "./constants";

export interface ValidationError {
  step: number;
  field?: string;
  message: string;
}

// ── Conciliación ────────────────────────────────────────────────────────
export function validarConciliacion(
  fd: Partial<FormDataConciliacion>
): ValidationError[] {
  const errors: ValidationError[] = [];
  const convocados = fd.convocados ?? [];

  if (convocados.length === 0) {
    errors.push({ step: 1, message: "Agrega al menos un convocado" });
  } else {
    convocados.forEach((c, i) => {
      if (c.tipo_persona === "natural") {
        if (!c.nombres || !c.apellidos) {
          errors.push({
            step: 1,
            message: `Convocado ${i + 1}: nombres y apellidos son obligatorios`,
          });
        }
      } else {
        if (!c.razon_social || !c.nit_empresa) {
          errors.push({
            step: 1,
            message: `Convocado ${i + 1}: razón social y NIT son obligatorios`,
          });
        }
      }
      if (!c.email) {
        errors.push({ step: 1, message: `Convocado ${i + 1}: email obligatorio` });
      }
    });
  }

  if (!fd.materia) errors.push({ step: 2, message: "Selecciona la materia" });
  if (!fd.descripcion || fd.descripcion.trim().length < 20) {
    errors.push({ step: 2, message: "Describe el conflicto (mínimo 20 caracteres)" });
  }
  if (!fd.acepta_terminos) {
    errors.push({ step: 5, message: "Debes aceptar los términos y condiciones" });
  }
  return errors;
}

// ── Insolvencia ─────────────────────────────────────────────────────────
interface SupuestosCheck {
  cumple: boolean;
  total_capital: number;
  capital_en_mora: number;
  porcentaje_mora: number;
  acreedores_en_mora_90d: number;
}

export function verificarSupuestosInsolvencia(
  acreedores: AcreedorFormData[]
): SupuestosCheck {
  const total_capital = acreedores.reduce((s, a) => s + (a.capital ?? 0), 0);
  const morosos = acreedores.filter((a) => a.mas_90_dias_mora);
  const capital_en_mora = morosos.reduce((s, a) => s + (a.capital ?? 0), 0);
  const porcentaje_mora = total_capital > 0 ? capital_en_mora / total_capital : 0;
  const acreedores_en_mora_90d = morosos.length;

  const cumple =
    acreedores_en_mora_90d >= 2 &&
    porcentaje_mora >= PORCENTAJE_MORA_MINIMO;

  return {
    cumple,
    total_capital,
    capital_en_mora,
    porcentaje_mora,
    acreedores_en_mora_90d,
  };
}

export function validarInsolvencia(
  fd: Partial<FormDataInsolvencia>,
  adjuntos: { tipo_anexo: string }[] = []
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!fd.tipo_deudor) {
    errors.push({ step: 1, message: "Selecciona el tipo de deudor" });
  }

  if (fd.tipo_deudor === "pequeno_comerciante") {
    if (!fd.matricula_mercantil) {
      errors.push({
        step: 1,
        message: "Matrícula mercantil obligatoria (Art. 539 #10)",
      });
    }
    if (!fd.activos_totales || fd.activos_totales <= 0) {
      errors.push({ step: 1, message: "Ingresa el valor de activos totales" });
    } else if (fd.activos_totales > TOPE_PEQUENO_COMERCIANTE_COP) {
      errors.push({
        step: 1,
        message: `Activos exceden el tope de 1.000 SMLMV (${TOPE_PEQUENO_COMERCIANTE_COP.toLocaleString("es-CO")})`,
      });
    }
  }

  const acreedores = fd.acreedores ?? [];
  if (acreedores.length === 0) {
    errors.push({ step: 5, message: "Debe registrar al menos un acreedor" });
  } else {
    const sup = verificarSupuestosInsolvencia(acreedores);
    if (sup.acreedores_en_mora_90d < 2) {
      errors.push({
        step: 2,
        message: "Se requieren al menos 2 acreedores con mora ≥90 días (Art. 538)",
      });
    }
    if (sup.porcentaje_mora < PORCENTAJE_MORA_MINIMO) {
      errors.push({
        step: 2,
        message: `La mora representa ${(sup.porcentaje_mora * 100).toFixed(1)}% del pasivo; debe ser ≥30% (Art. 538)`,
      });
    }
    acreedores.forEach((a, i) => {
      if (!a.nombre) errors.push({ step: 5, message: `Acreedor ${i + 1} sin nombre` });
      if (!a.clase_prelacion) {
        errors.push({ step: 5, message: `Acreedor ${i + 1} sin clase de prelación` });
      }
    });
  }

  if (!fd.causa_insolvencia || fd.causa_insolvencia.trim().length < 20) {
    errors.push({ step: 4, message: "Describe las causas de la insolvencia" });
  }

  // Propuesta de pago cubre todas las clases con acreedores
  const clasesConAcreedores = new Set(
    acreedores.map((a) => a.clase_prelacion).filter(Boolean)
  );
  const clasesPropuestas = new Set(
    (fd.propuesta_pago ?? []).map((p) => p.clase_prelacion)
  );
  for (const c of clasesConAcreedores) {
    if (!clasesPropuestas.has(c!)) {
      errors.push({ step: 11, message: `Falta propuesta de pago para clase ${c}` });
    }
  }

  // Anexos obligatorios
  const tipos = new Set(adjuntos.map((a) => a.tipo_anexo));
  if (!tipos.has("cedula")) {
    errors.push({ step: 12, message: "Falta copia de cédula" });
  }
  if (!tipos.has("redam")) {
    errors.push({ step: 12, message: "Falta certificado REDAM (Art. 539 #9)" });
  }
  if (fd.tipo_deudor === "pequeno_comerciante" && !tipos.has("matricula_mercantil")) {
    errors.push({ step: 12, message: "Falta anexo de matrícula mercantil" });
  }

  if (!fd.juramento_aceptado) {
    errors.push({ step: 13, message: "Debes aceptar el juramento (Art. 539 §1)" });
  }

  return errors;
}
