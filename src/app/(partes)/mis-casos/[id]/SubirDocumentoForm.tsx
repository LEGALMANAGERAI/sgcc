"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, AlertCircle, CheckCircle, X } from "lucide-react";

interface Props {
  caseId: string;
}

const TIPOS = [
  { value: "poder", label: "Poder" },
  { value: "prueba", label: "Prueba" },
  { value: "otro", label: "Otro documento" },
];

export function SubirDocumentoForm({ caseId }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [show, setShow] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [tipo, setTipo] = useState("prueba");
  const [nombre, setNombre] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  function reset() {
    setFile(null);
    setNombre("");
    setTipo("prueba");
    setError("");
    setSuccess(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Seleccione un archivo");
      return;
    }

    setError("");
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("case_id", caseId);
      formData.append("tipo", tipo);
      if (nombre.trim()) formData.append("nombre", nombre.trim());

      const res = await fetch("/api/partes/documentos", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Error al subir el documento");
        return;
      }

      setSuccess(true);
      reset();
      setTimeout(() => {
        setSuccess(false);
        setShow(false);
        router.refresh();
      }, 2000);
    } catch {
      setError("Error de conexión");
    } finally {
      setUploading(false);
    }
  }

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="flex items-center gap-2 px-4 py-2 bg-[#1B4F9B] text-white rounded-lg text-sm font-medium hover:bg-[#1B4F9B]/90 transition-colors"
      >
        <Upload className="w-4 h-4" />
        Subir documento
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#0D2340]">
          Subir documento al expediente
        </h3>
        <button
          type="button"
          onClick={() => { setShow(false); reset(); }}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Tipo de documento <span className="text-red-500">*</span>
          </label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1B4F9B]/30 focus:border-[#1B4F9B] outline-none"
          >
            {TIPOS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Nombre del documento
          </label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Poder especial de representación"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1B4F9B]/30 focus:border-[#1B4F9B] outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Archivo <span className="text-red-500">*</span>
        </label>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#0D2340] file:text-white hover:file:bg-[#0D2340]/90 file:cursor-pointer"
        />
        <p className="text-[10px] text-gray-400 mt-1">
          Formatos: PDF, JPG, PNG, WebP. Máximo 10MB.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          Documento subido exitosamente
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={uploading}
          className="flex items-center gap-2 px-4 py-2 bg-[#0D2340] text-white rounded-lg text-sm font-medium hover:bg-[#0D2340]/90 disabled:opacity-50 transition-colors"
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          {uploading ? "Subiendo..." : "Subir"}
        </button>
        <button
          type="button"
          onClick={() => { setShow(false); reset(); }}
          className="px-4 py-2 text-gray-600 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
