"use client";
import type { WizardProps } from "../WizardShell";
import type {
  FormDataInsolvencia,
  PropuestaPagoClase,
  ClasePrelacion,
} from "@/types/solicitudes";
import { CLASE_PRELACION_LABEL } from "@/lib/solicitudes/constants";
import { generarCronograma } from "@/lib/solicitudes/payment-plan";

export function Paso11PropuestaPago({ formData, updateFormData }: WizardProps) {
  const fd = formData as Partial<FormDataInsolvencia>;
  const acreedores = fd.acreedores ?? [];
  const propuestas = fd.propuesta_pago ?? [];

  const clasesConAcreedores = Array.from(
    new Set(acreedores.map((a) => a.clase_prelacion).filter(Boolean))
  ) as ClasePrelacion[];

  function capitalPorClase(c: ClasePrelacion) {
    return acreedores
      .filter((a) => a.clase_prelacion === c)
      .reduce((s, a) => s + (a.capital || 0), 0);
  }

  function actualizar(clase: ClasePrelacion, patch: Partial<PropuestaPagoClase>) {
    const existing = propuestas.find((p) => p.clase_prelacion === clase);
    const base: PropuestaPagoClase = existing ?? {
      clase_prelacion: clase,
      tasa_interes_futura_mensual: 1,
      tasa_interes_espera_mensual: 0.5,
      numero_cuotas: 12,
      cronograma: [],
    };
    const merged = { ...base, ...patch };
    merged.cronograma = generarCronograma({
      capital: capitalPorClase(clase),
      numeroCuotas: merged.numero_cuotas,
      tasaFuturaMensual: merged.tasa_interes_futura_mensual,
      tasaEsperaMensual: merged.tasa_interes_espera_mensual,
      fechaInicio: new Date(),
    });
    const next = propuestas
      .filter((p) => p.clase_prelacion !== clase)
      .concat(merged);
    updateFormData({ propuesta_pago: next });
  }

  return (
    <section className="space-y-6">
      <h2 className="font-semibold text-lg">Propuesta de pago por clase</h2>
      {clasesConAcreedores.length === 0 ? (
        <p className="text-sm text-gray-500">
          Agrega acreedores en el paso 5 para ver las clases de prelación
          disponibles.
        </p>
      ) : (
        clasesConAcreedores.map((clase) => {
          const p = propuestas.find((pr) => pr.clase_prelacion === clase);
          const capital = capitalPorClase(clase);
          return (
            <div
              key={clase}
              className="rounded-lg border border-gray-200 bg-gray-50 p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">{CLASE_PRELACION_LABEL[clase]}</h3>
                <span className="text-sm text-gray-600">
                  Capital: ${capital.toLocaleString("es-CO")}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Num
                  label="Tasa futura % mensual"
                  val={p?.tasa_interes_futura_mensual ?? 1}
                  onC={(v) => actualizar(clase, { tasa_interes_futura_mensual: v })}
                  step="0.01"
                />
                <Num
                  label="Tasa espera % mensual"
                  val={p?.tasa_interes_espera_mensual ?? 0.5}
                  onC={(v) => actualizar(clase, { tasa_interes_espera_mensual: v })}
                  step="0.01"
                />
                <Num
                  label="N° de cuotas"
                  val={p?.numero_cuotas ?? 12}
                  onC={(v) => actualizar(clase, { numero_cuotas: v })}
                />
              </div>
              {p?.cronograma && p.cronograma.length > 0 && (
                <details className="mt-4">
                  <summary className="text-xs text-[#1B4F9B] cursor-pointer">
                    Ver cronograma ({p.cronograma.length} cuotas)
                  </summary>
                  <table className="w-full mt-2 text-xs">
                    <thead>
                      <tr className="text-gray-500">
                        <th className="text-left">#</th>
                        <th className="text-right">Capital</th>
                        <th className="text-right">Int. espera</th>
                        <th className="text-right">Int. futuro</th>
                        <th className="text-right">Saldo</th>
                        <th className="text-right">Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.cronograma.map((c) => (
                        <tr key={c.cuota}>
                          <td>{c.cuota}</td>
                          <td className="text-right">${c.capital.toLocaleString("es-CO")}</td>
                          <td className="text-right">${c.intereses_espera.toLocaleString("es-CO")}</td>
                          <td className="text-right">${c.intereses_futuros.toLocaleString("es-CO")}</td>
                          <td className="text-right">${c.saldo.toLocaleString("es-CO")}</td>
                          <td className="text-right">{c.fecha_pago}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              )}
            </div>
          );
        })
      )}
    </section>
  );
}

function Num({
  label, val, onC, step,
}: { label: string; val: number; onC: (v: number) => void; step?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type="number"
        step={step}
        value={val}
        onChange={(e) => onC(Number(e.target.value))}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
      />
    </div>
  );
}
