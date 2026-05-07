"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Upload, Loader2 } from "lucide-react";

interface PoderItem {
  caseAttorneyId: string;
  url: string | null;
  radicado: string;
  activo: boolean;
}

interface Props {
  poderes: PoderItem[];
}

export function PoderesButton({ poderes }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [subiendo, setSubiendo] = useState<string | null>(null); // caseAttorneyId que está subiendo
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!poderes.length) return null;

  async function subir(caseAttorneyId: string, file: File) {
    setError(null);
    setSubiendo(caseAttorneyId);
    try {
      const fd = new FormData();
      fd.append("poderFile", file);
      const res = await fetch(`/api/apoderados-poder/${caseAttorneyId}`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al subir el PDF");
      }
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Error");
    } finally {
      setSubiendo(null);
    }
  }

  const conPoder = poderes.filter((p) => p.url);
  const sinPoder = poderes.filter((p) => !p.url);

  // Caso simple: solo 1 case_attorney
  if (poderes.length === 1) {
    const p = poderes[0];
    if (p.url) {
      return (
        <a
          href={p.url}
          target="_blank"
          rel="noopener noreferrer"
          title={`Ver poder (${p.radicado})`}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-[#1B4F9B]/10 text-[#1B4F9B] hover:bg-[#1B4F9B]/20 transition-colors"
        >
          <Paperclip className="w-3.5 h-3.5" />
          Poder
        </a>
      );
    }
    return (
      <div ref={containerRef} className="inline-block">
        <button
          type="button"
          disabled={subiendo === p.caseAttorneyId}
          onClick={() => fileInputs.current[p.caseAttorneyId]?.click()}
          title={`Subir poder para ${p.radicado}`}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-60"
        >
          {subiendo === p.caseAttorneyId ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Upload className="w-3.5 h-3.5" />
          )}
          Subir
        </button>
        <input
          ref={(el) => {
            fileInputs.current[p.caseAttorneyId] = el;
          }}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) subir(p.caseAttorneyId, f);
            e.target.value = "";
          }}
        />
        {error && <p className="text-[10px] text-red-600 mt-1">{error}</p>}
      </div>
    );
  }

  // Varios case_attorneys: popover con la lista (cada uno permite ver/subir)
  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
          sinPoder.length > 0
            ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
            : "bg-[#1B4F9B]/10 text-[#1B4F9B] hover:bg-[#1B4F9B]/20"
        }`}
      >
        <Paperclip className="w-3.5 h-3.5" />
        Poderes ({conPoder.length}/{poderes.length})
      </button>
      {open && (
        <div className="absolute z-20 mt-1 right-0 w-72 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <div className="px-3 py-2 text-[11px] uppercase tracking-[0.1em] text-gray-500 bg-gray-50 border-b border-gray-100 font-semibold">
            Poderes registrados
          </div>
          <ul className="max-h-72 overflow-y-auto">
            {poderes.map((p) => (
              <li key={p.caseAttorneyId} className="border-b border-gray-50 last:border-b-0">
                <div className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-gray-50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs text-gray-700 truncate">{p.radicado}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                          p.activo
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {p.activo ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                  </div>
                  {p.url ? (
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setOpen(false)}
                      className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-[#1B4F9B]/10 text-[#1B4F9B] hover:bg-[#1B4F9B]/20"
                    >
                      <Paperclip className="w-3 h-3" />
                      Ver
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled={subiendo === p.caseAttorneyId}
                      onClick={() => fileInputs.current[p.caseAttorneyId]?.click()}
                      className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                    >
                      {subiendo === p.caseAttorneyId ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Upload className="w-3 h-3" />
                      )}
                      Subir
                    </button>
                  )}
                  <input
                    ref={(el) => {
                      fileInputs.current[p.caseAttorneyId] = el;
                    }}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) subir(p.caseAttorneyId, f);
                      e.target.value = "";
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
          {error && (
            <div className="px-3 py-2 text-[11px] text-red-600 bg-red-50 border-t border-red-100">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
