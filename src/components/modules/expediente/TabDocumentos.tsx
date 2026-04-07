"use client";

import { useState } from "react";
import {
  FileText,
  Download,
  Eye,
  Upload,
  Filter,
  ChevronDown,
  ChevronUp,
  Mail,
  Loader2,
  X,
} from "lucide-react";

/* ─── Props ─────────────────────────────────────────────────────────────── */

interface TabDocumentosProps {
  caseId: string;
  documentos: any[];
  correspondencia: any[];
}

/* ─── Constantes ────────────────────────────────────────────────────────── */

const TIPO_DOC_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "solicitud", label: "Solicitud" },
  { value: "poder", label: "Poder" },
  { value: "prueba", label: "Prueba" },
  { value: "citacion", label: "Citación" },
  { value: "acta_borrador", label: "Acta borrador" },
  { value: "acta_firmada", label: "Acta firmada" },
  { value: "constancia", label: "Constancia" },
  { value: "admision", label: "Admisión" },
  { value: "rechazo", label: "Rechazo" },
  { value: "otro", label: "Otro" },
] as const;

const TIPO_BADGE_COLORS: Record<string, string> = {
  solicitud: "bg-yellow-100 text-yellow-800",
  poder: "bg-indigo-100 text-indigo-800",
  prueba: "bg-green-100 text-green-800",
  citacion: "bg-blue-100 text-blue-800",
  acta_borrador: "bg-purple-100 text-purple-800",
  acta_firmada: "bg-emerald-100 text-emerald-800",
  constancia: "bg-teal-100 text-teal-800",
  admision: "bg-cyan-100 text-cyan-800",
  rechazo: "bg-red-100 text-red-800",
  otro: "bg-gray-100 text-gray-600",
};

const CORR_ESTADO_COLORS: Record<string, string> = {
  recibido: "bg-blue-100 text-blue-800",
  en_tramite: "bg-yellow-100 text-yellow-800",
  respondido: "bg-green-100 text-green-800",
  vencido: "bg-red-100 text-red-800",
};

/* ─── Component ─────────────────────────────────────────────────────────── */

