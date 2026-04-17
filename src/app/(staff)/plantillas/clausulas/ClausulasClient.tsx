"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Copy,
  Loader2,
  Globe,
  Building,
  Search,
  Puzzle,
  Eye,
  X,
  Tag,
} from "lucide-react";
import type {
  SgccClausula,
  ClausulaCategoria,
  TipoTramite,
  ActaTipo,
} from "@/types";
import {
  CLAUSULA_CATEGORIA_LABEL,
  TIPO_TRAMITE_LABEL,
} from "@/types";

/* ─── Constantes ──────────────────────────────────────────────────── */

const CATEGORIAS: ClausulaCategoria[] = [
  "preambulo",
  "identificacion_partes",
  "consideraciones",
  "obligacion_dar",
  "obligacion_hacer",
  "obligacion_no_hacer",
  "garantias",
  "clausula_penal",
  "confidencialidad",
  "domicilio_notificaciones",
  "desistimiento",
  "inasistencia",
  "cierre",
  "insolvencia_acuerdo_pago",
  "insolvencia_liquidacion",
  "apoyo_decision",
  "otro",
];

const TRAMITES: TipoTramite[] = [
  "conciliacion",
  "insolvencia",
  "acuerdo_apoyo",
  "arbitraje_ejecutivo",
];

const RESULTADOS: { value: ActaTipo; label: string }[] = [
  { value: "acuerdo_total", label: "Acuerdo total" },
  { value: "acuerdo_parcial", label: "Acuerdo parcial" },
  { value: "no_acuerdo", label: "No acuerdo" },
  { value: "inasistencia", label: "Inasistencia" },
  { value: "desistimiento", label: "Desistimiento" },
  { value: "improcedente", label: "Improcedente" },
];

const VARIABLES_DISPONIBLES = [
  "centro.nombre", "centro.ciudad", "centro.direccion", "centro.telefono", "centro.resolucion",
  "caso.radicado", "caso.materia", "caso.descripcion", "caso.cuantia",
  "caso.fecha_solicitud", "caso.fecha_audiencia",
  "convocante.nombre", "convocante.doc", "convocante.email", "convocante.telefono", "convocante.direccion",
  "convocados.lista",
  "conciliador.nombre", "conciliador.tarjeta",
  "fecha.hoy",
  "acta.numero", "acta.tipo", "acta.acuerdo",
];

/* ─── Props ────────────────────────────────────────────────────────── */

interface Props {
  clausulas: SgccClausula[];
  isAdmin: boolean;
}

type Mode = "view" | "edit" | "new";

interface FormState {
  titulo: string;
  categoria: ClausulaCategoria;
  tipo_tramite: TipoTramite | "";
  resultado_aplicable: ActaTipo[];
  contenido: string;
  tags: string;
}

const emptyForm = (): FormState => ({
  titulo: "",
  categoria: "consideraciones",
  tipo_tramite: "",
  resultado_aplicable: [],
  contenido: "",
  tags: "",
});

/* ─── Componente ────────────────────────────────────────────────────── */

