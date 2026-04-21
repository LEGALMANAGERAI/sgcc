"use client";
import type { WizardProps } from "../WizardShell";
import type { FormDataInsolvencia, TipoFuenteIngresos } from "@/types/solicitudes";
import { TIPO_FUENTE_INGRESOS_LABEL } from "@/lib/solicitudes/constants";

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

  const fuente = fd.tipo_fuente_ingresos;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-semibold text-lg mb-2">Ingresos mensuales</h2>
        <p className="text-sm text-gray-600 mb-3">
          Indica la fuente de tus ingresos. El Art. 539 #6 Ley 2445/2025 exige
          certificación del empleador o fondo de pensiones, o —si eres
          independiente— una declaración de ingresos. El anexo se carga en el
          paso de <em>Anexos</em>.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Tipo de fuente *
            </label>
            <select
              value={fuente ?? ""}
              onChange={(e) =>
                updateFormData({
                  tipo_fuente_ingresos: (e.target.value || undefined) as TipoFuenteIngresos | undefined,
                })
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Selecciona…</option>
              {(Object.entries(TIPO_FUENTE_INGRESOS_LABEL) as [TipoFuenteIngresos, string][]).map(
                ([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Monto mensual (COP) *
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

          {(fuente === "empleado" || fuente === "mixto") && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Empleador — nombre / razón social *
                </label>
                <input
                  value={fd.empleador_nombre ?? ""}
                  onChange={(e) => updateFormData({ empleador_nombre: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Empleador — NIT / documento
                </label>
                <input
                  value={fd.empleador_nit ?? ""}
                  onChange={(e) => updateFormData({ empleador_nit: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </>
          )}

          {(fuente === "pensionado" || fuente === "mixto") && (
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Fondo de pensiones *
              </label>
              <input
                value={fd.fondo_pension ?? ""}
                onChange={(e) => updateFormData({ fondo_pension: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Ej. Colpensiones, Protección, Porvenir…"
              />
            </div>
          )}

          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Detalle de fuentes (opcional)
            </label>
            <input
              value={fd.fuentes_ingresos ?? ""}
              onChange={(e) => updateFormData({ fuentes_ingresos: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Ejemplo: salario, arriendo de apartamento, honorarios por consultorías…"
            />
          </div>
        </div>

        <div className="mt-3 text-xs bg-blue-50 border border-blue-200 rounded-lg p-3 text-blue-900">
          {fuente === "empleado" && (
            <>Debes adjuntar <strong>certificación laboral</strong> expedida por el empleador.</>
          )}
          {fuente === "pensionado" && (
            <>Debes adjuntar <strong>certificación del fondo de pensiones</strong>.</>
          )}
          {fuente === "independiente" && (
            <>Debes adjuntar <strong>declaración firmada de ingresos</strong> (o certificación de contador público).</>
          )}
          {fuente === "mixto" && (
            <>
              Debes adjuntar <strong>certificaciones</strong> de cada fuente
              (laboral + pensional + declaración de ingresos si aplica).
            </>
          )}
          {!fuente && (
            <>Selecciona el tipo de fuente para saber qué anexo es obligatorio.</>
          )}
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
