"use client";
import { useState } from "react";
import { RepeatableList } from "@/components/partes/RepeatableList";
import type { WizardProps } from "../WizardShell";
import type { BienFormData, FormDataInsolvencia, TipoBien } from "@/types/solicitudes";
import { formatearFechaCorteLarga } from "@/lib/solicitudes/fecha-corte";

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
      <h2 className="font-semibold text-lg mb-1">Relación de bienes</h2>
      <p className="text-sm text-gray-600 mb-2">
        Incluye todos tus bienes (también los que posees en el exterior).
        Indica valor estimado, gravámenes y medidas cautelares. Debes adjuntar
        documentos idóneos (Art. 539 #4 Ley 2445/2025).
      </p>
      {fd.fecha_corte && (
        <p className="text-xs bg-amber-50 border border-amber-200 rounded-lg p-2 mb-4 text-amber-900">
          <strong>Fecha de corte:</strong> {formatearFechaCorteLarga(fd.fecha_corte)}{" "}
          (Parágrafo 2 Art. 539).
        </p>
      )}

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
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {tab === "inmueble" && (
                <>
                  <Txt label="Dirección" val={b.direccion ?? ""} onC={(v) => onC({ direccion: v })} className="col-span-2" />
                  <Txt label="Ciudad" val={b.ciudad ?? ""} onC={(v) => onC({ ciudad: v })} />
                  <Txt label="Matrícula inmobiliaria" val={b.matricula_inmobiliaria ?? ""} onC={(v) => onC({ matricula_inmobiliaria: v })} />
                  <Num label="% de dominio" val={b.porcentaje_dominio ?? 100} onC={(v) => onC({ porcentaje_dominio: v })} />
                  <Num label="Valor estimado (COP)" val={b.valor_estimado ?? 0} onC={(v) => onC({ valor_estimado: v })} />
                  <Txt label="Gravamen (hipoteca/prenda)" val={b.gravamen ?? ""} onC={(v) => onC({ gravamen: v })} className="col-span-2" />
                </>
              )}
              {tab === "mueble" && (
                <>
                  <Txt label="Tipo (vehículo, maquinaria…)" val={b.descripcion ?? ""} onC={(v) => onC({ descripcion: v })} />
                  <Txt label="Marca/Modelo" val={b.marca_modelo ?? ""} onC={(v) => onC({ marca_modelo: v })} />
                  <Txt label="N° chasis/placa" val={b.numero_chasis ?? ""} onC={(v) => onC({ numero_chasis: v })} />
                  <Num label="% de dominio" val={b.porcentaje_dominio ?? 100} onC={(v) => onC({ porcentaje_dominio: v })} />
                  <Num label="Valor estimado (COP)" val={b.valor_estimado ?? 0} onC={(v) => onC({ valor_estimado: v })} />
                  <Txt label="Gravamen (prenda/garantía)" val={b.gravamen ?? ""} onC={(v) => onC({ gravamen: v })} />
                </>
              )}
              {tab === "elemento_hogar" && (
                <>
                  <Txt label="Descripción" val={b.descripcion ?? ""} onC={(v) => onC({ descripcion: v })} className="col-span-2" />
                  <Num label="Valor estimado (COP)" val={b.valor_estimado ?? 0} onC={(v) => onC({ valor_estimado: v })} />
                </>
              )}
            </div>

            {/* Campos nuevos Ley 2445: cautelares + exterior + patrimonio + docs */}
            <div className="rounded-lg border border-gray-200 p-3 space-y-3 bg-gray-50">
              <Txt
                label="Medidas cautelares vigentes (embargo, secuestro, inscripción de demanda)"
                val={b.medidas_cautelares ?? ""}
                onC={(v) => onC({ medidas_cautelares: v })}
              />

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm inline-flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={!!b.esta_en_exterior}
                    onChange={(e) => onC({ esta_en_exterior: e.target.checked })}
                    className="mt-0.5"
                  />
                  <span>Este bien se encuentra en el exterior</span>
                </label>
                {b.esta_en_exterior && (
                  <Txt
                    label="País"
                    val={b.pais_exterior ?? ""}
                    onC={(v) => onC({ pais_exterior: v })}
                  />
                )}
              </div>

              {tab === "inmueble" && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm inline-flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={!!b.afectacion_vivienda_familiar}
                      onChange={(e) => onC({ afectacion_vivienda_familiar: e.target.checked })}
                      className="mt-0.5"
                    />
                    <span>Afectación a vivienda familiar</span>
                  </label>
                  <label className="text-sm inline-flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={!!b.patrimonio_familia_inembargable}
                      onChange={(e) => onC({ patrimonio_familia_inembargable: e.target.checked })}
                      className="mt-0.5"
                    />
                    <span>Patrimonio de familia inembargable</span>
                  </label>
                </div>
              )}

              <p className="text-xs text-gray-600">
                El Art. 539 #4 exige adjuntar <strong>documento idóneo</strong>{" "}
                (certificado de tradición y libertad, tarjeta de propiedad, etc.).
                Carga el archivo en el paso de <em>Anexos</em> como{" "}
                <em>“Certificado de tradición y libertad”</em> o{" "}
                <em>“Documento idóneo de bien”</em>.
              </p>
            </div>
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
