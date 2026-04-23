"use client";
import type { WizardProps } from "../WizardShell";
import type { FormDataInsolvencia } from "@/types/solicitudes";
import { PropuestaPagoEditor } from "@/components/propuesta-pago/PropuestaPagoEditor";

export function Paso11PropuestaPago({ formData, updateFormData }: WizardProps) {
  const fd = formData as Partial<FormDataInsolvencia>;
  return (
    <PropuestaPagoEditor
      acreedores={fd.acreedores ?? []}
      propuestaPago={fd.propuesta_pago ?? []}
      condonacionesGlobales={fd.condonaciones_globales}
      onChange={(patch) => updateFormData(patch)}
    />
  );
}
