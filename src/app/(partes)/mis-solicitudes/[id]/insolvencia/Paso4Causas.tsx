"use client";
import type { WizardProps } from "../WizardShell";
import type { FormDataInsolvencia } from "@/types/solicitudes";

export function Paso4Causas({ formData, updateFormData }: WizardProps) {
  const fd = formData as Partial<FormDataInsolvencia>;
  return (
    <section>
      <h2 className="font-semibold text-lg mb-2">Causas de la insolvencia</h2>
      <p className="text-sm text-gray-600 mb-3">
        Describe con claridad los hechos que te llevaron a la situación de
        insolvencia económica.
      </p>
      <textarea
        value={fd.causa_insolvencia ?? ""}
        onChange={(e) => updateFormData({ causa_insolvencia: e.target.value })}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[220px]"
        placeholder="Ejemplo: por causas como enfermedad, pérdida del empleo, sobreendeudamiento, etc."
      />
    </section>
  );
}
