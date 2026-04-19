"use client";
import { useState } from "react";
import { RepeatableList } from "@/components/partes/RepeatableList";
import type { WizardProps } from "../WizardShell";
import type { BienFormData, FormDataInsolvencia, TipoBien } from "@/types/solicitudes";

const empty = (tipo: TipoBien): BienFormData => ({ tipo });

export function Paso6Bienes({ formData, updateFormData }: WizardProps) {
  const fd = formData as Partial<FormDataInsolvencia>;
  const [tab, setTab] = useState<TipoBien>("inmueble");
  const bienes = fd.bienes ?? [];

  const bienesTab = bienes.filter((b) => b.tipo === tab);
  const setBienesTab = (filtered: BienFormData[]) => {
    const otros = bienes.filter((b) => b.tipo !== tab);
    updateFormData({ bienes: [...otros, ...filtered] });
  };

  return (
    <section>
      <h2 className="font-semibold text-lg mb-4">Relación de bienes</h2>
      <div className="flex gap-2 border-b border-gray-200 mb-4">
        {(["inmueble", "mueble", "elemento_hogar"] as TipoBien[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm border-b-2 ${
              tab === t
                ? "border-[#0D2340] text-[#0D2340] font-medium"
                : "border-transparent text-gray-500"
            }`}
          >
            {t === "inmueble" ? "Inmuebles" : t === "mueble" ? "Muebles (vehículos)" : "Elementos del hogar"}
          </button>
        ))}
      </div>

      <RepeatableList<BienFormData>
        items={bienesTab}
        onChange={setBienesTab}
        makeEmpty={() => empty(tab)}
        addLabel="Agregar bien"
        renderItem={(b, _i, onC) => (
          <div className="grid grid-cols-2 gap-3">
            {tab === "inmueble" && (
              <>
                <Txt label="Dirección" val={b.direccion ?? ""} onC={(v) => onC({ direccion: v })} />
                <Txt label="Ciudad" val={b.ciudad ?? ""} onC={(v) => onC({ ciudad: v })} />
                <Txt label="Matrícula inmobiliaria" val={b.matricula_inmobiliaria ?? ""} onC={(v) => onC({ matricula_inmobiliaria: v })} />
                <Num label="% de dominio" val={b.porcentaje_dominio ?? 100} onC={(v) => onC({ porcentaje_dominio: v })} />
                <Txt label="Gravamen (hipoteca/embargo)" val={b.gravamen ?? ""} onC={(v) => onC({ gravamen: v })} />
                <Num label="Valor estimado (COP)" val={b.valor_estimado ?? 0} onC={(v) => onC({ valor_estimado: v })} />
                <label className="col-span-2 text-sm inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!b.afectacion_vivienda_familiar}
                    onChange={(e) => onC({ afectacion_vivienda_familiar: e.target.checked })}
                  />
                  Vivienda familiar o patrimonio de familia
                </label>
              </>
            )}
            {tab === "mueble" && (
              <>
                <Txt label="Tipo (vehículo, maquinaria…)" val={b.descripcion ?? ""} onC={(v) => onC({ descripcion: v })} />
                <Txt label="Marca/Modelo" val={b.marca_modelo ?? ""} onC={(v) => onC({ marca_modelo: v })} />
                <Txt label="N° chasis/placa" val={b.numero_chasis ?? ""} onC={(v) => onC({ numero_chasis: v })} />
                <Num label="% de dominio" val={b.porcentaje_dominio ?? 100} onC={(v) => onC({ porcentaje_dominio: v })} />
                <Txt label="Gravamen (prenda/embargo)" val={b.gravamen ?? ""} onC={(v) => onC({ gravamen: v })} />
                <Num label="Valor estimado (COP)" val={b.valor_estimado ?? 0} onC={(v) => onC({ valor_estimado: v })} />
              </>
            )}
            {tab === "elemento_hogar" && (
              <>
                <Txt label="Descripción" val={b.descripcion ?? ""} onC={(v) => onC({ descripcion: v })} />
                <Num label="Valor estimado (COP)" val={b.valor_estimado ?? 0} onC={(v) => onC({ valor_estimado: v })} />
              </>
            )}
          </div>
        )}
      />
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
