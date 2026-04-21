"use client";
import { useEffect } from "react";
import type { WizardProps } from "../WizardShell";
import type { FormDataInsolvencia, TipoDeudor } from "@/types/solicitudes";
import {
  TIPO_DEUDOR_LABEL,
  TOPE_PEQUENO_COMERCIANTE_COP,
} from "@/lib/solicitudes/constants";
import { fechaCorteISO, formatearFechaCorteLarga } from "@/lib/solicitudes/fecha-corte";

export function Paso1TipoDeudor({ formData, updateFormData }: WizardProps) {
  const fd = formData as Partial<FormDataInsolvencia>;

  // Parágrafo 2 Art. 539 Ley 2445/2025: fijar fecha de corte = último día del
  // mes anterior, si aún no está. Se captura al entrar al paso 1 para que
  // quede constante durante toda la edición del draft.
  useEffect(() => {
    if (!fd.fecha_corte) {
      updateFormData({ fecha_corte: fechaCorteISO() });
    }
  }, [fd.fecha_corte, updateFormData]);

  return (
    <section className="space-y-4">
      <h2 className="font-semibold text-lg">Tipo de deudor</h2>
      <p className="text-sm text-gray-600">
        Indica si eres persona natural no comerciante o pequeño comerciante
        conforme a la Ley 2445 de 2025.
      </p>

      {fd.fecha_corte && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900">
          <strong>Fecha de corte:</strong>{" "}
          {formatearFechaCorteLarga(fd.fecha_corte)}. Toda la información de
          acreedores y bienes debe estar actualizada a esta fecha (Parágrafo 2
          Art. 539 Ley 2445/2025).
        </div>
      )}

      <div className="space-y-2">
        {(["pnnc", "pequeno_comerciante"] as TipoDeudor[]).map((t) => (
          <label
            key={t}
            className={`block border-2 rounded-lg p-3 cursor-pointer transition-colors ${
              fd.tipo_deudor === t
                ? "border-[#0D2340] bg-blue-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <input
              type="radio"
              checked={fd.tipo_deudor === t}
              onChange={() => updateFormData({ tipo_deudor: t })}
              className="mr-2"
            />
            <span className="font-medium">{TIPO_DEUDOR_LABEL[t]}</span>
          </label>
        ))}
      </div>

      {fd.tipo_deudor === "pequeno_comerciante" && (
        <div className="space-y-3 rounded-lg bg-amber-50 border border-amber-200 p-4">
          <p className="text-sm text-amber-800">
            Como pequeño comerciante debes acreditar matrícula mercantil y
            activos totales inferiores a <strong>1.000 SMLMV</strong>{" "}
            (excluyendo vivienda familiar y vehículo de trabajo).
            <br />
            Tope actual: <strong>${TOPE_PEQUENO_COMERCIANTE_COP.toLocaleString("es-CO")}</strong>.
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Número de matrícula mercantil *
            </label>
            <input
              value={fd.matricula_mercantil ?? ""}
              onChange={(e) => updateFormData({ matricula_mercantil: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Activos totales declarados (COP) *
            </label>
            <input
              type="number"
              value={fd.activos_totales ?? ""}
              onChange={(e) =>
                updateFormData({
                  activos_totales: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            {fd.activos_totales !== undefined &&
              fd.activos_totales > TOPE_PEQUENO_COMERCIANTE_COP && (
                <p className="text-xs text-red-600 mt-1">
                  Excede el tope de 1.000 SMLMV.
                </p>
              )}
          </div>
        </div>
      )}
    </section>
  );
}