export function TabDocumentos({
  caseId,
  documentos,
  correspondencia,
}: TabDocumentosProps) {
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form state
  const [file, setFile] = useState<File | null>(null);
  const [tipoDoc, setTipoDoc] = useState("otro");
  const [nombreDoc, setNombreDoc] = useState("");

  // Filtrar documentos
  const filtered =
    filtroTipo === "todos"
      ? documentos
      : documentos.filter((d: any) => d.tipo === filtroTipo);

  // Upload handler
  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("tipo", tipoDoc);
      formData.append("nombre", nombreDoc || file.name);

      const res = await fetch(`/api/expediente/${caseId}/documentos`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Error al subir documento");
        return;
      }

      // Reset y reload
      setFile(null);
      setTipoDoc("otro");
      setNombreDoc("");
      setShowUpload(false);
      window.location.reload();
    } catch {
      alert("Error de conexión al subir documento");
    } finally {
      setUploading(false);
    }
  }

  function formatSize(bytes: number | null): string {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="space-y-6">
      {/* ── Controles superiores ──────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Filtro tipo */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B4F9B]/30 focus:border-[#1B4F9B]"
          >
            {TIPO_DOC_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-gray-400">
            {filtered.length} documento{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Botón subir */}
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="inline-flex items-center gap-2 bg-[#0D2340] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0d2340dd] transition-colors"
        >
          <Upload className="w-4 h-4" />
          Subir documento
          {showUpload ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* ── Form subir (expandible) ──────────────────────────────────── */}
      {showUpload && (
        <form
          onSubmit={handleUpload}
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-900 text-sm">
              Subir nuevo documento
            </h4>
            <button
              type="button"
              onClick={() => setShowUpload(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Archivo */}
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-1">
                Archivo *
              </label>
              <input
                type="file"
                required
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 file:mr-3 file:rounded-md file:border-0 file:bg-[#0D2340] file:text-white file:text-xs file:px-3 file:py-1 file:cursor-pointer"
              />
            </div>

            {/* Tipo */}
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-1">
                Tipo de documento
              </label>
              <select
                value={tipoDoc}
                onChange={(e) => setTipoDoc(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B4F9B]/30 focus:border-[#1B4F9B]"
              >
                {TIPO_DOC_OPTIONS.filter((o) => o.value !== "todos").map(
                  (opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  )
                )}
              </select>
            </div>

            {/* Nombre */}
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-1">
                Nombre / descripción
              </label>
              <input
                type="text"
                value={nombreDoc}
                onChange={(e) => setNombreDoc(e.target.value)}
                placeholder="Opcional"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B4F9B]/30 focus:border-[#1B4F9B]"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={uploading || !file}
              className="inline-flex items-center gap-2 bg-[#1B4F9B] text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-[#a07509] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Subiendo...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Subir
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ── Tabla de documentos ───────────────────────────────────────── */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Fecha
                </th>
                <th className="px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Tamaño
                </th>
                <th className="px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider text-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-8 text-center text-gray-400"
                  >
                    No hay documentos
                    {filtroTipo !== "todos" ? " con este filtro" : ""}
                  </td>
                </tr>
              ) : (
                filtered.map((doc: any) => {
                  const badgeColor =
                    TIPO_BADGE_COLORS[doc.tipo] ?? TIPO_BADGE_COLORS.otro;

                  return (
                    <tr
                      key={doc.id}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="font-medium text-gray-900 truncate max-w-[250px]">
                            {doc.nombre}
                          </span>
                        </div>
                        {doc.descripcion && (
                          <p className="text-xs text-gray-400 mt-0.5 pl-6">
                            {doc.descripcion}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${badgeColor}`}
                        >
                          {doc.tipo.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-gray-600 text-xs">
                        {new Date(doc.created_at).toLocaleDateString("es-CO", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-3 py-3 text-gray-500 text-xs">
                        {formatSize(doc.tamano_bytes)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {doc.url && (
                            <>
                              <a
                                href={doc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-[#0D2340] transition-colors"
                                title="Ver documento"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </a>
                              <a
                                href={doc.url}
                                download
                                className="inline-flex items-center gap-1 text-xs text-[#1B4F9B] hover:text-[#a07509] transition-colors"
                                title="Descargar"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Correspondencia vinculada ─────────────────────────────────── */}
      {correspondencia.length > 0 && (
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-[#0D2340] mb-4 text-base flex items-center gap-2">
            <Mail className="w-4.5 h-4.5 text-[#1B4F9B]" />
            Correspondencia vinculada
          </h3>
          <div className="space-y-3">
            {correspondencia.map((c: any) => {
              const estadoColor =
                CORR_ESTADO_COLORS[c.estado] ?? "bg-gray-100 text-gray-600";

              return (
                <div
                  key={c.id}
                  className="flex items-start justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${estadoColor}`}
                      >
                        {c.estado.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs text-gray-500 capitalize">
                        {c.tipo.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-900">
                      {c.asunto}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      De: {c.remitente} — Para: {c.destinatario}
                    </p>
                    {c.responsable && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Responsable: {c.responsable.nombre}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-500">
                      {new Date(c.fecha_radicacion).toLocaleDateString("es-CO", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                    {c.fecha_limite_respuesta && (
                      <p
                        className={`text-xs mt-0.5 ${
                          new Date(c.fecha_limite_respuesta) < new Date()
                            ? "text-red-600 font-medium"
                            : "text-gray-400"
                        }`}
                      >
                        Límite:{" "}
                        {new Date(c.fecha_limite_respuesta).toLocaleDateString(
                          "es-CO",
                          { day: "numeric", month: "short" }
                        )}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
