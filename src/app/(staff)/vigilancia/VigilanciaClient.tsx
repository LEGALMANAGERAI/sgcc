"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Trash2,
  AlertCircle,
  CheckCircle,
  Archive,
  Loader2,
  FileText,
} from "lucide-react";
import type { SgccProcessUpdate, WatchedProcessEstado } from "@/types";

/* ─── Tipos ─────────────────────────────────────────────────────────────── */

interface Proceso {
  id: string;
  center_id: string;
  case_id: string | null;
  numero_proceso: string;
  despacho: string | null;
  ciudad: string | null;
  partes_texto: string | null;
  ultima_actuacion: string | null;
  ultima_actuacion_fecha: string | null;
  estado: WatchedProcessEstado;
  solicitado_por_staff: string | null;
  created_at: string;
  caso?: { id: string; numero_radicado: string } | null;
  actuaciones_no_leidas: number;
}

interface Caso {
  id: string;
  numero_radicado: string;
  materia: string;
  estado: string;
}

interface Props {
  procesos: Proceso[];
  casos: Caso[];
  estadoFiltro: string;
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */

const estadoLabels: Record<WatchedProcessEstado, string> = {
  activo: "Activo",
  terminado: "Terminado",
  archivado: "Archivado",
};

const estadoColors: Record<WatchedProcessEstado, string> = {
  activo: "bg-green-100 text-green-800",
  terminado: "bg-gray-100 text-gray-800",
  archivado: "bg-amber-100 text-amber-800",
};

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/* ─── Componente principal ──────────────────────────────────────────────── */

export function VigilanciaClient({ procesos, casos, estadoFiltro }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    numero_proceso: "",
    despacho: "",
    ciudad: "",
    case_id: "",
    partes_texto: "",
  });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Expanded rows
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actuaciones, setActuaciones] = useState<SgccProcessUpdate[]>([]);
  const [loadingActuaciones, setLoadingActuaciones] = useState(false);

  // Nueva actuación
  const [showActuacionForm, setShowActuacionForm] = useState(false);
  const [actuacionData, setActuacionData] = useState({
    fecha_actuacion: "",
    tipo_actuacion: "",
    anotacion: "",
    detalles: "",
  });
  const [actuacionSubmitting, setActuacionSubmitting] = useState(false);

  /* ─── Filtro por estado ─────────────────────────────────────────────── */

  function handleFiltro(estado: string) {
    const url = estado === "todos" ? "/vigilancia" : `/vigilancia?estado=${estado}`;
    startTransition(() => router.push(url));
  }

  /* ─── Agregar proceso ───────────────────────────────────────────────── */

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!formData.numero_proceso.trim()) {
      setFormError("El número de proceso es requerido");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/vigilancia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          case_id: formData.case_id || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setFormError(err.error || "Error al agregar proceso");
        return;
      }
      setFormData({ numero_proceso: "", despacho: "", ciudad: "", case_id: "", partes_texto: "" });
      setShowForm(false);
      startTransition(() => router.refresh());
    } catch {
      setFormError("Error de conexión");
    } finally {
      setSubmitting(false);
    }
  }

  /* ─── Cambiar estado ────────────────────────────────────────────────── */

  async function handleEstado(id: string, estado: WatchedProcessEstado) {
    try {
      const res = await fetch(`/api/vigilancia/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado }),
      });
      if (res.ok) startTransition(() => router.refresh());
    } catch {
      /* silenciar */
    }
  }

  /* ─── Eliminar proceso ──────────────────────────────────────────────── */

  async function handleDelete(id: string) {
    if (!confirm("¿Está seguro de eliminar este proceso de vigilancia?")) return;
    try {
      const res = await fetch(`/api/vigilancia/${id}`, { method: "DELETE" });
      if (res.ok) startTransition(() => router.refresh());
    } catch {
      /* silenciar */
    }
  }

  /* ─── Ver actuaciones ───────────────────────────────────────────────── */

  async function toggleActuaciones(processId: string) {
    if (expandedId === processId) {
      setExpandedId(null);
      setActuaciones([]);
      setShowActuacionForm(false);
      return;
    }
    setExpandedId(processId);
    setLoadingActuaciones(true);
    setShowActuacionForm(false);
    try {
      const res = await fetch(`/api/vigilancia/${processId}/actuaciones`);
      if (res.ok) {
        const data = await res.json();
        setActuaciones(data);
      }
    } catch {
      /* silenciar */
    } finally {
      setLoadingActuaciones(false);
    }
  }

  /* ─── Marcar como leída ─────────────────────────────────────────────── */

  async function markAsRead(processId: string, updateId: string) {
    try {
      const res = await fetch(`/api/vigilancia/${processId}/actuaciones`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ update_id: updateId }),
      });
      if (res.ok) {
        setActuaciones((prev) =>
          prev.map((a) => (a.id === updateId ? { ...a, leida: true } : a))
        );
        startTransition(() => router.refresh());
      }
    } catch {
      /* silenciar */
    }
  }

  /* ─── Agregar actuación ─────────────────────────────────────────────── */

  async function handleActuacionSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!expandedId) return;
    if (!actuacionData.tipo_actuacion.trim() && !actuacionData.anotacion.trim()) return;

    setActuacionSubmitting(true);
    try {
      const res = await fetch(`/api/vigilancia/${expandedId}/actuaciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(actuacionData),
      });
      if (res.ok) {
        setActuacionData({ fecha_actuacion: "", tipo_actuacion: "", anotacion: "", detalles: "" });
        setShowActuacionForm(false);
        // Recargar actuaciones
        await toggleActuaciones(expandedId);
        await toggleActuaciones(expandedId);
        startTransition(() => router.refresh());
      }
    } catch {
      /* silenciar */
    } finally {
      setActuacionSubmitting(false);
    }
  }

  /* ─── Render ────────────────────────────────────────────────────────── */

  return (
    <div>
      {/* Filtros y botón agregar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex gap-2">
          {["todos", "activo", "terminado", "archivado"].map((e) => (
            <button
              key={e}
              onClick={() => handleFiltro(e)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                estadoFiltro === e
                  ? "bg-[#0D2340] text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {e === "todos" ? "Todos" : estadoLabels[e as WatchedProcessEstado]}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-[#1B4F9B] text-white rounded-lg text-sm font-medium hover:bg-[#9a7209] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Agregar proceso
        </button>
      </div>

      {/* Formulario inline para agregar proceso */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-gray-200 rounded-xl p-5 mb-4 shadow-sm"
        >
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Nuevo proceso a vigilar</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Nº Proceso <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.numero_proceso}
                onChange={(e) => setFormData({ ...formData, numero_proceso: e.target.value })}
                placeholder="Ej: 11001310300220230012300"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0D2340] focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Despacho</label>
              <input
                type="text"
                value={formData.despacho}
                onChange={(e) => setFormData({ ...formData, despacho: e.target.value })}
                placeholder="Ej: Juzgado 2 Civil del Circuito"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0D2340] focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ciudad</label>
              <input
                type="text"
                value={formData.ciudad}
                onChange={(e) => setFormData({ ...formData, ciudad: e.target.value })}
                placeholder="Ej: Bogotá D.C."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0D2340] focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Caso vinculado (opcional)
              </label>
              <select
                value={formData.case_id}
                onChange={(e) => setFormData({ ...formData, case_id: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0D2340] focus:border-transparent outline-none"
              >
                <option value="">Sin vincular</option>
                {casos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.numero_radicado} — {c.materia} ({c.estado})
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Partes del proceso
              </label>
              <input
                type="text"
                value={formData.partes_texto}
                onChange={(e) => setFormData({ ...formData, partes_texto: e.target.value })}
                placeholder="Ej: Juan Pérez vs. ABC S.A.S."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0D2340] focus:border-transparent outline-none"
              />
            </div>
          </div>

          {formError && (
            <div className="flex items-center gap-2 mt-3 text-sm text-red-600">
              <AlertCircle className="w-4 h-4" />
              {formError}
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 bg-[#0D2340] text-white rounded-lg text-sm font-medium hover:bg-[#0D2340]/90 disabled:opacity-50 transition-colors"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Agregar
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setFormError("");
              }}
              className="px-4 py-2 text-gray-600 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Tabla de procesos */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {procesos.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Eye className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No hay procesos en vigilancia</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Nº Proceso</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Despacho</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Ciudad</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Caso vinculado</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Última actuación</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {procesos.map((p) => (
                  <ProcessRow
                    key={p.id}
                    proceso={p}
                    isExpanded={expandedId === p.id}
                    actuaciones={expandedId === p.id ? actuaciones : []}
                    loadingActuaciones={expandedId === p.id && loadingActuaciones}
                    showActuacionForm={expandedId === p.id && showActuacionForm}
                    actuacionData={actuacionData}
                    actuacionSubmitting={actuacionSubmitting}
                    onToggle={() => toggleActuaciones(p.id)}
                    onEstado={(estado) => handleEstado(p.id, estado)}
                    onDelete={() => handleDelete(p.id)}
                    onMarkRead={(updateId) => markAsRead(p.id, updateId)}
                    onShowActuacionForm={() => setShowActuacionForm(!showActuacionForm)}
                    onActuacionDataChange={setActuacionData}
                    onActuacionSubmit={handleActuacionSubmit}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isPending && (
        <div className="fixed inset-0 bg-black/5 flex items-center justify-center z-50">
          <Loader2 className="w-8 h-8 text-[#0D2340] animate-spin" />
        </div>
      )}
    </div>
  );
}

