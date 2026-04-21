"use client";

import { useState, useEffect } from "react";
import { Mic, Save, Check, AlertCircle } from "lucide-react";

interface Audiencia {
  id: string;
  fecha_hora: string;
  duracion_min: number;
  tipo: string;
  estado: string;
  notas_previas: string | null;
  conciliador?: { nombre: string } | null;
  sala?: { nombre: string } | null;
}

interface Props {
  caseId: string;
  audiencias: Audiencia[];
}

const ESTADO_COLORS: Record<string, string> = {
  programada: "bg-blue-100 text-blue-800",
  en_curso: "bg-purple-100 text-purple-800",
  suspendida: "bg-orange-100 text-orange-800",
  finalizada: "bg-green-100 text-green-800",
  cancelada: "bg-red-100 text-red-800",
};

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Bogota",
  });
}

export function HistorialObservacionesAudiencias({ caseId, audiencias }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-6 text-sm text-gray-400 text-center">
        Cargando observaciones...
      </div>
    );
  }

  if (audiencias.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-6 text-center text-sm text-gray-400">
        Aún no hay audiencias programadas.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {audiencias.map((a, idx) => (
        <ObservacionItem key={a.id} caseId={caseId} audiencia={a} index={idx + 1} />
      ))}
    </div>
  );
}

function ObservacionItem({ caseId, audiencia, index }: { caseId: string; audiencia: Audiencia; index: number }) {
  const [text, setText] = useState(audiencia.notas_previas ?? "");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [fechaDisplay, setFechaDisplay] = useState("");

  useEffect(() => {
    setFechaDisplay(formatFecha(audiencia.fecha_hora));
  }, [audiencia.fecha_hora]);

  const original = audiencia.notas_previas ?? "";
  const dirty = text !== original;

  async function guardar() {
    setSaving(true);
    setStatus("idle");
    setErrorMsg("");
    try {
      const res = await fetch(`/api/casos/${caseId}/audiencias`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hearing_id: audiencia.id, notas_previas: text }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatus("error");
        setErrorMsg(data.error || "Error al guardar");
        return;
      }
      setStatus("saved");
      audiencia.notas_previas = text;
      setTimeout(() => setStatus("idle"), 2500);
    } finally {
      setSaving(false);
    }
  }

  const estadoColor = ESTADO_COLORS[audiencia.estado] ?? "bg-gray-100 text-gray-700";

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 w-8 h-8 rounded-full bg-[#0D2340]/5 flex items-center justify-center flex-shrink-0">
            <Mic className="w-4 h-4 text-[#0D2340]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">
              Audiencia {index} · <span className="capitalize text-gray-600 font-medium">{audiencia.tipo}</span>
            </p>
            <p className="text-xs text-gray-500 mt-0.5 min-h-[14px]" suppressHydrationWarning>{fechaDisplay}</p>
            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-gray-500">
              {audiencia.conciliador?.nombre && (
                <span>Conciliador: <strong className="text-gray-700">{audiencia.conciliador.nombre}</strong></span>
              )}
              {audiencia.sala?.nombre && (
                <span>Sala: <strong className="text-gray-700">{audiencia.sala.nombre}</strong></span>
              )}
              <span>Duración: <strong className="text-gray-700">{audiencia.duracion_min} min</strong></span>
            </div>
          </div>
        </div>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${estadoColor}`}>
          {audiencia.estado}
        </span>
      </div>

      <label className="block text-xs font-medium text-gray-700 mb-1">Observaciones</label>
      <textarea
        rows={3}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (status !== "idle") setStatus("idle");
        }}
        placeholder="Escribe observaciones o instrucciones previas para esta audiencia..."
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F9B] focus:border-transparent resize-y"
      />

      <div className="flex items-center justify-between gap-3 mt-2">
        <div className="text-xs">
          {status === "saved" && (
            <span className="inline-flex items-center gap-1 text-green-700">
              <Check className="w-3.5 h-3.5" /> Guardado
            </span>
          )}
          {status === "error" && (
            <span className="inline-flex items-center gap-1 text-red-700">
              <AlertCircle className="w-3.5 h-3.5" /> {errorMsg}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={guardar}
          disabled={saving || !dirty}
          className="inline-flex items-center gap-1.5 bg-[#1B4F9B] text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-[#0D2340] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? "Guardando..." : dirty ? "Guardar" : "Sin cambios"}
        </button>
      </div>
    </div>
  );
}
