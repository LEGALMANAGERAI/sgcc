"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Loader2,
  AlertCircle,
  Mail,
  Upload,
  ChevronDown,
  FileText,
} from "lucide-react";
import type { CorrespondenciaTipo, CorrespondenciaEstado } from "@/types";

/* ─── Tipos ─────────────────────────────────────────────────────────────── */

interface CorrespondenciaItem {
  id: string;
  center_id: string;
  case_id: string | null;
  tipo: CorrespondenciaTipo;
  asunto: string;
  remitente: string;
  destinatario: string;
  fecha_radicacion: string;
  fecha_limite_respuesta: string | null;
  estado: CorrespondenciaEstado;
  responsable_staff_id: string | null;
  notas: string | null;
  created_at: string;
  responsable?: { id: string; nombre: string } | null;
  caso?: { id: string; numero_radicado: string } | null;
  docs_count: number;
}

interface Caso {
  id: string;
  numero_radicado: string;
  materia: string;
  estado: string;
}

interface Staff {
  id: string;
  nombre: string;
  rol: string;
}

interface Props {
  correspondencia: CorrespondenciaItem[];
  casos: Caso[];
  staff: Staff[];
  tipoFiltro: string;
  estadoFiltro: string;
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */

const tipoLabels: Record<CorrespondenciaTipo, string> = {
  tutela: "Tutela",
  derecho_peticion: "D. Peticion",
  requerimiento: "Requerimiento",
  oficio: "Oficio",
};

const tipoBadgeColors: Record<CorrespondenciaTipo, string> = {
  tutela: "bg-red-100 text-red-800",
  derecho_peticion: "bg-blue-100 text-blue-800",
  requerimiento: "bg-purple-100 text-purple-800",
  oficio: "bg-gray-100 text-gray-800",
};

const estadoLabels: Record<CorrespondenciaEstado, string> = {
  recibido: "Recibido",
  en_tramite: "En tramite",
  respondido: "Respondido",
  vencido: "Vencido",
};

const estadoBadgeColors: Record<CorrespondenciaEstado, string> = {
  recibido: "bg-blue-100 text-blue-800",
  en_tramite: "bg-amber-100 text-amber-800",
  respondido: "bg-green-100 text-green-800",
  vencido: "bg-red-100 text-red-800",
};

function formatDate(d: string | null) {
  if (!d) return "\u2014";
  return new Date(d).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function calcDiasRestantes(fechaLimite: string | null, estado: CorrespondenciaEstado): { texto: string; color: string } {
  if (estado === "respondido") return { texto: "\u2014", color: "text-gray-400" };
  if (!fechaLimite) return { texto: "Sin limite", color: "text-gray-400" };

  const now = new Date();
  const limite = new Date(fechaLimite);
  const diffMs = limite.getTime() - now.getTime();
  const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDias < 0) return { texto: `Vencido (${Math.abs(diffDias)}d)`, color: "text-red-600 font-semibold" };
  if (diffDias < 2) return { texto: `${diffDias}d`, color: "text-red-600 font-semibold" };
  if (diffDias < 5) return { texto: `${diffDias}d`, color: "text-amber-600 font-medium" };
  return { texto: `${diffDias}d`, color: "text-green-600" };
}

function todayISO() {
  const d = new Date();
  return d.toISOString().split("T")[0];
}

/* ─── Componente principal ──────────────────────────────────────────────── */

export function CorrespondenciaClient({
  correspondencia,
  casos,
  staff,
  tipoFiltro,
  estadoFiltro,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    tipo: "tutela" as CorrespondenciaTipo,
    asunto: "",
    remitente: "",
    destinatario: "",
    fecha_radicacion: todayISO(),
    fecha_limite_respuesta: "",
    case_id: "",
    responsable_staff_id: "",
    notas: "",
  });
  const [archivo, setArchivo] = useState<File | null>(null);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Estado dropdown por fila
  const [changingEstado, setChangingEstado] = useState<string | null>(null);