/* ─── Fila de proceso ─────────────────────────────────────────────────── */

interface ProcessRowProps {
  proceso: Proceso;
  isExpanded: boolean;
  actuaciones: SgccProcessUpdate[];
  loadingActuaciones: boolean;
  showActuacionForm: boolean;
  actuacionData: { fecha_actuacion: string; tipo_actuacion: string; anotacion: string; detalles: string };
  actuacionSubmitting: boolean;
  onToggle: () => void;
  onEstado: (estado: WatchedProcessEstado) => void;
  onDelete: () => void;
  onMarkRead: (updateId: string) => void;
  onShowActuacionForm: () => void;
  onActuacionDataChange: (data: any) => void;
  onActuacionSubmit: (e: React.FormEvent) => void;
}

function ProcessRow({
  proceso: p,
  isExpanded,
  actuaciones,
  loadingActuaciones,
  showActuacionForm,
  actuacionData,
  actuacionSubmitting,
  onToggle,
  onEstado,
  onDelete,
  onMarkRead,
  onShowActuacionForm,
  onActuacionDataChange,
  onActuacionSubmit,
}: ProcessRowProps) {
  return (
    <>
      <tr className="hover:bg-gray-50/50 transition-colors">
        <td className="px-4 py-3">
          <span className="font-mono text-xs">{p.numero_proceso}</span>
          {p.actuaciones_no_leidas > 0 && (
            <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold">
              {p.actuaciones_no_leidas}
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-gray-600">{p.despacho || "—"}</td>
        <td className="px-4 py-3 text-gray-600">{p.ciudad || "—"}</td>
        <td className="px-4 py-3">
          {p.caso ? (
            <Link
              href={`/expediente/${p.caso.id}`}
              className="text-[#1B4F9B] hover:underline font-medium text-xs"
            >
              {p.caso.numero_radicado}
            </Link>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">
          {p.ultima_actuacion || "—"}
        </td>
        <td className="px-4 py-3 text-gray-500 text-xs">
          {formatDate(p.ultima_actuacion_fecha)}
        </td>
        <td className="px-4 py-3">
          <span
            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
              estadoColors[p.estado]
            }`}
          >
            {estadoLabels[p.estado]}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={onToggle}
              title="Ver actuaciones"
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-[#0D2340] transition-colors"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {p.estado === "activo" && (
              <button
                onClick={() => onEstado("terminado")}
                title="Marcar como terminado"
                className="p-1.5 rounded-lg hover:bg-green-50 text-gray-500 hover:text-green-600 transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
              </button>
            )}
            {p.estado !== "archivado" && (
              <button
                onClick={() => onEstado("archivado")}
                title="Archivar"
                className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-500 hover:text-amber-600 transition-colors"
              >
                <Archive className="w-4 h-4" />
              </button>
            )}
            {p.estado === "archivado" && (
              <button
                onClick={() => onEstado("activo")}
                title="Reactivar"
                className="p-1.5 rounded-lg hover:bg-green-50 text-gray-500 hover:text-green-600 transition-colors"
              >
                <Eye className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onDelete}
              title="Eliminar"
              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>

      {/* Panel expandido con actuaciones */}
      {isExpanded && (
        <tr>
          <td colSpan={8} className="px-4 py-0">
            <div className="bg-gray-50 rounded-lg p-4 my-2 border border-gray-100">
              {/* Header actuaciones */}
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-700">
                  Actuaciones del proceso
                </h4>
                <button
                  onClick={onShowActuacionForm}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0D2340] text-white rounded-lg text-xs font-medium hover:bg-[#0D2340]/90 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Registrar actuación
                </button>
              </div>

              {/* Formulario nueva actuación */}
              {showActuacionForm && (
                <form onSubmit={onActuacionSubmit} className="bg-white rounded-lg p-4 mb-3 border border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
                      <input
                        type="date"
                        value={actuacionData.fecha_actuacion}
                        onChange={(e) =>
                          onActuacionDataChange({ ...actuacionData, fecha_actuacion: e.target.value })
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#0D2340] focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Tipo de actuación
                      </label>
                      <input
                        type="text"
                        value={actuacionData.tipo_actuacion}
                        onChange={(e) =>
                          onActuacionDataChange({ ...actuacionData, tipo_actuacion: e.target.value })
                        }
                        placeholder="Ej: Auto, Sentencia, Memorial..."
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#0D2340] focus:border-transparent outline-none"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Anotación</label>
                      <input
                        type="text"
                        value={actuacionData.anotacion}
                        onChange={(e) =>
                          onActuacionDataChange({ ...actuacionData, anotacion: e.target.value })
                        }
                        placeholder="Resumen de la actuación..."
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#0D2340] focus:border-transparent outline-none"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Detalles (opcional)
                      </label>
                      <textarea
                        value={actuacionData.detalles}
                        onChange={(e) =>
                          onActuacionDataChange({ ...actuacionData, detalles: e.target.value })
                        }
                        rows={2}
                        placeholder="Detalles adicionales..."
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#0D2340] focus:border-transparent outline-none resize-none"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      type="submit"
                      disabled={actuacionSubmitting}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1B4F9B] text-white rounded-lg text-xs font-medium hover:bg-[#9a7209] disabled:opacity-50 transition-colors"
                    >
                      {actuacionSubmitting ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Plus className="w-3 h-3" />
                      )}
                      Guardar
                    </button>
                    <button
                      type="button"
                      onClick={onShowActuacionForm}
                      className="px-3 py-1.5 text-gray-500 text-xs hover:text-gray-700 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}

              {/* Lista de actuaciones */}
              {loadingActuaciones ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                </div>
              ) : actuaciones.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-sm">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  No hay actuaciones registradas
                </div>
              ) : (
                <div className="space-y-2">
                  {actuaciones.map((a) => (
                    <div
                      key={a.id}
                      className={`flex items-start justify-between gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
                        a.leida
                          ? "bg-white border-gray-100"
                          : "bg-amber-50/50 border-amber-200"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          {a.tipo_actuacion && (
                            <span className="inline-flex px-2 py-0.5 rounded bg-[#0D2340]/10 text-[#0D2340] text-[10px] font-semibold uppercase">
                              {a.tipo_actuacion}
                            </span>
                          )}
                          <span className="text-[10px] text-gray-400">
                            {formatDate(a.fecha_actuacion)}
                          </span>
                          {!a.leida && (
                            <span className="inline-flex px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-medium">
                              Nueva
                            </span>
                          )}
                        </div>
                        {a.anotacion && (
                          <p className="text-sm text-gray-700">{a.anotacion}</p>
                        )}
                        {a.detalles && (
                          <p className="text-xs text-gray-500 mt-0.5">{a.detalles}</p>
                        )}
                      </div>
                      {!a.leida && (
                        <button
                          onClick={() => onMarkRead(a.id)}
                          title="Marcar como leída"
                          className="flex-shrink-0 p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600 transition-colors"
                        >
                          <EyeOff className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Partes del proceso */}
              {p.partes_texto && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-500">
                    <span className="font-medium">Partes:</span> {p.partes_texto}
                  </p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
