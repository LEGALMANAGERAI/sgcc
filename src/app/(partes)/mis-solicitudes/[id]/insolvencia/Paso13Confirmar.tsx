"use client";
import { useState } from "react";
import type { WizardProps } from "../WizardShell";
import type { FormDataInsolvencia } from "@/types/solicitudes";
import { validarInsolvencia } from "@/lib/solicitudes/validators";
import { JURAMENTO_TEXTO } from "@/lib/solicitudes/constants";

export function Paso13Confirmar({
  draftId,
  formData,
  updateFormData,
  adjuntos,
  onRadicado,
}: WizardProps) {
  const fd = formData as Partial<FormDataInsolvencia>;
  const [radicando, setRadicando] = useState(false);
  const [errores, setErrores] = useState<string[]>([]);

  async function radicar() {
    setRadicando(true);
    setErrores([]);
    const val = validarInsolvencia(fd, adjuntos);
    if (val.length) {
      setErrores(val.map((e) => e.message));
      setRadicando(false);
      return;
    }
    const res = await fetch(`/api/partes/solicitudes/${draftId}/radicar`, {
      method: "POST",
    });
    const data = await res.json();
    setRadicando(false);
    if (!res.ok) {
      setErrores(
        data.errors?.map((e: { message: string }) => e.message) ?? [
          data.error ?? "Error al radicar",
        ]
      );
      return;
    }
    onRadicado(data.case_id);
  }

  return (
    <section className="space-y-4">
      <h2 className="font-semibold text-lg">Confirmar solicitud</h2>

      <div className="rounded-lg border border-gray-200 p-4 text-sm space-y-1">
        <p>
          <strong>Tipo de deudor:</strong> {fd.tipo_deudor ?? "—"}
        </p>
        <p>
          <strong>Acreedores:</strong> {fd.acreedores?.length ?? 0}
        </p>
        <p>
          <strong>Bienes:</strong> {fd.bienes?.length ?? 0}
        </p>
        <p>
          <strong>Procesos judiciales:</strong> {fd.procesos?.length ?? 0}
        </p>
        <p>
          <strong>Anexos cargados:</strong> {adjuntos.length}
        </p>
      </div>

      <label className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-4 cursor-pointer">
        <input
          type="checkbox"
          checked={!!fd.juramento_aceptado}
          onChange={(e) => updateFormData({ juramento_aceptado: e.target.checked })}
          className="mt-1"
        />
        <span className="text-sm text-amber-900">{JURAMENTO_TEXTO}</span>
      </label>

      <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={!!fd.solicita_tarifa_especial}
          onChange={(e) =>
            updateFormData({ solicita_tarifa_especial: e.target.checked })
          }
        />
        Solicito tarifa especial según el Art. 536 Ley 1564/2012
      </label>

      {errores.length > 0 && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          <ul className="list-disc pl-5">
            {errores.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        disabled={radicando || !fd.juramento_aceptado}
        onClick={radicar}
        className="bg-[#0D2340] text-white px-6 py-2.5 rounded-lg disabled:opacity-40 text-sm font-medium"
      >
        {radicando ? "Radicando…" : "Radicar solicitud"}
      </button>
    </section>
  );
}
