"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  ChevronRight,
  Pencil,
  Trash2,
  Copy,
  Loader2,
  FileText,
  AlertCircle,
  Globe,
  Building,
} from "lucide-react";

/* ─── Tipos ─────────────────────────────────────────────────────────── */

interface Plantilla {
  id: string;
  center_id: string | null;
  tipo: string;
  nombre: string;
  contenido: string;
  variables: string[] | null;
  es_default: boolean;
  activo: boolean;
  created_at: string;
}

interface Props {
  plantillas: Plantilla[];
  isAdmin: boolean;
  centerId: string;
}

const TIPO_LABELS: Record<string, string> = {
  citacion: "Citación",
  acta_acuerdo: "Acta de acuerdo",
  acta_no_acuerdo: "Acta de no acuerdo",
  acta_inasistencia: "Acta de inasistencia",
  constancia: "Constancia",
  admision: "Admisión",
  rechazo: "Rechazo",
};

const VARIABLES_DISPONIBLES = [
  "centro.nombre", "centro.ciudad", "centro.direccion", "centro.telefono", "centro.resolucion",
  "caso.radicado", "caso.materia", "caso.descripcion", "caso.cuantia",
  "caso.fecha_solicitud", "caso.fecha_audiencia", "caso.fecha_limite_citacion",
  "convocante.nombre", "convocante.doc", "convocante.email", "convocante.telefono", "convocante.direccion",
  "convocados.lista",
  "conciliador.nombre", "conciliador.tarjeta",
  "fecha.hoy",
  "acta.numero", "acta.tipo", "acta.acuerdo",
];

/* ─── Componente ─────────────────────────────────────────────────── */

