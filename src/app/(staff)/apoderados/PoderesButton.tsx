"use client";

import { useState, useRef, useEffect } from "react";
import { Paperclip } from "lucide-react";

interface Poder {
  url: string;
  radicado: string;
  activo: boolean;
}

interface Props {
  poderes: Poder[];
}

export function PoderesButton({ poderes }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!poderes.length) return null;

  // Si solo hay uno, link directo al PDF.
  if (poderes.length === 1) {
    return (
      <a
        href={poderes[0].url}
        target="_blank"
        rel="noopener noreferrer"
        title={`Ver poder (${poderes[0].radicado})`}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-[#1B4F9B]/10 text-[#1B4F9B] hover:bg-[#1B4F9B]/20 transition-colors"
      >
        <Paperclip className="w-3.5 h-3.5" />
        Poder
      </a>
    );
  }

  // Varios: popover con la lista.
  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-[#1B4F9B]/10 text-[#1B4F9B] hover:bg-[#1B4F9B]/20 transition-colors"
      >
        <Paperclip className="w-3.5 h-3.5" />
        Poderes ({poderes.length})
      </button>
      {open && (
        <div
          className="absolute z-20 mt-1 right-0 w-64 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
        >
          <div className="px-3 py-2 text-[11px] uppercase tracking-[0.1em] text-gray-500 bg-gray-50 border-b border-gray-100 font-semibold">
            Poderes registrados
          </div>
          <ul className="max-h-64 overflow-y-auto">
            {poderes.map((p, i) => (
              <li key={`${p.url}-${i}`} className="border-b border-gray-50 last:border-b-0">
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-gray-50 transition-colors"
                >
                  <span className="font-mono text-xs text-gray-700 truncate">{p.radicado}</span>
                  <span
                    className={`flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                      p.activo
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {p.activo ? "Activo" : "Inactivo"}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
