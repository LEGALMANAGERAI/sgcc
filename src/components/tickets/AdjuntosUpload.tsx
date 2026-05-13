// src/components/tickets/AdjuntosUpload.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, Loader2, AlertCircle, ClipboardPaste } from "lucide-react";

interface Props {
  endpoint: string;
  onUploaded: () => void;
  disabled?: boolean;
  maxFiles?: number;
}

const ACCEPT_INPUT = ".pdf,.jpg,.jpeg,.png,.webp";
const ACCEPT_MIMES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];
const MAX_BYTES = 10 * 1024 * 1024;

export function AdjuntosUpload({ endpoint, onUploaded, disabled, maxFiles = 5 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);

  function isValidFile(file: File): boolean {
    if (!ACCEPT_MIMES.includes(file.type)) return false;
    if (file.size > MAX_BYTES) return false;
    return true;
  }

  async function processFiles(files: File[]) {
    if (disabled || uploading) return;

    const validos = files.filter(isValidFile);
    if (validos.length === 0) {
      setError("Solo PDF, JPG, PNG o WebP hasta 10 MB cada uno");
      return;
    }
    if (validos.length > maxFiles) {
      setError(`Maximo ${maxFiles} archivos a la vez`);
      return;
    }

    setError("");
    setUploading(true);
    try {
      for (const file of validos) {
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
      setError("Error de conexion");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) processFiles(files);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || uploading) return;
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length > 0) processFiles(files);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (disabled || uploading) return;
    if (!isDragging) setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
  }

  // Paste con Ctrl+V: si el clipboard trae archivos validos los sube como
  // adjunto. Si es solo texto (sin archivos), no interfiere — deja que el
  // usuario pegue en el textarea normal.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      if (disabled || uploading) return;
      const files = Array.from(e.clipboardData?.files ?? []).filter(isValidFile);
      if (files.length === 0) return;
      e.preventDefault();
      processFiles(files);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, uploading, endpoint]);

  return (
    <div className="space-y-2">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-2 px-4 py-5 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
          isDragging
            ? "border-[#1B4F9B] bg-[#1B4F9B]/5"
            : "border-gray-300 hover:border-[#1B4F9B] hover:bg-gray-50"
        } ${disabled || uploading ? "opacity-60 cursor-not-allowed" : ""}`}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        {uploading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin text-[#1B4F9B]" />
            <p className="text-sm text-gray-600">Subiendo...</p>
          </>
        ) : (
          <>
            <Upload className="w-5 h-5 text-gray-400" />
            <p className="text-sm text-gray-700 font-medium">
              Click, arrastra o pega (Ctrl+V) tu archivo
            </p>
            <p className="text-xs text-gray-400 inline-flex items-center gap-1">
              <ClipboardPaste className="w-3 h-3" />
              PDF, JPG, PNG o WebP. Max 10 MB c/u, hasta {maxFiles}.
            </p>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_INPUT}
        multiple
        onChange={handleChange}
        className="hidden"
      />
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}
    </div>
  );
}
