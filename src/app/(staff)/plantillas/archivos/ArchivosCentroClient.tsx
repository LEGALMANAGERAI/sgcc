"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Upload, Trash2, FileText, X } from "lucide-react";

export interface ArchivoCentro {
  id: string;
  nombre: string;
  descripcion: string | null;
  url: string;
  mime_type: string;
  tamano_bytes: number;
  created_at: string;
  uploader: { id: string; nombre: string } | null;
}

interface Props {
  archivosIniciales: ArchivoCentro[];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ArchivosCentroClient({ archivosIniciales }: Props) {
  const router = useRouter();
  const [archivos, setArchivos] = useState<ArchivoCentro[]>(archivosIniciales);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");

  async function subir(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!file) {
      setError("Selecciona un archivo");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (nombre.trim()) fd.append("nombre", nombre.trim());
      if (descripcion.trim()) fd.append("descripcion", descripcion.trim());

      const res = await fetch("/api/plantillas/archivos", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Error al subir el archivo");
        return;
      }
      setArchivos((prev) => [data, ...prev]);
      setFile(null);
      setNombre("");
      setDescripcion("");
      if (fileRef.current) fileRef.current.value = "";
      setShowUpload(false);
      router.refresh();
    } catch {
      setError("Error de conexión");
    } finally {
      setUploading(false);
    }
  }

  async function eliminar(id: string, nombreArchivo: string) {
    if (!confirm(`¿Eliminar "${nombreArchivo}"? Los conciliadores ya no podrán descargarlo.`)) return;
    setEliminandoId(id);
    try {
      const res = await fetch(`/api/plantillas/archivos/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Error al eliminar");
        return;
      }
      setArchivos((prev) => prev.filter((a) => a.id !== id));
    } catch {
      alert("Error de conexión");
    } finally {
      setEliminandoId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-gray-600">
          {archivos.length} archivo{archivos.length === 1 ? "" : "s"} disponible
          {archivos.length === 1 ? "" : "s"}
        </p>
        <button
          onClick={() => setShowUpload((v) => !v)}
          className="inline-flex items-center gap-2 bg-[#0D2340] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0d2340dd]"
        >
          <Upload className="w-4 h-4" />
          Subir archivo
        </button>
      </div>

      {showUpload && (
        <form
          onSubmit={subir}
          className="bg-white border border-gray-200 rounded-xl p-5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-900">Subir nuevo archivo</h4>
            <button
              type="button"
              onClick={() => setShowUpload(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-1">
                Archivo *
              </label>
              <input
                ref={fileRef}
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 file:mr-3 file:rounded-md file:border-0 file:bg-[#0D2340] file:text-white file:text-xs file:px-3 file:py-1 file:cursor-pointer"
              />
              <p className="text-[10px] text-gray-400 mt-1">Máx 20 MB. Cualquier tipo.</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-1">
                Nombre (opcional)
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder={file?.name ?? "Ej: Formato citación interna"}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1B4F9B]/30"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-1">
                Descripción (opcional)
              </label>
              <input
                type="text"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Para qué sirve"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1B4F9B]/30"
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={uploading || !file}
              className="inline-flex items-center gap-2 bg-[#1B4F9B] text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-[#164080] disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Subir
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-left text-xs text-gray-600">
              <th className="px-4 py-2.5 font-semibold">Nombre</th>
              <th className="px-4 py-2.5 font-semibold">Descripción</th>
              <th className="px-4 py-2.5 font-semibold">Tamaño</th>
              <th className="px-4 py-2.5 font-semibold">Subido por</th>
              <th className="px-4 py-2.5 font-semibold">Fecha</th>
              <th className="px-4 py-2.5 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {archivos.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                  No hay archivos del centro. Sube el primero con el botón de arriba.
                </td>
              </tr>
            ) : (
              archivos.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="font-medium text-gray-900 truncate max-w-[280px]">
                        {a.nombre}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 max-w-[260px] truncate">
                    {a.descripcion ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">
                    {formatBytes(a.tamano_bytes)}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 text-xs">
                    {a.uploader?.nombre ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 text-xs">
                    {new Date(a.created_at).toLocaleDateString("es-CO", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <a
                        href={a.url}
                        download={a.nombre}
                        className="inline-flex items-center gap-1 text-xs text-[#1B4F9B] hover:bg-[#1B4F9B]/10 px-2 py-1 rounded"
                        title="Descargar"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Descargar
                      </a>
                      <button
                        onClick={() => eliminar(a.id, a.nombre)}
                        disabled={eliminandoId === a.id}
                        className="inline-flex items-center gap-1 text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded disabled:opacity-50"
                        title="Eliminar archivo"
                      >
                        {eliminandoId === a.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
