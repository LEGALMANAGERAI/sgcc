"use client";
import { RepeatableList } from "@/components/partes/RepeatableList";
import type { WizardProps } from "../WizardShell";
import type {
  AcreedorFormData,
  CodeudorFormData,
  FormDataInsolvencia,
  ClasePrelacion,
} from "@/types/solicitudes";
import { CLASE_PRELACION_LABEL } from "@/lib/solicitudes/constants";
import { formatearFechaCorteLarga } from "@/lib/solicitudes/fecha-corte";

const emptyAcreedor = (): AcreedorFormData => ({
  nombre: "",
  capital: 0,
  intereses: 0,
  mas_90_dias_mora: false,
  codeudores: [],
});

const emptyCodeudor = (): CodeudorFormData => ({ nombre: "", rol: "codeudor" });

export function Paso5Acreedores({ formData, updateFormData }: WizardProps) {
  const fd = formData as Partial<FormDataInsolvencia>;
  const acreedores = fd.acreedores ?? [];
  const totalCapital = acreedores.reduce((s, a) => s + (a.capital || 0), 0);

  return (
    <section>
      <h2 className="font-semibold text-lg mb-1">Acreedores</h2>
      <p className="text-sm text-gray-600 mb-2">
        Registra todas tus deudas indicando la clase de prelación (Art. 2488 y
        siguientes C.C.) y los datos exigidos por el inciso 7 del Art. 539 Ley
        2445/2025 (modificado por Dec. 1136/2025).
      </p>
      {fd.fecha_corte && (
        <p className="text-xs bg-amber-50 border border-amber-200 rounded-lg p-2 mb-4 text-amber-900">
          <strong>Fecha de corte:</strong> {formatearFechaCorteLarga(fd.fecha_corte)}.
          Toda la información de acreedores debe estar actualizada a esta fecha
          (Parágrafo 2 Art. 539).
        </p>
      )}

      <RepeatableList<AcreedorFormData>
        items={acreedores}
        onChange={(nuevos) => updateFormData({ acreedores: nuevos })}
        makeEmpty={emptyAcreedor}
        addLabel="Agregar acreedor"
        renderItem={(a, _i, onC) => (
          <div className="space-y-4">
            {/* Identificación */}
            <div className="grid grid-cols-2 gap-3">
              <Txt label="Nombre del acreedor *" val={a.nombre} onC={(v) => onC({ nombre: v })} />
              <Txt label="Documento (C.C./NIT)" val={a.numero_doc ?? ""} onC={(v) => onC({ numero_doc: v })} />
              <Txt label="Domicilio / dirección de notificación" val={a.direccion_notif ?? ""} onC={(v) => onC({ direccion_notif: v })} className="col-span-2" />
              <Txt label="Ciudad" val={a.ciudad ?? ""} onC={(v) => onC({ ciudad: v })} />
              <Txt label="Correo electrónico *" val={a.correo ?? ""} onC={(v) => onC({ correo: v })} />
              <Txt label="Teléfono" val={a.telefono ?? ""} onC={(v) => onC({ telefono: v })} />
            </div>

            {/* Naturaleza y clase de prelación */}
            <div className="grid grid-cols-2 gap-3">
              <Txt label="Tipo de crédito" val={a.tipo_credito ?? ""} onC={(v) => onC({ tipo_credito: v })} />
              <Sel
                label="Clase de prelación *"
                val={a.clase_prelacion ?? ""}
                opts={Object.entries(CLASE_PRELACION_LABEL) as [ClasePrelacion, string][]}
                onC={(v) => onC({ clase_prelacion: v as ClasePrelacion })}
              />
              <Txt label="Naturaleza del crédito" val={a.naturaleza_credito ?? ""} onC={(v) => onC({ naturaleza_credito: v })} className="col-span-2" />
            </div>

            {/* Cuantía desglosada (inciso 7 Dec 1136/2025) */}
            <div className="rounded-lg border border-gray-200 p-3 space-y-2">
              <div className="text-xs font-medium text-gray-700">Cuantía desglosada</div>
              <div className="grid grid-cols-3 gap-3">
                <Num label="Capital (COP) *" val={a.capital} onC={(v) => onC({ capital: v })} />
                <Num label="Intereses (COP)" val={a.intereses} onC={(v) => onC({ intereses: v })} />
                <Num
                  label="Otros conceptos (cánones leasing, etc.)"
                  val={a.otros_conceptos ?? 0}
                  onC={(v) => onC({ otros_conceptos: v })}
                />
              </div>
            </div>

            {/* Condiciones crediticias */}
            <div className="grid grid-cols-4 gap-3">
              <Num
                label="Tasa interés mensual (%)"
                val={a.tasa_interes_mensual ?? 0}
                onC={(v) => onC({ tasa_interes_mensual: v })}
                step={0.001}
              />
              <Date_ label="Fecha otorgamiento" val={a.fecha_otorgamiento ?? ""} onC={(v) => onC({ fecha_otorgamiento: v })} />
              <Date_ label="Fecha vencimiento" val={a.fecha_vencimiento ?? ""} onC={(v) => onC({ fecha_vencimiento: v })} />
              <Num label="Días de mora" val={a.dias_mora ?? 0} onC={(v) => onC({ dias_mora: v })} />
            </div>

            {/* Documento soporte */}
            <Txt
              label="Documento en que consta el crédito (pagaré, factura, contrato…)"
              val={a.documento_credito ?? ""}
              onC={(v) => onC({ documento_credito: v })}
              className="col-span-2"
            />

            {/* Flags legales */}
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm inline-flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={a.mas_90_dias_mora}
                  onChange={(e) => onC({ mas_90_dias_mora: e.target.checked })}
                  className="mt-0.5"
                />
                <span>Más de 90 días en mora (Art. 538)</span>
              </label>
              <label className="text-sm inline-flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={!!a.es_postergado_572a}
                  onChange={(e) => onC({ es_postergado_572a: e.target.checked })}
                  className="mt-0.5"
                />
                <span>Crédito postergado (causal 1 Art. 572A)</span>
              </label>
              <label className="col-span-2 text-sm inline-flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={!!a.es_garantia_mobiliaria_solidaria}
                  onChange={(e) => onC({ es_garantia_mobiliaria_solidaria: e.target.checked })}
                  className="mt-0.5"
                />
                <span>
                  Garantía mobiliaria economía solidaria (aportes/ahorros). Se
                  califica 2.ª clase hasta el monto aportado; excedente pasa a 5.ª clase.
                </span>
              </label>
              {a.es_garantia_mobiliaria_solidaria && (
                <Num
                  label="Monto de aportes/ahorros (COP) *"
                  val={a.monto_aportes_ahorros ?? 0}
                  onC={(v) => onC({ monto_aportes_ahorros: v })}
                />
              )}
            </div>

            {/* Codeudores / fiadores / avalistas */}
            <div className="rounded-lg border border-gray-200 p-3">
              <div className="text-xs font-medium text-gray-700 mb-2">
                Codeudores, fiadores o avalistas
              </div>
              <RepeatableList<CodeudorFormData>
                items={a.codeudores ?? []}
                onChange={(nuevos) => onC({ codeudores: nuevos })}
                makeEmpty={emptyCodeudor}
                addLabel="Agregar codeudor/fiador/avalista"
                renderItem={(c, _j, onCC) => (
                  <div className="grid grid-cols-2 gap-3">
                    <Txt label="Nombre *" val={c.nombre} onC={(v) => onCC({ nombre: v })} />
                    <Sel
                      label="Rol"
                      val={c.rol ?? "codeudor"}
                      opts={[
                        ["codeudor", "Codeudor"],
                        ["fiador", "Fiador"],
                        ["avalista", "Avalista"],
                      ]}
                      onC={(v) => onCC({ rol: v as "codeudor" | "fiador" | "avalista" })}
                    />
                    <Txt label="Domicilio" val={c.domicilio ?? ""} onC={(v) => onCC({ domicilio: v })} />
                    <Txt label="Dirección" val={c.direccion ?? ""} onC={(v) => onCC({ direccion: v })} />
                    <Txt label="Teléfono" val={c.telefono ?? ""} onC={(v) => onCC({ telefono: v })} />
                    <Txt label="Correo" val={c.correo ?? ""} onC={(v) => onCC({ correo: v })} />
                  </div>
                )}
              />
            </div>

            {/* "En caso de no conocer alguna información, el deudor deberá expresarlo" */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Información que desconoce (obligatorio expresarla si aplica)
              </label>
              <textarea
                value={a.info_desconocida ?? ""}
                onChange={(e) => onC({ info_desconocida: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[60px]"
                placeholder="Ej. Desconozco la fecha exacta de otorgamiento y la tasa de interés pactada."
              />
            </div>
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
function Num({ label, val, onC, step }: { label: string; val: number; onC: (v: number) => void; step?: number }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type="number"
        step={step ?? 1}
        value={val}
        onChange={(e) => onC(Number(e.target.value))}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
      />
    </div>
  );
}
function Date_({ label, val, onC }: { label: string; val: string; onC: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type="date"
        value={val}
        onChange={(e) => onC(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
      />
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
