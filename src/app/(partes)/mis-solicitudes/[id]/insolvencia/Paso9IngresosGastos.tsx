"use client";
import type { WizardProps } from "../WizardShell";
import type { FormDataInsolvencia } from "@/types/solicitudes";

type GastoKey =
  | "alimentacion" | "salud" | "arriendo" | "administracion"
  | "servicios_publicos" | "educacion" | "cuotas_alimentarias"
  | "transporte" | "otros";

const GASTOS: [GastoKey, string][] = [
  ["alimentacion", "Alimentación"],
  ["salud", "Salud"],
  ["arriendo", "Arriendo"],
  ["administracion", "Administración"],
  ["servicios_publicos", "Servicios públicos"],
  ["educacion", "Educación"],
  ["cuotas_alimentarias", "Cuotas alimentarias"],
  ["transporte", "Transporte"],
  ["otros", "Otros"],
];

export function Paso9IngresosGastos({ formData, updateFormData }: WizardProps) {
  const fd = formData as Partial<FormDataInsolvencia>;
  const gastos = fd.gastos ?? {};
  const total = (Object.values(gastos) as (number | undefined)[]).reduce<number>(
    (s, v) => s + (v ?? 0),
    0
  );

  const setGasto = (key: GastoKey, value: number) => {
    const nuevos = { ...gastos, [key]: value };
    const nuevoTotal = (Object.values(nuevos) as (number | undefined)[]).reduce<number>(
      (s, v) => s + (v ?? 0),
      0
    );
    updateFormData({ gastos: nuevos, gastos_subsistencia_mensual: nuevoTotal });
  };

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-semibold text-lg mb-2">Ingresos mensuales</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Monto mensual (COP)
            </label>
            <input
              type="number"
              value={fd.ingresos_mensuales ?? 0}
              onChange={(e) =>
                updateFormData({ ingresos_mensuales: Number(e.target.value) })
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Fuente(s) de ingresos
            </label>
            <input
              value={fd.fuentes_ingresos ?? ""}
              onChange={(e) => updateFormData({ fuentes_ingresos: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Ejemplo: salario, arriendo, honorarios…"
            />
          </div>
        </div>
      </div>

      <div>
        <h2 className="font-semibold text-lg mb-2">Gastos de subsistencia</h2>
        <div className="grid grid-cols-2 gap-3">
          {GASTOS.map(([key, label]) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              <input
                type="number"
                value={gastos[key] ?? 0}
                onChange={(e) => setGasto(key, Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          ))}
        </div>
        <div className="mt-3 text-sm text-gray-700">
          Total: <strong>${total.toLocaleString("es-CO")}</strong>
        </div>
      </div>
    </section>
  );
}
