"use client";
import type { WizardProps } from "../WizardShell";
import type { FormDataInsolvencia } from "@/types/solicitudes";

const ESTADOS_CIVILES = [
  "Soltero(a)",
  "Casado(a)",
  "Unión marital de hecho",
  "Divorciado(a)",
  "Viudo(a)",
];

export function Paso10SociedadConyugal({ formData, updateFormData }: WizardProps) {
  const fd = formData as Partial<FormDataInsolvencia>;
  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-lg">Sociedad conyugal y patrimonial</h2>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Estado civil
        </label>
        <select
          value={fd.estado_civil ?? ""}
          onChange={(e) => updateFormData({ estado_civil: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Selecciona…</option>
          {ESTADOS_CIVILES.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Información sobre sociedad conyugal y patrimonial
        </label>
        <textarea
          value={fd.sociedad_conyugal_info ?? ""}
          onChange={(e) => updateFormData({ sociedad_conyugal_info: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[120px]"
          placeholder="Indica si existe sociedad conyugal, capitulaciones, liquidación pendiente, etc."
        />
      </div>
    </section>
  );
}
