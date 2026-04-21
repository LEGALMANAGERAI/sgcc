"use client";
import type { WizardProps } from "../WizardShell";
import type { FormDataInsolvencia, SociedadConyugalEstado } from "@/types/solicitudes";
import { SOCIEDAD_CONYUGAL_ESTADO_LABEL } from "@/lib/solicitudes/constants";

const ESTADOS_CIVILES = [
  "Soltero(a)",
  "Casado(a)",
  "Unión marital de hecho",
  "Divorciado(a)",
  "Viudo(a)",
];

export function Paso10SociedadConyugal({ formData, updateFormData }: WizardProps) {
  const fd = formData as Partial<FormDataInsolvencia>;
  const estado = fd.sociedad_conyugal_estado;
  const exigeLiquidacion = estado === "liquidada_menos_2_anios";

  return (
    <section className="space-y-4">
      <h2 className="font-semibold text-lg">Sociedad conyugal y patrimonial</h2>
      <p className="text-sm text-gray-600">
        Art. 539 #8 Ley 2445/2025. Si la sociedad fue liquidada en los últimos 2
        años debes aportar copia de la escritura o sentencia, y declarar el
        valor comercial de los bienes embargables liquidados.
      </p>

      <div className="grid grid-cols-2 gap-3">
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
            Estado de la sociedad conyugal / patrimonial *
          </label>
          <select
            value={estado ?? ""}
            onChange={(e) =>
              updateFormData({
                sociedad_conyugal_estado: (e.target.value || undefined) as
                  | SociedadConyugalEstado
                  | undefined,
              })
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Selecciona…</option>
            {(Object.entries(SOCIEDAD_CONYUGAL_ESTADO_LABEL) as [SociedadConyugalEstado, string][]).map(
              ([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              )
            )}
          </select>
        </div>
      </div>

      {exigeLiquidacion && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
          <p className="text-sm text-amber-900">
            La sociedad fue liquidada en los últimos 2 años: la ley exige
            información adicional.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Fecha de liquidación *
              </label>
              <input
                type="date"
                value={fd.sociedad_conyugal_fecha_liq ?? ""}
                onChange={(e) =>
                  updateFormData({ sociedad_conyugal_fecha_liq: e.target.value })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Valor comercial estimado de bienes embargables liquidados (COP) *
              </label>
              <input
                type="number"
                value={fd.sociedad_conyugal_valor_bienes ?? 0}
                onChange={(e) =>
                  updateFormData({
                    sociedad_conyugal_valor_bienes: Number(e.target.value),
                  })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <p className="text-xs text-amber-800">
            Carga la escritura pública o sentencia en el paso de{" "}
            <em>Anexos</em> como{" "}
            <em>“Liquidación de sociedad conyugal/patrimonial”</em>.
          </p>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Información adicional (capitulaciones, acuerdos, situaciones especiales)
        </label>
        <textarea
          value={fd.sociedad_conyugal_info ?? ""}
          onChange={(e) => updateFormData({ sociedad_conyugal_info: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[100px]"
          placeholder="Opcional. Ej. capitulaciones prenupciales, separación de bienes, etc."
        />
      </div>
    </section>
  );
}
