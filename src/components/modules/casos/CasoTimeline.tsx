"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Check, FileText, Users, Bell, Mic, ClipboardCheck, Archive, Pencil } from "lucide-react";
import type { CaseEstado, TimelineEtapa } from "@/types";

const STEPS: { etapa: TimelineEtapa; label: string; icon: React.ElementType; activatesAt: CaseEstado[] }[] = [
  { etapa: "solicitud", label: "Solicitud", icon: FileText, activatesAt: ["solicitud", "admitido", "citado", "audiencia", "cerrado"] },
  { etapa: "admision", label: "Admisión", icon: Users, activatesAt: ["admitido", "citado", "audiencia", "cerrado"] },
  { etapa: "citacion", label: "Citación", icon: Bell, activatesAt: ["citado", "audiencia", "cerrado"] },
  { etapa: "audiencia", label: "Audiencia", icon: Mic, activatesAt: ["audiencia", "cerrado"] },
  { etapa: "acta", label: "Acta", icon: ClipboardCheck, activatesAt: ["cerrado"] },
  { etapa: "archivo", label: "Archivo", icon: Archive, activatesAt: ["cerrado"] },
];

interface Props {
  caseId: string;
  estado: CaseEstado;
  events: Array<{ etapa: TimelineEtapa; completado: boolean; fecha: string | null }>;
}

function toInputValue(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function CasoTimeline({ caseId, estado, events }: Props) {
  const router = useRouter();
  const eventMap = Object.fromEntries(events.map((e) => [e.etapa, e]));
  const [editing, setEditing] = useState<TimelineEtapa | null>(null);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function startEdit(etapa: TimelineEtapa) {
    setError("");
    setValue(toInputValue(eventMap[etapa]?.fecha));
    setEditing(etapa);
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/casos/${caseId}/fechas`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etapa: editing, fecha: value ? new Date(value).toISOString() : null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Error al guardar");
        return;
      }
      setEditing(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-gray-700">Flujo del caso</h3>
        <p className="text-[11px] text-gray-400">Click en el lápiz para editar la fecha de cada etapa</p>
      </div>
      <div className="flex items-start gap-0">
        {STEPS.map((step, idx) => {
          const isCompleted = eventMap[step.etapa]?.completado ?? false;
          const isActive = step.activatesAt.includes(estado) && !isCompleted;
          const isCurrent =
            (estado === "solicitud" && step.etapa === "solicitud") ||
            (estado === "admitido" && step.etapa === "admision") ||
            (estado === "citado" && step.etapa === "citacion") ||
            (estado === "audiencia" && step.etapa === "audiencia");
          const fecha = eventMap[step.etapa]?.fecha;

          return (
            <div key={step.etapa} className="flex-1 flex flex-col items-center relative">
              {idx < STEPS.length - 1 && (
                <div
                  className={clsx(
                    "absolute top-4 left-1/2 w-full h-0.5 -z-0",
                    isCompleted ? "bg-[#0D2340]" : "bg-gray-200"
                  )}
                />
              )}
              <div
                className={clsx(
                  "w-8 h-8 rounded-full flex items-center justify-center z-10 transition-all",
                  isCompleted
                    ? "bg-[#0D2340] text-white"
                    : isCurrent
                    ? "bg-[#1B4F9B] text-white ring-4 ring-amber-100"
                    : isActive
                    ? "bg-white border-2 border-[#0D2340] text-[#0D2340]"
                    : "bg-gray-100 text-gray-400 border-2 border-gray-200"
                )}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <step.icon className="w-3.5 h-3.5" />
                )}
              </div>
              <p
                className={clsx(
                  "text-xs mt-2 font-medium text-center",
                  isCompleted ? "text-[#0D2340]" : isCurrent ? "text-[#1B4F9B]" : "text-gray-400"
                )}
              >
                {step.label}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <p className="text-[10px] text-gray-400">
                  {fecha
                    ? new Date(fecha).toLocaleDateString("es-CO", { day: "numeric", month: "short" })
                    : "—"}
                </p>
                <button
                  type="button"
                  onClick={() => startEdit(step.etapa)}
                  className="text-gray-300 hover:text-[#1B4F9B] transition-colors"
                  title="Editar fecha"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <div className="mt-5 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-800">
              Editar fecha — {STEPS.find((s) => s.etapa === editing)?.label}
            </p>
            <button onClick={() => setEditing(null)} className="text-xs text-gray-500 hover:underline">
              Cancelar
            </button>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="datetime-local"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
            />
            <button
              onClick={save}
              disabled={saving}
              className="bg-[#0D2340] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0d2340dd] disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
            <button
              onClick={() => setValue("")}
              disabled={saving}
              className="text-xs text-gray-500 hover:underline"
            >
              Limpiar
            </button>
          </div>
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        </div>
      )}

      {estado === "rechazado" && (
        <div className="mt-4 bg-red-50 text-red-700 text-sm px-4 py-2 rounded-lg border border-red-200">
          Caso rechazado
        </div>
      )}
    </div>
  );
}
