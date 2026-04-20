"use client";
import { RepeatableList } from "@/components/partes/RepeatableList";
import type { WizardProps } from "../WizardShell";
import type {
  FormDataInsolvencia,
  ProcesoJudicialFormData,
} from "@/types/solicitudes";

const empty = (): ProcesoJudicialFormData => ({ tiene_embargo_remate: false });

export function Paso7Procesos({ formData, updateFormData }: WizardProps) {
  const fd = formData as Partial<FormDataInsolvencia>;
  return (
    <section>
      <h2 className="font-semibold text-lg mb-1">Procesos judiciales en tu contra</h2>
      <p className="text-sm text-gray-600 mb-4">
        Relaciona los procesos y actuaciones administrativas patrimoniales en
        curso (Art. 539 Ley 2445/2025).
      </p>
      <RepeatableList<ProcesoJudicialFormData>
        items={fd.procesos ?? []}
        onChange={(procesos) => updateFormData({ procesos })}
        makeEmpty={empty}
        addLabel="Agregar proceso"
        renderItem={(pr, _i, onC) => (
          <div className="grid grid-cols-2 gap-3">
            <Txt label="Juzgado (ciudad)" val={pr.juzgado_ciudad ?? ""} onC={(v) => onC({ juzgado_ciudad: v })} />
            <Txt label="N° radicado" val={pr.numero_radicado ?? ""} onC={(v) => onC({ numero_radicado: v })} />
            <Txt label="Demandante" val={pr.demandante ?? ""} onC={(v) => onC({ demandante: v })} />
            <Txt label="Tipo de proceso" val={pr.tipo_proceso ?? ""} onC={(v) => onC({ tipo_proceso: v })} />
            <label className="col-span-2 inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={pr.tiene_embargo_remate}
                onChange={(e) => onC({ tiene_embargo_remate: e.target.checked })}
              />
              Tiene embargo o remate
            </label>
          </div>
        )}
      />
    </section>
  );
}

function Txt({ label, val, onC }: { label: string; val: string; onC: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input value={val} onChange={(e) => onC(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
    </div>
  );
}