export function PlantillasClient({ plantillas: initial, isAdmin, centerId }: Props) {
  const router = useRouter();
  const [plantillas, setPlantillas] = useState(initial);
  const [selected, setSelected] = useState<Plantilla | null>(null);
  const [mode, setMode] = useState<"view" | "edit" | "new">("view");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  // Form state
  const [formTipo, setFormTipo] = useState("");
  const [formNombre, setFormNombre] = useState("");
  const [formContenido, setFormContenido] = useState("");

  function flash(type: "ok" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  }

  // Agrupar por tipo
  const grouped = plantillas.reduce<Record<string, Plantilla[]>>((acc, p) => {
    if (!acc[p.tipo]) acc[p.tipo] = [];
    acc[p.tipo].push(p);
    return acc;
  }, {});

  function openEdit(p: Plantilla) {
    setSelected(p);
    setFormTipo(p.tipo);
    setFormNombre(p.nombre);
    setFormContenido(p.contenido);
    setMode("edit");
  }

  function openNew() {
    setSelected(null);
    setFormTipo("citacion");
    setFormNombre("");
    setFormContenido("");
    setMode("new");
  }

  function openDuplicate(p: Plantilla) {
    setSelected(null);
    setFormTipo(p.tipo);
    setFormNombre(`${p.nombre} (copia)`);
    setFormContenido(p.contenido);
    setMode("new");
  }

  async function handleSave() {
    if (!formNombre.trim() || !formContenido.trim()) {
      flash("error", "Nombre y contenido son requeridos");
      return;
    }
    setSaving(true);
    try {
      if (mode === "new") {
        const res = await fetch("/api/plantillas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tipo: formTipo, nombre: formNombre, contenido: formContenido }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setPlantillas((prev) => [...prev, data]);
        flash("ok", "Plantilla creada");
      } else if (mode === "edit" && selected) {
        const res = await fetch(`/api/plantillas/${selected.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre: formNombre, contenido: formContenido }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setPlantillas((prev) => prev.map((p) => (p.id === selected.id ? data : p)));
        flash("ok", "Plantilla actualizada");
      }
      setMode("view");
      setSelected(null);
    } catch (err: any) {
      flash("error", err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Está seguro de eliminar esta plantilla?")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/plantillas/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      setPlantillas((prev) => prev.filter((p) => p.id !== id));
      if (selected?.id === id) {
        setSelected(null);
        setMode("view");
      }
      flash("ok", "Plantilla eliminada");
    } catch (err: any) {
      flash("error", err.message);
    } finally {
      setSaving(false);
    }
  }

  function insertVariable(v: string) {
    setFormContenido((prev) => prev + `{{${v}}}`);
  }

  /* ─── Render ─────────────────────────────────────────────────── */

  return (
    <div>
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

      {/* Editor/Creador */}
      {(mode === "edit" || mode === "new") && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-[#0D2340] mb-4">
            {mode === "new" ? "Nueva Plantilla" : `Editar: ${selected?.nombre}`}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
              <select
                value={formTipo}
                onChange={(e) => setFormTipo(e.target.value)}
                disabled={mode === "edit"}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1B4F9B]/30 focus:border-[#1B4F9B] outline-none disabled:bg-gray-100"
              >
                {Object.entries(TIPO_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
              <input
                type="text"
                value={formNombre}
                onChange={(e) => setFormNombre(e.target.value)}
                placeholder="Ej: Citación para insolvencia"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1B4F9B]/30 focus:border-[#1B4F9B] outline-none"
              />
            </div>
          </div>

          {/* Variables disponibles */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Variables disponibles <span className="text-gray-400">(clic para insertar)</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {VARIABLES_DISPONIBLES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVariable(v)}
                  className="px-2 py-0.5 bg-[#0D2340]/10 text-[#0D2340] rounded text-[10px] font-mono hover:bg-[#0D2340]/20 transition-colors"
                >
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Contenido</label>
            <textarea
              value={formContenido}
              onChange={(e) => setFormContenido(e.target.value)}
              rows={14}
              placeholder="Escriba el texto de la plantilla usando las variables {{...}} donde corresponda..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono leading-relaxed focus:ring-2 focus:ring-[#1B4F9B]/30 focus:border-[#1B4F9B] outline-none resize-y"
            />
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#0D2340] text-white rounded-lg text-sm font-medium hover:bg-[#0D2340]/90 disabled:opacity-50 transition-colors"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === "new" ? "Crear plantilla" : "Guardar cambios"}
            </button>
            <button
              onClick={() => { setMode("view"); setSelected(null); }}
              className="px-5 py-2.5 text-gray-600 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista de plantillas */}
      {mode === "view" && (
        <>
          {isAdmin && (
            <div className="flex justify-end mb-4">
              <button
                onClick={openNew}
                className="flex items-center gap-2 px-4 py-2 bg-[#1B4F9B] text-white rounded-lg text-sm font-medium hover:bg-[#1B4F9B]/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Nueva plantilla
              </button>
            </div>
          )}

          {Object.keys(grouped).length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>No hay plantillas configuradas</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped).map(([tipo, items]) => (
                <div key={tipo}>
                  <h3 className="text-sm font-semibold text-[#0D2340] mb-2 uppercase tracking-wide">
                    {TIPO_LABELS[tipo] ?? tipo}
                  </h3>
                  <div className="space-y-2">
                    {items.map((p) => {
                      const isGlobal = !p.center_id;
                      return (
                        <div
                          key={p.id}
                          className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex items-center justify-between hover:shadow-sm transition-shadow"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {p.nombre}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {isGlobal ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                    <Globe className="w-3 h-3" /> Global
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                                    <Building className="w-3 h-3" /> Centro
                                  </span>
                                )}
                                <span className="text-[10px] text-gray-400">
                                  {p.variables?.length ?? 0} variables
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 flex-shrink-0">
                            {isAdmin && (
                              <button
                                onClick={() => openDuplicate(p)}
                                title="Duplicar como plantilla del centro"
                                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-[#1B4F9B] transition-colors"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                            )}
                            {isAdmin && !isGlobal && (
                              <>
                                <button
                                  onClick={() => openEdit(p)}
                                  title="Editar"
                                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-[#0D2340] transition-colors"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(p.id)}
                                  title="Eliminar"
                                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => {
                                setSelected(p);
                                setFormContenido(p.contenido);
                              }}
                              title="Ver contenido"
                              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Panel de preview */}
          {selected && mode === "view" && (
            <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[#0D2340]">
                  Vista previa: {selected.nombre}
                </h3>
                <button
                  onClick={() => setSelected(null)}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Cerrar
                </button>
              </div>
              <pre className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed border border-gray-100 max-h-96 overflow-y-auto">
                {selected.contenido}
              </pre>
              {selected.variables && selected.variables.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="text-xs text-gray-500">Variables:</span>
                  {selected.variables.map((v: string) => (
                    <span
                      key={v}
                      className="px-2 py-0.5 bg-[#0D2340]/10 text-[#0D2340] rounded text-[10px] font-mono"
                    >
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
