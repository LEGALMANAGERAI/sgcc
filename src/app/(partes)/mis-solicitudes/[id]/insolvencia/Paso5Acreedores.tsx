"use client";
import { RepeatableList } from "@/components/partes/RepeatableList";
import type { WizardProps } from "../WizardShell";
import type {
  AcreedorFormData,
  FormDataInsolvencia,
  ClasePrelacion,
} from "@/types/solicitudes";
import { CLASE_PRELACION_LABEL } from "@/lib/solicitudes/constants";

const emptyAcreedor = (): AcreedorFormData => ({
  nombre: "",
  capital: 0,
  intereses: 0,
  mas_90_dias_mora: false,
});

export function Paso5Acreedores({ formData, updateFormData }: WizardProps) {
  const fd = formData as Partial<FormDataInsolvencia>;
  const acreedores = fd.acreedores ?? [];
  const totalCapital = acreedores.reduce((s, a) => s + (a.capital || 0), 0);

  return (
    <section>
      <h2 className="font-semibold text-lg mb-1">Acreedores</h2>
      <p className="text-sm text-gray-600 mb-4">
        Registra todas tus deudas indicando la clase de prelación (Art. 2488 y
        siguientes C.C.) y marca si tienen más de 90 días de mora.
      </p>

      <RepeatableList<AcreedorFormData>
        items={acreedores}
        onChange={(nuevos) => updateFormData({ acreedores: nuevos })}
        makeEmpty={emptyAcreedor}
        addLabel="Agregar acreedor"
        renderItem={(a, _i, onC) => (
          <div className="grid grid-cols-2 gap-3">
            <Txt label="Nombre del acreedor *" val={a.nombre} onC={(v) => onC({ nombre: v })} />
            <Txt label="Documento (C.C./NIT)" val={a.numero_doc ?? ""} onC={(v) => onC({ numero_doc: v })} />
            <Txt label="Dirección de notificación judicial" val={a.direccion_notif ?? ""} onC={(v) => onC({ direccion_notif: v })} className="col-span-2" />
            <Txt label="Ciudad" val={a.ciudad ?? ""} onC={(v) => onC({ ciudad: v })} />
            <Txt label="Correo" val={a.correo ?? ""} onC={(v) => onC({ correo: v })} />
            <Txt label="Teléfono" val={a.telefono ?? ""} onC={(v) => onC({ telefono: v })} />
            <Txt label="Tipo de crédito" val={a.tipo_credito ?? ""} onC={(v) => onC({ tipo_credito: v })} />
            <Sel
              label="Clase de prelación *"
              val={a.clase_prelacion ?? ""}
              opts={Object.entries(CLASE_PRELACION_LABEL) as [ClasePrelacion, string][]}
              onC={(v) => onC({ clase_prelacion: v as ClasePrelacion })}
            />
            <Txt label="Naturaleza del crédito" val={a.naturaleza_credito ?? ""} onC={(v) => onC({ naturaleza_credito: v })} />
            <Num label="Capital (COP) *" val={a.capital} onC={(v) => onC({ capital: v })} />
            <Num label="Intereses (COP)" val={a.intereses} onC={(v) => onC({ intereses: v })} />
            <Num label="Días de mora" val={a.dias_mora ?? 0} onC={(v) => onC({ dias_mora: v })} />
            <label className="col-span-2 inline-flex items-center gap-2 text-sm mt-1">
              <input
                type="checkbox"
                checked={a.mas_90_dias_mora}
                onChange={(e) => onC({ mas_90_dias_mora: e.target.checked })}
              />
              Más de 90 días en mora (Art. 538)
            </label>
          </div>
        )}
      />

      <div className="mt-4 text-sm text-gray-600">
        Total capital registrado:{" "}
        <strong>${totalCapital.toLocaleString("es-CO")}</strong>
      </div>
    </section>
  );
}

function Txt({ label, val, onC, className = "" }: { label: string; val: string; onC: (v: string) => void; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input value={val} onChange={(e) => onC(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
    </div>
  );
}
function Num({ label, val, onC }: { label: string; val: number; onC: (v: number) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input type="number" value={val} onChange={(e) => onC(Number(e.target.value))}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
    </div>
  );
}
function Sel({ label, val, onC, opts }: { label: string; val: string; onC: (v: string) => void; opts: [string, string][] }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <select value={val} onChange={(e) => onC(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
        <option value="">Selecciona…</option>
        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}