export function ClausulasClient({ clausulas: initial, isAdmin }: Props) {
  const [clausulas, setClausulas] = useState(initial);
  const [mode, setMode] = useState<Mode>("view");
  const [selected, setSelected] = useState<SgccClausula | null>(null);
  const [preview, setPreview] = useState<SgccClausula | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  // Filtros
  const [filtroCategoria, setFiltroCategoria] = useState<ClausulaCategoria | "">("");
  const [filtroTramite, setFiltroTramite] = useState<TipoTramite | "">("");
  const [filtroResultado, setFiltroResultado] = useState<ActaTipo | "">("");
  const [busqueda, setBusqueda] = useState("");

  function flash(type: "ok" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  }

  /* ─── Filtrado ───────────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return clausulas.filter((c) => {
      if (filtroCategoria && c.categoria !== filtroCategoria) return false;
      if (filtroTramite && c.tipo_tramite !== null && c.tipo_tramite !== filtroTramite) return false;
      if (filtroResultado) {
        const aplica = c.resultado_aplicable === null || c.resultado_aplicable.includes(filtroResultado);
        if (!aplica) return false;
      }
      if (q) {
        const haystack = `${c.titulo} ${c.contenido} ${(c.tags ?? []).join(" ")}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [clausulas, filtroCategoria, filtroTramite, filtroResultado, busqueda]);

  const grouped = useMemo(() => {
    const map: Record<string, SgccClausula[]> = {};
    for (const c of filtered) {
      if (!map[c.categoria]) map[c.categoria] = [];
      map[c.categoria].push(c);
    }
    return map;
  }, [filtered]);

  /* ─── Actions ────────────────────────────────────────────────────── */

  function openNew() {
    setForm(emptyForm());
    setSelected(null);
    setMode("new");
  }

  function openEdit(c: SgccClausula) {
    setSelected(c);
    setForm({
      titulo: c.titulo,
      categoria: c.categoria,
      tipo_tramite: c.tipo_tramite ?? "",
      resultado_aplicable: c.resultado_aplicable ?? [],
      contenido: c.contenido,
      tags: (c.tags ?? []).join(", "),
    });
    setMode("edit");
  }

  function cancelEdit() {
    setMode("view");
    setSelected(null);
    setForm(emptyForm());
  }

  async function handleSave() {
    if (!form.titulo.trim()) return flash("error", "El título es requerido");
    if (!form.contenido.trim()) return flash("error", "El contenido es requerido");

    const payload = {
      titulo: form.titulo,
      categoria: form.categoria,
      tipo_tramite: form.tipo_tramite || null,
      resultado_aplicable: form.resultado_aplicable.length ? form.resultado_aplicable : null,
      contenido: form.contenido,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
    };

    setSaving(true);
    try {
      if (mode === "new") {
        const res = await fetch("/api/clausulas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setClausulas((prev) => [...prev, data]);
        flash("ok", "Cláusula creada");
      } else if (mode === "edit" && selected) {
        const res = await fetch(`/api/clausulas/${selected.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setClausulas((prev) => prev.map((c) => (c.id === selected.id ? data : c)));
        flash("ok", "Cláusula actualizada");
      }
      cancelEdit();
    } catch (err: any) {
      flash("error", err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: SgccClausula) {
    if (!confirm(`¿Eliminar la cláusula "${c.titulo}"?`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/clausulas/${c.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      setClausulas((prev) => prev.filter((x) => x.id !== c.id));
      if (preview?.id === c.id) setPreview(null);
      flash("ok", "Cláusula eliminada");
    } catch (err: any) {
      flash("error", err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDuplicate(c: SgccClausula) {
    setSaving(true);
    try {
      const res = await fetch(`/api/clausulas/${c.id}/duplicar`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setClausulas((prev) => [...prev, data]);
      flash("ok", "Cláusula duplicada. Ahora puede personalizarla.");
      openEdit(data);
    } catch (err: any) {
      flash("error", err.message);
    } finally {
      setSaving(false);
    }
  }

  function insertVariable(v: string) {
    setForm((prev) => ({ ...prev, contenido: prev.contenido + `{{${v}}}` }));
  }

  function toggleResultado(r: ActaTipo) {
    setForm((prev) => ({
      ...prev,
      resultado_aplicable: prev.resultado_aplicable.includes(r)
        ? prev.resultado_aplicable.filter((x) => x !== r)
        : [...prev.resultado_aplicable, r],
    }));
  }

  /* ─── Render ────────────────────────────────────────────────────── */

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

      {/* Editor */}
      {(mode === "edit" || mode === "new") && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-[#0D2340] mb-4">
            {mode === "new" ? "Nueva cláusula" : `Editar: ${selected?.titulo}`}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Título *</label>
              <input
                type="text"
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                placeholder="Ej: Acuerdo de pago en 12 cuotas"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1B4F9B]/30 focus:border-[#1B4F9B] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Categoría *</label>
              <select
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value as ClausulaCategoria })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1B4F9B]/30 focus:border-[#1B4F9B] outline-none"
              >
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>{CLAUSULA_CATEGORIA_LABEL[c]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Trámite aplicable <span className="text-gray-400">(opcional)</span>
              </label>
              <select
                value={form.tipo_tramite}
                onChange={(e) => setForm({ ...form, tipo_tramite: e.target.value as TipoTramite | "" })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1B4F9B]/30 focus:border-[#1B4F9B] outline-none"
              >
                <option value="">Cualquier trámite</option>
                {TRAMITES.map((t) => (
                  <option key={t} value={t}>{TIPO_TRAMITE_LABEL[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Tags <span className="text-gray-400">(separados por coma)</span>
              </label>
              <input
                type="text"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="pago, cuotas, aceleracion"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1B4F9B]/30 focus:border-[#1B4F9B] outline-none"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Resultados aplicables <span className="text-gray-400">(ninguno marcado = aplica a cualquier resultado)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {RESULTADOS.map((r) => {
                const active = form.resultado_aplicable.includes(r.value);
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => toggleResultado(r.value)}
                    className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                      active
                        ? "bg-[#1B4F9B] border-[#1B4F9B] text-white"
                        : "border-gray-300 text-gray-600 hover:border-[#1B4F9B] hover:text-[#1B4F9B]"
                    }`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>

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
            <label className="block text-xs font-medium text-gray-600 mb-1">Contenido *</label>
            <textarea
              value={form.contenido}
              onChange={(e) => setForm({ ...form, contenido: e.target.value })}
              rows={14}
              placeholder="Texto de la cláusula. Use {{variable}} para tokens y [CORCHETES] para placeholders a llenar manualmente."
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
              {mode === "new" ? "Crear cláusula" : "Guardar cambios"}
            </button>
            <button
              onClick={cancelEdit}
              className="px-5 py-2.5 text-gray-600 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Filtros + lista */}
      {mode === "view" && (
        <>
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="relative md:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por título, contenido o tag…"
                  className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-[#1B4F9B]/30 focus:border-[#1B4F9B] outline-none"
                />
              </div>
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value as ClausulaCategoria | "")}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1B4F9B]/30 focus:border-[#1B4F9B] outline-none"
              >
                <option value="">Todas las categorías</option>
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>{CLAUSULA_CATEGORIA_LABEL[c]}</option>
                ))}
              </select>
              <select
                value={filtroTramite}
                onChange={(e) => setFiltroTramite(e.target.value as TipoTramite | "")}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1B4F9B]/30 focus:border-[#1B4F9B] outline-none"
              >
                <option value="">Todos los trámites</option>
                {TRAMITES.map((t) => (
                  <option key={t} value={t}>{TIPO_TRAMITE_LABEL[t]}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between mt-3">
              <select
                value={filtroResultado}
                onChange={(e) => setFiltroResultado(e.target.value as ActaTipo | "")}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-[#1B4F9B]/30 focus:border-[#1B4F9B] outline-none"
              >
                <option value="">Cualquier resultado</option>
                {RESULTADOS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              {(filtroCategoria || filtroTramite || filtroResultado || busqueda) && (
                <button
                  onClick={() => {
                    setFiltroCategoria("");
                    setFiltroTramite("");
                    setFiltroResultado("");
                    setBusqueda("");
                  }}
                  className="text-xs text-gray-500 hover:text-[#1B4F9B] inline-flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Limpiar filtros
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-gray-500">
              {filtered.length} de {clausulas.length} cláusulas
            </p>
            {isAdmin && (
              <button
                onClick={openNew}
                className="flex items-center gap-2 px-4 py-2 bg-[#1B4F9B] text-white rounded-lg text-sm font-medium hover:bg-[#1B4F9B]/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Nueva cláusula
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
              <Puzzle className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No hay cláusulas que coincidan con los filtros</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped).map(([cat, items]) => (
                <div key={cat}>
                  <h3 className="text-sm font-semibold text-[#0D2340] mb-2 uppercase tracking-wide">
                    {CLAUSULA_CATEGORIA_LABEL[cat as ClausulaCategoria]}
                    <span className="ml-2 text-xs text-gray-400 font-normal normal-case">({items.length})</span>
                  </h3>
                  <div className="space-y-2">
                    {items.map((c) => {
                      const isGlobal = !c.center_id;
                      return (
                        <div
                          key={c.id}
                          className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex items-center justify-between hover:shadow-sm transition-shadow"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <Puzzle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {c.titulo}
                              </p>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                {isGlobal ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                    <Globe className="w-3 h-3" /> Global
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                                    <Building className="w-3 h-3" /> Centro
                                  </span>
                                )}
                                {c.tipo_tramite && (
                                  <span className="text-[10px] text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                                    {TIPO_TRAMITE_LABEL[c.tipo_tramite]}
                                  </span>
                                )}
                                {c.resultado_aplicable?.map((r) => (
                                  <span
                                    key={r}
                                    className="text-[10px] text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded"
                                  >
                                    {RESULTADOS.find((x) => x.value === r)?.label ?? r}
                                  </span>
                                ))}
                                {(c.tags ?? []).slice(0, 3).map((t) => (
                                  <span
                                    key={t}
                                    className="inline-flex items-center gap-0.5 text-[10px] text-gray-500"
                                  >
                                    <Tag className="w-2.5 h-2.5" />{t}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => setPreview(c)}
                              title="Ver contenido"
                              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-[#0D2340] transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => handleDuplicate(c)}
                                title="Duplicar al centro para personalizar"
                                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-[#1B4F9B] transition-colors"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                            )}
                            {isAdmin && !isGlobal && (
                              <>
                                <button
                                  onClick={() => openEdit(c)}
                                  title="Editar"
                                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-[#0D2340] transition-colors"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(c)}
                                  title="Eliminar"
                                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal preview */}
      {preview && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="bg-white rounded-xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-base font-semibold text-[#0D2340]">{preview.titulo}</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {CLAUSULA_CATEGORIA_LABEL[preview.categoria]}
                  {preview.tipo_tramite && ` · ${TIPO_TRAMITE_LABEL[preview.tipo_tramite]}`}
                </p>
              </div>
              <button
                onClick={() => setPreview(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              <pre className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed border border-gray-100">
                {preview.contenido}
              </pre>
              {preview.variables_requeridas?.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-gray-600 mb-1.5">Variables usadas:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {preview.variables_requeridas.map((v) => (
                      <span key={v} className="px-2 py-0.5 bg-[#0D2340]/10 text-[#0D2340] rounded text-[10px] font-mono">
                        {`{{${v}}}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