  // Upload respuesta por fila
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTipo, setUploadTipo] = useState<"escrito_recibido" | "respuesta" | "anexo">("respuesta");
  const [uploadSubmitting, setUploadSubmitting] = useState(false);

  /* ─── Determinar si el campo fecha limite es manual ───────────────── */

  const fechaLimiteManual = formData.tipo === "requerimiento";
  const sinFechaLimite = formData.tipo === "oficio";

  /* ─── Filtros ──────────────────────────────────────────────────────── */

  function handleFiltro(tipo: string, estado: string) {
    const params = new URLSearchParams();
    if (tipo !== "todos") params.set("tipo", tipo);
    if (estado !== "todos") params.set("estado", estado);
    const url = params.toString() ? `/correspondencia?${params}` : "/correspondencia";
    startTransition(() => router.push(url));
  }

  /* ─── Submit nueva correspondencia ─────────────────────────────────── */

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!formData.asunto.trim()) {
      setFormError("El asunto es requerido");
      return;
    }
    if (!formData.remitente.trim()) {
      setFormError("El remitente es requerido");
      return;
    }
    if (!formData.destinatario.trim()) {
      setFormError("El destinatario es requerido");
      return;
    }
    if (fechaLimiteManual && !formData.fecha_limite_respuesta) {
      setFormError("Para requerimientos, la fecha limite es obligatoria");
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("tipo", formData.tipo);
      fd.append("asunto", formData.asunto);
      fd.append("remitente", formData.remitente);
      fd.append("destinatario", formData.destinatario);
      fd.append("fecha_radicacion", formData.fecha_radicacion);
      if (fechaLimiteManual && formData.fecha_limite_respuesta) {
        fd.append("fecha_limite_respuesta", formData.fecha_limite_respuesta);
      }
      if (formData.case_id) fd.append("case_id", formData.case_id);
      if (formData.responsable_staff_id) fd.append("responsable_staff_id", formData.responsable_staff_id);
      if (formData.notas) fd.append("notas", formData.notas);
      if (archivo) fd.append("archivo", archivo);

      const res = await fetch("/api/correspondencia", {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const err = await res.json();
        setFormError(err.error || "Error al registrar correspondencia");
        return;
      }

      // Reset
      setFormData({
        tipo: "tutela",
        asunto: "",
        remitente: "",
        destinatario: "",
        fecha_radicacion: todayISO(),
        fecha_limite_respuesta: "",
        case_id: "",
        responsable_staff_id: "",
        notas: "",
      });
      setArchivo(null);
      setShowForm(false);
      startTransition(() => router.refresh());
    } catch {
      setFormError("Error de conexion");
    } finally {
      setSubmitting(false);
    }
  }

  /* ─── Cambiar estado ───────────────────────────────────────────────── */

  async function handleCambiarEstado(id: string, nuevoEstado: CorrespondenciaEstado) {
    try {
      const res = await fetch(`/api/correspondencia/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      if (res.ok) {
        setChangingEstado(null);
        startTransition(() => router.refresh());
      }
    } catch {
      /* silenciar */
    }
  }

  /* ─── Subir documento ──────────────────────────────────────────────── */

  async function handleUploadDoc(corrId: string) {
    if (!uploadFile) return;
    setUploadSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("archivo", uploadFile);
      fd.append("tipo", uploadTipo);

      const res = await fetch(`/api/correspondencia/${corrId}/documentos`, {
        method: "POST",
        body: fd,
      });
      if (res.ok) {
        setUploadingId(null);
        setUploadFile(null);
        setUploadTipo("respuesta");
        startTransition(() => router.refresh());
      }
    } catch {
      /* silenciar */
    } finally {
      setUploadSubmitting(false);
    }
  }

  /* ─── Render ───────────────────────────────────────────────────────── */

  return (
    <div>
      {/* Filtros y boton agregar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-2">
          {/* Filtro por tipo */}
          <div className="flex gap-1">
            {(["todos", "tutela", "derecho_peticion", "requerimiento", "oficio"] as const).map((t) => (
              <button
                key={t}
                onClick={() => handleFiltro(t, estadoFiltro)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  tipoFiltro === t
                    ? "bg-[#0D2340] text-white"
                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                }`}
              >
                {t === "todos" ? "Todos" : tipoLabels[t as CorrespondenciaTipo] ?? t}
              </button>
            ))}
          </div>
          {/* Filtro por estado */}
          <div className="flex gap-1">
            {(["todos", "recibido", "en_tramite", "respondido", "vencido"] as const).map((e) => (
              <button
                key={e}
                onClick={() => handleFiltro(tipoFiltro, e)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  estadoFiltro === e
                    ? "bg-[#B8860B] text-white"
                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                }`}
              >
                {e === "todos" ? "Todos" : estadoLabels[e as CorrespondenciaEstado] ?? e}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-[#0D2340] text-white rounded-lg text-sm font-medium hover:bg-[#0D2340]/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva correspondencia
        </button>
      </div>

      {/* Formulario inline */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-gray-200 rounded-xl p-5 mb-4 shadow-sm"
        >
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Registrar nueva correspondencia
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Tipo */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Tipo <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.tipo}
                onChange={(e) =>
                  setFormData({ ...formData, tipo: e.target.value as CorrespondenciaTipo, fecha_limite_respuesta: "" })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0D2340] focus:border-transparent outline-none"
              >
                <option value="tutela">Tutela</option>
                <option value="derecho_peticion">Derecho de peticion</option>
                <option value="requerimiento">Requerimiento</option>
                <option value="oficio">Oficio</option>
              </select>
            </div>

            {/* Asunto */}
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Asunto <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.asunto}
                onChange={(e) => setFormData({ ...formData, asunto: e.target.value })}
                placeholder="Descripcion breve del asunto"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0D2340] focus:border-transparent outline-none"
              />
            </div>

            {/* Remitente */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Remitente <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.remitente}
                onChange={(e) => setFormData({ ...formData, remitente: e.target.value })}
                placeholder="Quien envia"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0D2340] focus:border-transparent outline-none"
              />
            </div>

            {/* Destinatario */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Destinatario <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.destinatario}
                onChange={(e) => setFormData({ ...formData, destinatario: e.target.value })}
                placeholder="A quien va dirigido"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0D2340] focus:border-transparent outline-none"
              />
            </div>

            {/* Fecha radicacion */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Fecha de radicacion
              </label>
              <input
                type="date"
                value={formData.fecha_radicacion}
                onChange={(e) => setFormData({ ...formData, fecha_radicacion: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0D2340] focus:border-transparent outline-none"
              />
            </div>

            {/* Fecha limite (solo para requerimiento) */}
            {fechaLimiteManual && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Fecha limite respuesta <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.fecha_limite_respuesta}
                  onChange={(e) => setFormData({ ...formData, fecha_limite_respuesta: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0D2340] focus:border-transparent outline-none"
                />
              </div>
            )}

            {/* Info de calculo automatico */}
            {formData.tipo === "tutela" && (
              <div className="flex items-center">
                <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  Limite: 48 horas (2 dias calendario) desde radicacion
                </p>
              </div>
            )}
            {formData.tipo === "derecho_peticion" && (
              <div className="flex items-center">
                <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
                  Limite: 15 dias habiles desde radicacion
                </p>
              </div>
            )}
            {sinFechaLimite && (
              <div className="flex items-center">
                <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                  Oficios no tienen fecha limite
                </p>
              </div>
            )}

            {/* Caso vinculado */}
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

            {/* Responsable */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Responsable
              </label>
              <select
                value={formData.responsable_staff_id}
                onChange={(e) => setFormData({ ...formData, responsable_staff_id: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0D2340] focus:border-transparent outline-none"
              >
                <option value="">Sin asignar</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre} ({s.rol})
                  </option>
                ))}
              </select>
            </div>

            {/* Notas */}
            <div className="lg:col-span-3 md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Notas
              </label>
              <textarea
                value={formData.notas}
                onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                rows={2}
                placeholder="Observaciones adicionales..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0D2340] focus:border-transparent outline-none resize-none"
              />
            </div>

            {/* Archivo adjunto */}
            <div className="lg:col-span-3 md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Adjuntar documento (opcional)
              </label>
              <input
                type="file"
                onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-[#0D2340] file:text-white hover:file:bg-[#0D2340]/90"
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
              Registrar
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

      {/* Tabla principal */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {correspondencia.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Mail className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No hay correspondencia registrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Asunto</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Remitente</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Destinatario</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Caso</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Radicacion</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Limite</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Dias</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Responsable</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {correspondencia.map((c) => {
                  const dias = calcDiasRestantes(c.fecha_limite_respuesta, c.estado);
                  return (
                    <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                      {/* Tipo badge */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            tipoBadgeColors[c.tipo]
                          }`}
                        >
                          {tipoLabels[c.tipo]}
                        </span>
                      </td>

                      {/* Asunto */}
                      <td className="px-4 py-3 max-w-[200px]">
                        <span className="font-medium text-gray-900 truncate block">{c.asunto}</span>
                        {c.docs_count > 0 && (
                          <span className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                            <FileText className="w-3 h-3" /> {c.docs_count} doc{c.docs_count > 1 ? "s" : ""}
                          </span>
                        )}
                      </td>

                      {/* Remitente */}
                      <td className="px-4 py-3 text-gray-600">{c.remitente}</td>

                      {/* Destinatario */}
                      <td className="px-4 py-3 text-gray-600">{c.destinatario}</td>

                      {/* Caso vinculado */}
                      <td className="px-4 py-3">
                        {c.caso ? (
                          <Link
                            href={`/expediente/${c.caso.id}`}
                            className="text-[#1B4F9B] hover:underline font-medium text-xs"
                          >
                            {c.caso.numero_radicado}
                          </Link>
                        ) : (
                          <span className="text-gray-400">{"\u2014"}</span>
                        )}
                      </td>

                      {/* Fecha radicacion */}
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {formatDate(c.fecha_radicacion)}
                      </td>

                      {/* Fecha limite */}
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {formatDate(c.fecha_limite_respuesta)}
                      </td>

                      {/* Dias restantes */}
                      <td className="px-4 py-3">
                        <span className={`text-xs ${dias.color}`}>{dias.texto}</span>
                      </td>

                      {/* Estado */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            estadoBadgeColors[c.estado]
                          }`}
                        >
                          {estadoLabels[c.estado]}
                        </span>
                      </td>

                      {/* Responsable */}
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {c.responsable?.nombre ?? "\u2014"}
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1 relative">
                          {/* Cambiar estado */}
                          {c.estado !== "respondido" && c.estado !== "vencido" && (
                            <div className="relative">
                              <button
                                onClick={() =>
                                  setChangingEstado(changingEstado === c.id ? null : c.id)
                                }
                                title="Cambiar estado"
                                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-[#0D2340] transition-colors"
                              >
                                <ChevronDown className="w-4 h-4" />
                              </button>
                              {changingEstado === c.id && (
                                <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 min-w-[140px]">
                                  {c.estado === "recibido" && (
                                    <>
                                      <button
                                        onClick={() => handleCambiarEstado(c.id, "en_tramite")}
                                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 text-gray-700"
                                      >
                                        En tramite
                                      </button>
                                      <button
                                        onClick={() => handleCambiarEstado(c.id, "respondido")}
                                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 text-gray-700"
                                      >
                                        Respondido
                                      </button>
                                    </>
                                  )}
                                  {c.estado === "en_tramite" && (
                                    <button
                                      onClick={() => handleCambiarEstado(c.id, "respondido")}
                                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 text-gray-700"
                                    >
                                      Respondido
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Subir documento */}
                          <div className="relative">
                            <button
                              onClick={() =>
                                setUploadingId(uploadingId === c.id ? null : c.id)
                              }
                              title="Subir documento"
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-500 hover:text-blue-600 transition-colors"
                            >
                              <Upload className="w-4 h-4" />
                            </button>
                            {uploadingId === c.id && (
                              <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-10 min-w-[220px]">
                                <select
                                  value={uploadTipo}
                                  onChange={(e) => setUploadTipo(e.target.value as any)}
                                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs mb-2 focus:ring-2 focus:ring-[#0D2340] focus:border-transparent outline-none"
                                >
                                  <option value="escrito_recibido">Escrito recibido</option>
                                  <option value="respuesta">Respuesta</option>
                                  <option value="anexo">Anexo</option>
                                </select>
                                <input
                                  type="file"
                                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                                  className="w-full text-xs mb-2"
                                />
                                <button
                                  onClick={() => handleUploadDoc(c.id)}
                                  disabled={!uploadFile || uploadSubmitting}
                                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#0D2340] text-white rounded-lg text-xs font-medium hover:bg-[#0D2340]/90 disabled:opacity-50 transition-colors"
                                >
                                  {uploadSubmitting ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Upload className="w-3 h-3" />
                                  )}
                                  Subir
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
