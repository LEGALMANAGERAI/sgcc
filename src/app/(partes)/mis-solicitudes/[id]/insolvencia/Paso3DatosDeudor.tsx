"use client";
import type { WizardProps } from "../WizardShell";
import { PersonaForm } from "@/components/partes/PersonaForm";
import type { FormDataInsolvencia, PersonaFormData } from "@/types/solicitudes";

const empty = (): PersonaFormData => ({ tipo_persona: "natural", email: "" });

export function Paso3DatosDeudor({ formData, updateFormData }: WizardProps) {
  const fd = formData as Partial<FormDataInsolvencia>;
  const deudor = fd.deudor ?? empty();
  return (
    <section>
      <h2 className="font-semibold text-lg mb-2">Datos del deudor</h2>
      <p className="text-sm text-gray-600 mb-4">
        Información personal del solicitante.
      </p>
      <PersonaForm
        value={deudor}
        onChange={(patch) =>
          updateFormData({ deudor: { ...deudor, ...patch } })
        }
      />
    </section>
  );
}
