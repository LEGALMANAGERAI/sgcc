"use client";
import type { WizardProps } from "../WizardShell";
import type { FormDataInsolvencia } from "@/types/solicitudes";
import { verificarSupuestosInsolvencia } from "@/lib/solicitudes/validators";

export function Paso2Supuestos({ formData }: WizardProps) {
  const fd = formData as Partial<FormDataInsolvencia>;
  const sup = verificarSupuestosInsolvencia(fd.acreedores ?? []);

  return (
    <section className="space-y-4">
      <h2 className="font-semibold text-lg">
        Supuestos de insolvencia (Art. 538 Ley 2445/2025)
      </h2>
      <p className="text-sm text-gray-600">
        Los supuestos se validan automáticamente con los acreedores que
        registres en el paso 5. Debes tener al menos 2 acreedores con mora
        ≥90 días que representen ≥30% de tu pasivo total.
      </p>

      <div
        className={`rounded-lg p-4 border ${
          sup.cumple
            ? "bg-green-50 border-green-200"
            : "bg-red-50 border-red-200"
        }`}
      >
        <div className={`font-semibold mb-2 ${sup.cumple ? "text-green-900" : "text-red-900"}`}>
          {sup.cumple ? "✓ Cumples los supuestos" : "✗ Aún no cumples los supuestos"}
        </div>
        <ul className="text-sm space-y-1 text-gray-700">
          <li>
            • Acreedores con mora ≥90 días: <strong>{sup.acreedores_en_mora_90d}</strong>{" "}
            (mínimo 2)
          </li>
          <li>
            • Capital en mora:{" "}
            <strong>${sup.capital_en_mora.toLocaleString("es-CO")}</strong> de $
            {sup.total_capital.toLocaleString("es-CO")}
          </li>
          <li>
            • Porcentaje de mora:{" "}
            <strong>{(sup.porcentaje_mora * 100).toFixed(1)}%</strong> (mínimo 30%)
          </li>
        </ul>
      </div>

      {(fd.acreedores ?? []).length === 0 && (
        <p className="text-xs text-gray-500">
          Todavía no registras acreedores. Ve al paso 5 para agregarlos.
        </p>
      )}
    </section>
  );
}
