"use client";
import { useState } from "react";
import { Upload, File as FileIcon, X } from "lucide-react";
import type { TipoAnexo } from "@/types/solicitudes";
import { TIPO_ANEXO_LABEL } from "@/lib/solicitudes/constants";

interface Adjunto {
  id: string;
  tipo_anexo: TipoAnexo;
  nombre_archivo: string;
  tamano_bytes: number;
  url: string;
}

export function FileUploadBox({
  draftId,
  tipoAnexo,
  obligatorio = false,
  adjuntos,
  onChange,
}: {
  draftId: string;
  tipoAnexo: TipoAnexo;
  obligatorio?: boolean;
  adjuntos: Adjunto[];
  onChange: (adjuntos: Adjunto[]) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const propios = adjuntos.filter((a) => a.tipo_anexo === tipoAnexo);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("tipo_anexo", tipoAnexo);
    const res = await fetch(`/api/partes/solicitudes/${draftId}/adjuntos`, {
      method: "POST",
      body: fd,
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Error al subir");
      return;
    }
    onChange([...adjuntos, data.adjunto]);
    e.target.value = "";
  }

  async function removeAdj(id: string) {
    const res = await fetch(
      `/api/partes/solicitudes/${draftId}/adjuntos/${id}`,
      { method: "DELETE" }
    );
    if (res.ok) onChange(adjuntos.filter((a) => a.id !== id));
  }

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-800">
          {TIPO_ANEXO_LABEL[tipoAnexo]}
          {obligatorio && <span className="text-red-600 ml-1">*</span>}
        </span>
        <label className="text-xs text-[#1B4F9B] cursor-pointer hover:underline flex items-center gap-1">
          <Upload className="w-3.5 h-3.5" />
          {loading ? "Subiendo…" : "Subir"}
          <input
            type="file"
            className="hidden"
            onChange={upload}
            accept=".pdf,.jpg,.jpeg,.png,.docx"
            disabled={loading}
          />
        </label>
      </div>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      {propios.length === 0 ? (
        <p className="text-xs text-gray-400">Sin archivos</p>
      ) : (
        <ul className="space-y-1">
          {propios.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1.5"
            >
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-gray-700 hover:text-[#1B4F9B]"
              >
                <FileIcon className="w-3.5 h-3.5" />
                {a.nombre_archivo}
                <span className="text-gray-400">
                  ({(a.tamano_bytes / 1024).toFixed(0)} KB)
                </span>
              </a>
              <button
                type="button"
                onClick={() => removeAdj(a.id)}
                className="text-red-600 hover:bg-red-50 rounded p-0.5"
                aria-label="Eliminar adjunto"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
