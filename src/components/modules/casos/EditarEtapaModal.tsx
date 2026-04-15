"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import type { TimelineEtapa } from "@/types";

interface Staff { id: string; nombre: string }
interface Sala { id: string; nombre: string; tipo: string }
interface Parte {
  case_party_id: string;
  party_id: string;
  rol: string;
  tipo_persona: string;
  nombres: string | null;
  apellidos: string | null;
  tipo_doc: string | null;
  numero_doc: string | null;
  razon_social: string | null;
  nit_empresa: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  ciudad: string | null;
  apoderado_nombre: string | null;
  apoderado_doc: string | null;
  citacion_enviada_at: string | null;
  citacion_confirmada_at: string | null;
}
interface Audiencia {
  id: string;
  fecha_hora: string;
  duracion_min: number;
  tipo: string;
  estado: string;
  conciliador_id: string | null;
  sala_id: string | null;
  notas_previas: string | null;
}
interface Acta {
  id: string;
  numero_acta: string;
  tipo: string;
  consideraciones: string | null;
  acuerdo_texto: string | null;
  fecha_acta: string;
}

interface Caso {
  id: string;
  numero_radicado: string;
  materia: string;
  cuantia: number | null;
  cuantia_indeterminada: boolean;
  descripcion: string;
  estado: string;
  sub_estado: string | null;
  conciliador_id: string | null;
  secretario_id: string | null;
  motivo_rechazo: string | null;
  fecha_solicitud: string;
  fecha_admision: string | null;
  fecha_limite_citacion: string | null;
  fecha_cierre: string | null;
}

interface Props {
  etapa: TimelineEtapa;
  caso: Caso;
  partes: Parte[];
  audiencias: Audiencia[];
  actas: Acta[];
  conciliadores: Staff[];
  secretarios: Staff[];
  salas: Sala[];
  onClose: () => void;
}

const MATERIAS = ["civil", "comercial", "laboral", "familiar", "consumidor", "arrendamiento", "otro"];
const TIPOS_DOC = ["CC", "CE", "NIT", "Pasaporte", "PPT", "otro"];
const TIPOS_ACTA = ["acuerdo_total", "acuerdo_parcial", "no_acuerdo", "inasistencia", "desistimiento", "improcedente"];
const TIPOS_AUDIENCIA = ["inicial", "continuacion", "complementaria"];
const ESTADOS_AUDIENCIA = ["programada", "en_curso", "suspendida", "finalizada", "cancelada"];
const SUB_ESTADOS = ["acuerdo_total", "acuerdo_parcial", "no_acuerdo", "inasistencia", "desistimiento"];
const TITULO: Record<TimelineEtapa, string> = {
  solicitud: "Editar solicitud",
  admision: "Editar admisión",
  citacion: "Editar citación",
  audiencia: "Editar audiencias",
  acta: "Editar actas",
  archivo: "Editar archivo / cierre",
};

