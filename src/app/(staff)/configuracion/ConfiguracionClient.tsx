"use client";

import { useState, useCallback } from "react";
import type {
  SgccCenter,
  SgccChecklist,
  ChecklistItem,
  TipoTramite,
  TipoChecklist,
} from "@/types";

/* ─── Props ─────────────────────────────────────────────────────────────── */

interface Props {
  center: SgccCenter;
  checklists: SgccChecklist[];
}

/* ─── Constantes ────────────────────────────────────────────────────────── */

const TABS = ["Datos del Centro", "Horarios", "Checklists"] as const;
type Tab = (typeof TABS)[number];

const TIPO_TRAMITE_LABELS: Record<TipoTramite, string> = {
  conciliacion: "Conciliación",
  insolvencia: "Insolvencia",
  acuerdo_apoyo: "Acuerdo de Apoyo",
};

const TIPO_CHECKLIST_LABELS: Record<TipoChecklist, string> = {
  admision: "Admisión",
  poderes: "Poderes",
};

/* ─── Componente principal ──────────────────────────────────────────────── */

export function ConfiguracionClient({ center, checklists: initialChecklists }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("Datos del Centro");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  // Estado del centro
  const [form, setForm] = useState({
    nombre: center.nombre,
    rep_legal: center.rep_legal ?? "",
    direccion: center.direccion ?? "",
    ciudad: center.ciudad,
    departamento: center.departamento ?? "",
    telefono: center.telefono ?? "",
    email_contacto: center.email_contacto ?? "",
    dias_habiles_citacion: center.dias_habiles_citacion,
    hora_inicio_audiencias: center.hora_inicio_audiencias,
    hora_fin_audiencias: center.hora_fin_audiencias,
  });

  // Estado de checklists
  const [checklists, setChecklists] = useState<SgccChecklist[]>(initialChecklists);
  const [expandedChecklist, setExpandedChecklist] = useState<string | null>(null);
  const [showNewChecklist, setShowNewChecklist] = useState(false);
  const [newChecklist, setNewChecklist] = useState({
    tipo_tramite: "conciliacion" as TipoTramite,
    tipo_checklist: "admision" as TipoChecklist,
    nombre: "",
  });

  /* ─── Helpers ───────────────────────────────────────────────────────── */

  const flash = useCallback((type: "ok" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "number" ? Number(value) : value,
    }));
  };

  /* ─── Guardar centro (datos + horarios) ─────────────────────────────── */

  const saveCenter = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/configuracion/centro", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al guardar");
      flash("ok", "Cambios guardados correctamente");
    } catch (err: any) {
      flash("error", err.message);
    } finally {
      setSaving(false);
    }
  };

  /* ─── Checklists CRUD ──────────────────────────────────────────────── */

  const createChecklist = async () => {
    if (!newChecklist.nombre.trim()) {
      flash("error", "El nombre de la checklist es requerido");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/configuracion/checklists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newChecklist, items: [] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al crear");
      setChecklists((prev) => [...prev, data.checklist]);
      setNewChecklist({ tipo_tramite: "conciliacion", tipo_checklist: "admision", nombre: "" });
      setShowNewChecklist(false);
      flash("ok", "Checklist creada correctamente");
    } catch (err: any) {
      flash("error", err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateChecklist = async (cl: SgccChecklist) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/configuracion/checklists/${cl.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: cl.nombre, items: cl.items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al actualizar");
      flash("ok", "Checklist actualizada");
    } catch (err: any) {
      flash("error", err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteChecklist = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar esta checklist?")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/configuracion/checklists/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al eliminar");
      setChecklists((prev) => prev.filter((c) => c.id !== id));
      flash("ok", "Checklist eliminada");
    } catch (err: any) {
      flash("error", err.message);
    } finally {
      setSaving(false);
    }
  };

  /* ─── Helpers items ────────────────────────────────────────────────── */

  const updateItem = (clId: string, idx: number, field: keyof ChecklistItem, value: string | boolean) => {
    setChecklists((prev) =>
      prev.map((cl) => {
        if (cl.id !== clId) return cl;
        const items = [...cl.items];
        items[idx] = { ...items[idx], [field]: value };
        return { ...cl, items };
      })
    );
  };

  const addItem = (clId: string) => {
    setChecklists((prev) =>
      prev.map((cl) => {
        if (cl.id !== clId) return cl;
        return {
          ...cl,
          items: [...cl.items, { nombre: "", requerido: false, descripcion: "" }],
        };
      })
    );
  };

  const removeItem = (clId: string, idx: number) => {
    setChecklists((prev) =>
      prev.map((cl) => {
        if (cl.id !== clId) return cl;
        const items = cl.items.filter((_, i) => i !== idx);
        return { ...cl, items };
      })
    );
  };

  /* ─── Agrupado por tipo_tramite ────────────────────────────────────── */

  const grouped = checklists.reduce<Record<string, SgccChecklist[]>>((acc, cl) => {
    const key = cl.tipo_tramite;
    if (!acc[key]) acc[key] = [];
    acc[key].push(cl);
    return acc;
  }, {});

  /* ─── Render ───────────────────────────────────────────────────────── */

  return (
    <div>
      {/* Mensaje flash */}
      {message && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
            message.type === "ok"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-[#B8860B] text-[#0D2340]"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ─── Tab: Datos del Centro ─────────────────────────────────────── */}
      {activeTab === "Datos del Centro" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-[#0D2340] mb-4">Información General</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label="Nombre del Centro" name="nombre" value={form.nombre} onChange={handleChange} />
            <InputField label="NIT" value={center.nit ?? ""} disabled />
            <InputField label="Representante Legal" name="rep_legal" value={form.rep_legal} onChange={handleChange} />
            <InputField label="Tipo" value={center.tipo} disabled />
            <InputField label="Dirección" name="direccion" value={form.direccion} onChange={handleChange} />
            <InputField label="Ciudad" name="ciudad" value={form.ciudad} onChange={handleChange} />
            <InputField label="Departamento" name="departamento" value={form.departamento} onChange={handleChange} />
            <InputField label="Teléfono" name="telefono" value={form.telefono} onChange={handleChange} />
            <InputField label="Email de Contacto" name="email_contacto" value={form.email_contacto} onChange={handleChange} type="email" />
            <InputField label="Resolución de Habilitación" value={center.resolucion_habilitacion ?? ""} disabled />
            <InputField label="Fecha de Habilitación" value={center.fecha_habilitacion ?? ""} disabled />
          </div>
          <div className="mt-6 flex justify-end">
            <button
              onClick={saveCenter}
              disabled={saving}
              className="px-6 py-2.5 bg-[#0D2340] text-white rounded-lg text-sm font-medium hover:bg-[#0D2340]/90 disabled:opacity-50 transition-colors"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </div>
      )}

      {/* ─── Tab: Horarios ─────────────────────────────────────────────── */}
      {activeTab === "Horarios" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-[#0D2340] mb-4">Configuración de Horarios</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl">
            <InputField
              label="Hora inicio audiencias"
              name="hora_inicio_audiencias"
              value={form.hora_inicio_audiencias}
              onChange={handleChange}
              type="time"
            />
            <InputField
              label="Hora fin audiencias"
              name="hora_fin_audiencias"
              value={form.hora_fin_audiencias}
              onChange={handleChange}
              type="time"
            />
            <InputField
              label="Días hábiles para citación"
              name="dias_habiles_citacion"
              value={String(form.dias_habiles_citacion)}
              onChange={handleChange}
              type="number"
            />
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Los días hábiles para citación determinan el plazo mínimo entre la admisión y la fecha de audiencia.
          </p>
          <div className="mt-6 flex justify-end">
            <button
              onClick={saveCenter}
              disabled={saving}
              className="px-6 py-2.5 bg-[#0D2340] text-white rounded-lg text-sm font-medium hover:bg-[#0D2340]/90 disabled:opacity-50 transition-colors"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </div>
      )}

      {/* ─── Tab: Checklists ───────────────────────────────────────────── */}
      {activeTab === "Checklists" && (
        <div className="space-y-6">
          {/* Botón crear nueva */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowNewChecklist(!showNewChecklist)}
              className="px-4 py-2 bg-[#B8860B] text-white rounded-lg text-sm font-medium hover:bg-[#B8860B]/90 transition-colors"
            >
              + Crear checklist
            </button>
          </div>

          {/* Form nueva checklist */}
          {showNewChecklist && (
            <div className="bg-white rounded-xl border border-[#B8860B]/30 p-5">
              <h3 className="text-sm font-semibold text-[#0D2340] mb-3">Nueva Checklist</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de Trámite</label>
                  <select
                    value={newChecklist.tipo_tramite}
                    onChange={(e) => setNewChecklist((p) => ({ ...p, tipo_tramite: e.target.value as TipoTramite }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#B8860B]/30 focus:border-[#B8860B] outline-none"
                  >
                    {Object.entries(TIPO_TRAMITE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de Checklist</label>
                  <select
                    value={newChecklist.tipo_checklist}
                    onChange={(e) => setNewChecklist((p) => ({ ...p, tipo_checklist: e.target.value as TipoChecklist }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#B8860B]/30 focus:border-[#B8860B] outline-none"
                  >
                    {Object.entries(TIPO_CHECKLIST_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
                  <input
                    value={newChecklist.nombre}
                    onChange={(e) => setNewChecklist((p) => ({ ...p, nombre: e.target.value }))}
                    placeholder="Ej: Requisitos admisión conciliación"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#B8860B]/30 focus:border-[#B8860B] outline-none"
                  />
                </div>
              </div>
              <div className="mt-4 flex gap-2 justify-end">
                <button
                  onClick={() => setShowNewChecklist(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancelar
                </button>
                <button
                  onClick={createChecklist}
                  disabled={saving}
                  className="px-4 py-2 bg-[#0D2340] text-white rounded-lg text-sm font-medium hover:bg-[#0D2340]/90 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Creando..." : "Crear"}
                </button>
              </div>
            </div>
          )}

          {/* Lista agrupada */}
          {Object.keys(grouped).length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500 text-sm">
              No hay checklists configuradas. Crea una nueva para comenzar.
            </div>
          )}

          {Object.entries(grouped).map(([tipo, cls]) => (
            <div key={tipo}>
              <h3 className="text-sm font-semibold text-[#0D2340] mb-2 uppercase tracking-wide">
                {TIPO_TRAMITE_LABELS[tipo as TipoTramite] ?? tipo}
              </h3>
              <div className="space-y-3">
                {cls.map((cl) => {
                  const isExpanded = expandedChecklist === cl.id;
                  return (
                    <div key={cl.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      {/* Header */}
                      <div
                        className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-gray-50"
                        onClick={() => setExpandedChecklist(isExpanded ? null : cl.id)}
                      >
                        <div className="flex items-center gap-3">
                          <svg
                            className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <span className="text-sm font-medium text-gray-900">{cl.nombre}</span>
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                            {TIPO_CHECKLIST_LABELS[cl.tipo_checklist]}
                          </span>
                          <span className="text-xs text-gray-400">{cl.items.length} items</span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteChecklist(cl.id); }}
                          className="text-red-400 hover:text-red-600 text-xs"
                          title="Eliminar checklist"
                        >
                          Eliminar
                        </button>
                      </div>

                      {/* Items expandidos */}
                      {isExpanded && (
                        <div className="border-t border-gray-100 px-5 py-4 space-y-3">
                          {cl.items.map((item, idx) => (
                            <div key={idx} className="flex items-start gap-3 bg-gray-50 rounded-lg p-3">
                              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                                <input
                                  value={item.nombre}
                                  onChange={(e) => updateItem(cl.id, idx, "nombre", e.target.value)}
                                  placeholder="Nombre del item"
                                  className="px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-[#B8860B]/30 focus:border-[#B8860B] outline-none"
                                />
                                <input
                                  value={item.descripcion}
                                  onChange={(e) => updateItem(cl.id, idx, "descripcion", e.target.value)}
                                  placeholder="Descripción"
                                  className="px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-[#B8860B]/30 focus:border-[#B8860B] outline-none"
                                />
                                <div className="flex items-center gap-2">
                                  <label className="flex items-center gap-1.5 text-xs text-gray-600">
                                    <input
                                      type="checkbox"
                                      checked={item.requerido}
                                      onChange={(e) => updateItem(cl.id, idx, "requerido", e.target.checked)}
                                      className="rounded border-gray-300 text-[#B8860B] focus:ring-[#B8860B]"
                                    />
                                    Requerido
                                  </label>
                                </div>
                              </div>
                              <button
                                onClick={() => removeItem(cl.id, idx)}
                                className="mt-1 text-red-400 hover:text-red-600"
                                title="Eliminar item"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}

                          <div className="flex items-center justify-between pt-2">
                            <button
                              onClick={() => addItem(cl.id)}
                              className="text-sm text-[#B8860B] hover:text-[#B8860B]/80 font-medium"
                            >
                              + Agregar item
                            </button>
                            <button
                              onClick={() => updateChecklist(cl)}
                              disabled={saving}
                              className="px-4 py-1.5 bg-[#0D2340] text-white rounded-lg text-sm font-medium hover:bg-[#0D2340]/90 disabled:opacity-50 transition-colors"
                            >
                              {saving ? "Guardando..." : "Guardar checklist"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Componente auxiliar InputField ─────────────────────────────────────── */

function InputField({
  label,
  name,
  value,
  onChange,
  type = "text",
  disabled = false,
}: {
  label: string;
  name?: string;
  value: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`w-full px-3 py-2 border rounded-lg text-sm outline-none transition-colors ${
          disabled
            ? "bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed"
            : "border-gray-300 focus:ring-2 focus:ring-[#B8860B]/30 focus:border-[#B8860B]"
        }`}
      />
    </div>
  );
}
