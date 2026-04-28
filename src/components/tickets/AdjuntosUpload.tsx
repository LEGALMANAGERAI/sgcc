// src/components/tickets/AdjuntosUpload.tsx
"use client";

import { useRef, useState } from "react";
import { Upload, Loader2, AlertCircle } from "lucide-react";

interface Props {
  endpoint: string;       // ej: /api/partes/tickets/abc/adjuntos
  onUploaded: () => void; // callback al terminar (refresca lista)
  disabled?: boolean;
  maxFiles?: number;      // default 5
}

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp";

export function AdjuntosUpload({ endpoint, onUploaded, disabled, maxFiles = 5 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>("");

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    if (files.length > maxFiles) {
      setError(`Máximo ${maxFiles} archivos a la vez`);
      return;
    }

    setError("");
    setUploading(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(endpoint, { method: "POST", body: fd });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? `Error subiendo ${file.name}`);
          break;
        }
      }
      onUploaded();
    } catch {
      setError("Error de conexión");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading || disabled}
        className="flex items-center gap-2 px-4 py-2 bg-[#0D2340] text-white rounded-lg text-sm font-medium hover:bg-[#0D2340]/90 disabled:opacity-50 transition-colors"
      >
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {uploading ? "Subiendo..." : "Adjuntar archivo"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        onChange={handleChange}
        className="hidden"
      />
      <p className="text-xs text-gray-400">PDF, JPG, PNG o WebP. Máx 10 MB c/u, hasta {maxFiles}.</p>
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}
    </div>
  );
}