function toDTLocal(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function toDate(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

export function EditarEtapaModal({ etapa, caso, partes, audiencias, actas, conciliadores, secretarios, salas, onClose }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState<any>(() => {
    switch (etapa) {
      case "solicitud":
        return {
          numero_radicado: caso.numero_radicado,
          materia: caso.materia,
          cuantia: caso.cuantia ?? "",
          cuantia_indeterminada: caso.cuantia_indeterminada,
          descripcion: caso.descripcion,
          fecha_solicitud: toDTLocal(caso.fecha_solicitud),
          partes: partes.map((p) => ({ ...p })),
        };
      case "admision":
        return {
          conciliador_id: caso.conciliador_id ?? "",
          secretario_id: caso.secretario_id ?? "",
          motivo_rechazo: caso.motivo_rechazo ?? "",
          fecha_admision: toDTLocal(caso.fecha_admision),
        };
      case "citacion":
        return {
          fecha_limite_citacion: toDate(caso.fecha_limite_citacion),
          case_parties: partes.map((p) => ({
            id: p.case_party_id,
            nombre: p.razon_social || `${p.nombres ?? ""} ${p.apellidos ?? ""}`.trim() || "Sin nombre",
            rol: p.rol,
            citacion_enviada_at: toDTLocal(p.citacion_enviada_at),
            citacion_confirmada_at: toDTLocal(p.citacion_confirmada_at),
          })),
        };
      case "audiencia":
        return {
          audiencias: audiencias.map((a) => ({
            id: a.id,
            fecha_hora: toDTLocal(a.fecha_hora),
            duracion_min: a.duracion_min,
            tipo: a.tipo,
            estado: a.estado,
            conciliador_id: a.conciliador_id ?? "",
            sala_id: a.sala_id ?? "",
            notas_previas: a.notas_previas ?? "",
          })),
        };
      case "acta":
        return {
          actas: actas.map((a) => ({
            id: a.id,
            numero_acta: a.numero_acta,
            tipo: a.tipo,
            consideraciones: a.consideraciones ?? "",
            acuerdo_texto: a.acuerdo_texto ?? "",
            fecha_acta: toDate(a.fecha_acta),
          })),
        };
      case "archivo":
        return {
          fecha_cierre: toDTLocal(caso.fecha_cierre),
          sub_estado: caso.sub_estado ?? "",
        };
    }
  });

  function update(path: string, value: any) {
    setForm((prev: any) => ({ ...prev, [path]: value }));
  }

  function updateListItem(list: string, idx: number, field: string, value: any) {
    setForm((prev: any) => {
      const copy = [...prev[list]];
      copy[idx] = { ...copy[idx], [field]: value };
      return { ...prev, [list]: copy };
    });
  }

  async function handleSubmit() {
    setSaving(true);
    setError("");
    try {
      const data: any = { ...form };
      if (etapa === "solicitud" && data.fecha_solicitud) data.fecha_solicitud = new Date(data.fecha_solicitud).toISOString();
      if (etapa === "admision" && data.fecha_admision) data.fecha_admision = new Date(data.fecha_admision).toISOString();
      if (etapa === "archivo" && data.fecha_cierre) data.fecha_cierre = new Date(data.fecha_cierre).toISOString();
      if (etapa === "audiencia") {
        data.audiencias = data.audiencias.map((a: any) => ({
          ...a,
          fecha_hora: a.fecha_hora ? new Date(a.fecha_hora).toISOString() : null,
          duracion_min: Number(a.duracion_min) || 60,
          conciliador_id: a.conciliador_id || null,
          sala_id: a.sala_id || null,
        }));
      }
      if (etapa === "citacion") {
        data.case_parties = data.case_parties.map((cp: any) => ({
          id: cp.id,
          citacion_enviada_at: cp.citacion_enviada_at ? new Date(cp.citacion_enviada_at).toISOString() : null,
          citacion_confirmada_at: cp.citacion_confirmada_at ? new Date(cp.citacion_confirmada_at).toISOString() : null,
        }));
      }
      const res = await fetch(`/api/casos/${caso.id}/etapa`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etapa, data }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        setError(e.error ?? `Error al guardar (HTTP ${res.status})`);
        return;
      }
      setSuccess(true);
      router.refresh();
      setTimeout(() => onClose(), 1000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{TITULO[etapa]}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
          {success && (
            <div className="bg-green-50 text-green-700 px-3 py-2 rounded border border-green-200 text-sm font-medium flex items-center gap-2">
              ✓ Cambios guardados
            </div>
          )}
          {error && <div className="bg-red-50 text-red-700 px-3 py-2 rounded border border-red-200 text-xs">{error}</div>}

          {etapa === "solicitud" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Número radicado">
                  <input className={inputCls} value={form.numero_radicado} onChange={(e) => update("numero_radicado", e.target.value)} />
                </Field>
                <Field label="Materia">
                  <select className={inputCls} value={form.materia} onChange={(e) => update("materia", e.target.value)}>
                    {MATERIAS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </Field>
                <Field label="Cuantía">
                  <input type="number" className={inputCls} value={form.cuantia} onChange={(e) => update("cuantia", e.target.value)} disabled={form.cuantia_indeterminada} />
                </Field>
                <Field label="Cuantía indeterminada">
                  <label className="flex items-center gap-2 pt-2">
                    <input type="checkbox" checked={form.cuantia_indeterminada} onChange={(e) => update("cuantia_indeterminada", e.target.checked)} />
                    <span className="text-xs text-gray-600">Sí</span>
                  </label>
                </Field>
                <Field label="Fecha solicitud">
                  <input type="datetime-local" className={inputCls} value={form.fecha_solicitud} onChange={(e) => update("fecha_solicitud", e.target.value)} />
                </Field>
              </div>
              <Field label="Descripción">
                <textarea rows={3} className={inputCls} value={form.descripcion} onChange={(e) => update("descripcion", e.target.value)} />
              </Field>

              <h3 className="text-xs uppercase tracking-wider font-semibold text-gray-500 mt-4">Partes</h3>
              {form.partes.map((p: any, idx: number) => (
                <div key={p.case_party_id} className="border border-gray-200 rounded-lg p-3 space-y-2">
                  <p className="text-xs text-gray-500 uppercase">{p.rol}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <select className={inputCls} value={p.tipo_persona ?? "natural"} onChange={(e) => updateListItem("partes", idx, "tipo_persona", e.target.value)}>
                      <option value="natural">Persona natural</option>
                      <option value="juridica">Persona jurídica</option>
                    </select>
                    {p.tipo_persona === "juridica" ? (
                      <>
                        <input className={inputCls} placeholder="Razón social" value={p.razon_social ?? ""} onChange={(e) => updateListItem("partes", idx, "razon_social", e.target.value)} />
                        <input className={inputCls} placeholder="NIT" value={p.nit_empresa ?? ""} onChange={(e) => updateListItem("partes", idx, "nit_empresa", e.target.value)} />
                      </>
                    ) : (
                      <>
                        <input className={inputCls} placeholder="Nombres" value={p.nombres ?? ""} onChange={(e) => updateListItem("partes", idx, "nombres", e.target.value)} />
                        <input className={inputCls} placeholder="Apellidos" value={p.apellidos ?? ""} onChange={(e) => updateListItem("partes", idx, "apellidos", e.target.value)} />
                      </>
                    )}
                    <select className={inputCls} value={p.tipo_doc ?? ""} onChange={(e) => updateListItem("partes", idx, "tipo_doc", e.target.value)}>
                      <option value="">Tipo doc</option>
                      {TIPOS_DOC.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input className={inputCls} placeholder="Número documento" value={p.numero_doc ?? ""} onChange={(e) => updateListItem("partes", idx, "numero_doc", e.target.value)} />
                    <input className={inputCls} placeholder="Email" value={p.email ?? ""} onChange={(e) => updateListItem("partes", idx, "email", e.target.value)} />
                    <input className={inputCls} placeholder="Teléfono" value={p.telefono ?? ""} onChange={(e) => updateListItem("partes", idx, "telefono", e.target.value)} />
                    <input className={inputCls} placeholder="Dirección" value={p.direccion ?? ""} onChange={(e) => updateListItem("partes", idx, "direccion", e.target.value)} />
                    <input className={inputCls} placeholder="Ciudad" value={p.ciudad ?? ""} onChange={(e) => updateListItem("partes", idx, "ciudad", e.target.value)} />
                    <input className={inputCls} placeholder="Apoderado (nombre)" value={p.apoderado_nombre ?? ""} onChange={(e) => updateListItem("partes", idx, "apoderado_nombre", e.target.value)} />
                    <input className={inputCls} placeholder="Apoderado (TP)" value={p.apoderado_doc ?? ""} onChange={(e) => updateListItem("partes", idx, "apoderado_doc", e.target.value)} />
                  </div>
                </div>
              ))}
            </>
          )}

          {etapa === "admision" && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Conciliador">
                <select className={inputCls} value={form.conciliador_id} onChange={(e) => update("conciliador_id", e.target.value)}>
                  <option value="">Sin asignar</option>
                  {conciliadores.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </Field>
              <Field label="Secretario">
                <select className={inputCls} value={form.secretario_id} onChange={(e) => update("secretario_id", e.target.value)}>
                  <option value="">Sin asignar</option>
                  {secretarios.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </Field>
              <Field label="Fecha admisión">
                <input type="datetime-local" className={inputCls} value={form.fecha_admision} onChange={(e) => update("fecha_admision", e.target.value)} />
              </Field>
              <div />
              <Field label="Motivo de rechazo (si aplica)" full>
                <textarea rows={3} className={inputCls} value={form.motivo_rechazo} onChange={(e) => update("motivo_rechazo", e.target.value)} />
              </Field>
            </div>
          )}

          {etapa === "citacion" && (
            <>
              <Field label="Fecha límite de citación">
                <input type="date" className={inputCls} value={form.fecha_limite_citacion} onChange={(e) => update("fecha_limite_citacion", e.target.value)} />
              </Field>
              <h3 className="text-xs uppercase tracking-wider font-semibold text-gray-500 mt-4">Citación por parte</h3>
              {form.case_parties.map((cp: any, idx: number) => (
                <div key={cp.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-medium text-gray-700">{cp.nombre} <span className="text-gray-400 uppercase">· {cp.rol}</span></p>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Enviada">
                      <input type="datetime-local" className={inputCls} value={cp.citacion_enviada_at} onChange={(e) => updateListItem("case_parties", idx, "citacion_enviada_at", e.target.value)} />
                    </Field>
                    <Field label="Confirmada">
                      <input type="datetime-local" className={inputCls} value={cp.citacion_confirmada_at} onChange={(e) => updateListItem("case_parties", idx, "citacion_confirmada_at", e.target.value)} />
                    </Field>
                  </div>
                </div>
              ))}
            </>
          )}

          {etapa === "audiencia" && (
            <>
              {form.audiencias.length === 0 && <p className="text-xs text-gray-400">No hay audiencias registradas.</p>}
              {form.audiencias.map((a: any, idx: number) => (
                <div key={a.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
                  <p className="text-xs uppercase text-gray-500">Audiencia {idx + 1} · {a.tipo}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Fecha y hora">
                      <input type="datetime-local" className={inputCls} value={a.fecha_hora} onChange={(e) => updateListItem("audiencias", idx, "fecha_hora", e.target.value)} />
                    </Field>
                    <Field label="Duración (min)">
                      <input type="number" className={inputCls} value={a.duracion_min} onChange={(e) => updateListItem("audiencias", idx, "duracion_min", e.target.value)} />
                    </Field>
                    <Field label="Tipo">
                      <select className={inputCls} value={a.tipo} onChange={(e) => updateListItem("audiencias", idx, "tipo", e.target.value)}>
                        {TIPOS_AUDIENCIA.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </Field>
                    <Field label="Estado">
                      <select className={inputCls} value={a.estado} onChange={(e) => updateListItem("audiencias", idx, "estado", e.target.value)}>
                        {ESTADOS_AUDIENCIA.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </Field>
                    <Field label="Conciliador">
                      <select className={inputCls} value={a.conciliador_id} onChange={(e) => updateListItem("audiencias", idx, "conciliador_id", e.target.value)}>
                        <option value="">Sin asignar</option>
                        {conciliadores.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </select>
                    </Field>
                    <Field label="Sala">
                      <select className={inputCls} value={a.sala_id} onChange={(e) => updateListItem("audiencias", idx, "sala_id", e.target.value)}>
                        <option value="">Sin asignar</option>
                        {salas.map((s) => <option key={s.id} value={s.id}>{s.nombre} ({s.tipo})</option>)}
                      </select>
                    </Field>
                  </div>
                  <Field label="Notas previas">
                    <textarea rows={2} className={inputCls} value={a.notas_previas} onChange={(e) => updateListItem("audiencias", idx, "notas_previas", e.target.value)} />
                  </Field>
                </div>
              ))}
            </>
          )}

          {etapa === "acta" && (
            <>
              {form.actas.length === 0 && <p className="text-xs text-gray-400">No hay actas registradas.</p>}
              {form.actas.map((a: any, idx: number) => (
                <div key={a.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Número acta">
                      <input className={inputCls} value={a.numero_acta} onChange={(e) => updateListItem("actas", idx, "numero_acta", e.target.value)} />
                    </Field>
                    <Field label="Tipo">
                      <select className={inputCls} value={a.tipo} onChange={(e) => updateListItem("actas", idx, "tipo", e.target.value)}>
                        {TIPOS_ACTA.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </Field>
                    <Field label="Fecha acta">
                      <input type="date" className={inputCls} value={a.fecha_acta} onChange={(e) => updateListItem("actas", idx, "fecha_acta", e.target.value)} />
                    </Field>
                  </div>
                  <Field label="Consideraciones">
                    <textarea rows={2} className={inputCls} value={a.consideraciones} onChange={(e) => updateListItem("actas", idx, "consideraciones", e.target.value)} />
                  </Field>
                  <Field label="Texto del acuerdo">
                    <textarea rows={3} className={inputCls} value={a.acuerdo_texto} onChange={(e) => updateListItem("actas", idx, "acuerdo_texto", e.target.value)} />
                  </Field>
                </div>
              ))}
            </>
          )}

          {etapa === "archivo" && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Fecha de cierre">
                <input type="datetime-local" className={inputCls} value={form.fecha_cierre} onChange={(e) => update("fecha_cierre", e.target.value)} />
              </Field>
              <Field label="Sub-estado (resultado)">
                <select className={inputCls} value={form.sub_estado} onChange={(e) => update("sub_estado", e.target.value)}>
                  <option value="">—</option>
                  {SUB_ESTADOS.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                </select>
              </Field>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose} className="text-sm text-gray-600 hover:underline">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving || success} className="bg-[#0D2340] text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-[#0d2340dd] disabled:opacity-50">
            {success ? "Guardado ✓" : saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0D2340]";

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className="block text-[11px] font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
