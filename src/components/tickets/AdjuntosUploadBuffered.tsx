// src/components/tickets/AdjuntosUploadBuffered.tsx
// Variante de AdjuntosUpload para formularios de CREACIÓN de ticket: en vez
// de subir cada archivo al instante (requiere ticket.id que aún no existe),
// acumula los archivos en estado controlado por el padre. El padre los sube
// despues de crear el ticket usando el endpoint que corresponda.
"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, AlertCircle, ClipboardPaste, X, Paperclip } from "lucide-react";

interface Props {
  value: File[];
  onChange: (files: File[]) => void;
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AdjuntosUploadBuffered({
  value,
  onChange,
  disabled,
  maxFiles = 5,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  function isValidFile(file: File): boolean {
    if (!ACCEPT_MIMES.includes(file.type)) return false;
    if (file.size > MAX_BYTES) return false;
    return true;
  }

  function addFiles(incoming: File[]) {
    if (disabled) return;

    const validos = incoming.filter(isValidFile);
    if (validos.length === 0) {
      setError("Solo PDF, JPG, PNG o WebP hasta 10 MB cada uno");
      return;
    }

    const espacio = maxFiles - value.length;
    if (espacio <= 0) {
      setError(`Máximo ${maxFiles} archivos`);
      return;
    }

    setError("");
    onChange([...value, ...validos.slice(0, espacio)]);
    if (validos.length > espacio) {
      setError(`Solo se agregaron ${espacio}: máximo ${maxFiles} archivos`);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) addFiles(files);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length > 0) addFiles(files);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (disabled) return;
    if (!isDragging) setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
  }

  function removeAt(index: number) {
    const next = value.slice();
    next.splice(index, 1);
    onChange(next);
    setError("");
  }

  // Paste con Ctrl+V: si el clipboard trae archivos válidos los agrega a la
  // lista. Si es solo texto, no interfiere — deja que el usuario pegue en
  // el textarea normal.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      if (disabled) return;
      const files = Array.from(e.clipboardData?.files ?? []).filter(isValidFile);
      if (files.length === 0) return;
      e.preventDefault();
      addFiles(files);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, value, maxFiles]);

  const espacioRestante = maxFiles - value.length;
  const lleno = espacioRestante <= 0;

  return (
    <div className="space-y-2">
      {!lleno && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-2 px-4 py-5 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
            isDragging
              ? "border-[#1B4F9B] bg-[#1B4F9B]/5"
              : "border-gray-300 hover:border-[#1B4F9B] hover:bg-gray-50"
          } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
        >
          <Upload className="w-5 h-5 text-gray-400" />
          <p className="text-sm text-gray-700 font-medium">
            Click, arrastra o pega (Ctrl+V) tu archivo
          </p>
          <p className="text-xs text-gray-400 inline-flex items-center gap-1">
            <ClipboardPaste className="w-3 h-3" />
            PDF, JPG, PNG o WebP. Max 10 MB c/u, hasta {maxFiles}.
          </p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_INPUT}
        multiple
        onChange={handleChange}
        className="hidden"
      />

      {value.length > 0 && (
        <ul className="space-y-1">
          {value.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center justify-between gap-2 text-sm bg-white border border-gray-200 rounded-lg px-3 py-2"
            >
              <span className="flex items-center gap-2 text-gray-700 truncate">
                <Paperclip className="w-4 h-4 shrink-0 text-gray-400" />
                <span className="truncate">{f.name}</span>
                <span className="text-xs text-gray-400 shrink-0">
                  {formatBytes(f.size)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => removeAt(i)}
                disabled={disabled}
                className="text-gray-400 hover:text-red-600 shrink-0"
                aria-label="Quitar archivo"
              >
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}
    </div>
  );
}
