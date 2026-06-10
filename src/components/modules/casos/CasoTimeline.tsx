"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { clsx } from "clsx";
import {
  Check,
  FileText,
  Users,
  Bell,
  Mic,
  ClipboardCheck,
  Archive,
  Pencil,
} from "lucide-react";
import type { CaseEstado, TimelineEtapa } from "@/types";
import { EditarEtapaModal } from "./EditarEtapaModal";
import { ClientDate } from "@/components/ui/ClientDate";

const STEPS: { etapa: TimelineEtapa; label: string; icon: React.ElementType; activatesAt: CaseEstado[] }[] = [
  { etapa: "solicitud", label: "Solicitud", icon: FileText, activatesAt: ["solicitud", "admitido", "citado", "audiencia", "cerrado"] },
  { etapa: "admision", label: "Admisión", icon: Users, activatesAt: ["admitido", "citado", "audiencia", "cerrado"] },
  { etapa: "citacion", label: "Citación", icon: Bell, activatesAt: ["citado", "audiencia", "cerrado"] },
  { etapa: "audiencia", label: "Audiencia", icon: Mic, activatesAt: ["audiencia", "cerrado"] },
  { etapa: "acta", label: "Acta", icon: ClipboardCheck, activatesAt: ["cerrado"] },
  { etapa: "archivo", label: "Archivo", icon: Archive, activatesAt: ["cerrado"] },
];

const STEP_HREF: Record<string, string> = {
  solicitud: "",
  admision: "?tab=documentos&sub=admision",
  citacion: "?tab=documentos&sub=soportes",
  audiencia: "?tab=audiencia&sub=asistencia",
  acta: "?tab=audiencia&sub=acta",
  archivo: "",
};

const TIPO_AUD_LABEL: Record<string, string> = {
  inicial: "Inicial",
  continuacion: "Continuación",
  complementaria: "Complementaria",
};
const ESTADO_AUD_COLOR: Record<string, string> = {
  programada: "bg-blue-50 text-blue-700 border-blue-200",
  en_curso: "bg-amber-50 text-amber-700 border-amber-200",
  finalizada: "bg-green-50 text-green-700 border-green-200",
  suspendida: "bg-orange-50 text-orange-700 border-orange-200",
  cancelada: "bg-gray-100 text-gray-400 border-gray-200 line-through",
};

interface Props {
  caseId: string;
  estado: CaseEstado;
  events: Array<{ etapa: TimelineEtapa; completado: boolean; fecha: string | null }>;
  caso: any;
  partes: any[];
  audiencias: any[];
  actas: any[];
  conciliadores: Array<{ id: string; nombre: string }>;
  secretarios: Array<{ id: string; nombre: string }>;
  salas: Array<{ id: string; nombre: string; tipo: string }>;
}

export function CasoTimeline({ caseId, estado, events, caso, partes, audiencias, actas, conciliadores, secretarios, salas }: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const eventMap = Object.fromEntries(events.map((e) => [e.etapa, e]));
  const [editingEtapa, setEditingEtapa] = useState<TimelineEtapa | null>(null);
  const [moviendoEtapa, setMoviendoEtapa] = useState<TimelineEtapa | null>(null);
  const [errorMover, setErrorMover] = useState<string | null>(null);

  const STEP_LABEL: Record<TimelineEtapa, string> = STEPS.reduce((acc, s) => {
    acc[s.etapa] = s.label;
    return acc;
  }, {} as Record<TimelineEtapa, string>);

  async function moverAEtapa(etapa: TimelineEtapa) {
    if (moviendoEtapa) return;
    if (!confirm(`¿Mover el caso a la etapa "${STEP_LABEL[etapa]}"?`)) {
      return;
    }
    setErrorMover(null);
    setMoviendoEtapa(etapa);
    try {
      const res = await fetch(`/api/casos/${caseId}/avanzar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etapa }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al mover el caso");
      }
      router.refresh();
    } catch (e: any) {
      setErrorMover(e.message ?? "Error");
    } finally {
      setMoviendoEtapa(null);
    }
  }

  if (!mounted) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6 text-sm text-gray-400">
        Cargando flujo del caso...
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <h3 className="text-sm font-semibold text-gray-700">Flujo del caso</h3>
        <p className="text-[11px] text-gray-400">
          Click en una etapa para ir a su pestaña · ✏️ para editar o mover el caso
        </p>
      </div>
      {errorMover && (
        <div className="mb-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {errorMover}
        </div>
      )}
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
              <Link
                href={`/expediente/${caseId}${STEP_HREF[step.etapa] ?? ""}`}
                title={`Ir a ${step.label}`}
                className={clsx(
                  "w-8 h-8 rounded-full flex items-center justify-center z-10 transition-all",
                  "hover:scale-110 hover:ring-2 hover:ring-[#0D2340]/30 cursor-pointer",
                  isCompleted
                    ? "bg-[#0D2340] text-white"
                    : isCurrent
                    ? "bg-[#1B4F9B] text-white ring-4 ring-amber-100"
                    : isActive
                    ? "bg-white border-2 border-[#0D2340] text-[#0D2340]"
                    : "bg-gray-100 text-gray-400 border-2 border-gray-200 hover:bg-gray-200 hover:text-[#0D2340] hover:border-[#0D2340]"
                )}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : <step.icon className="w-3.5 h-3.5" />}
              </Link>
              <p
                className={clsx(
                  "text-xs mt-2 font-medium text-center",
                  isCompleted ? "text-[#0D2340]" : isCurrent ? "text-[#1B4F9B]" : "text-gray-400"
                )}
              >
                {step.label}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {fecha ? (
                  <ClientDate iso={fecha} mode="date" className="text-[10px] text-gray-400" />
                ) : (
                  <p className="text-[10px] text-gray-400 italic">Sin fecha</p>
                )}
                <button
                  type="button"
                  onClick={() => setEditingEtapa(step.etapa)}
                  className="inline-flex items-center justify-center w-7 h-7 rounded-md text-gray-400 hover:text-[#0D2340] hover:bg-[#0D2340]/10 hover:scale-110 transition-all"
                  title="Editar etapa"
                  aria-label="Editar etapa"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 pt-4 border-t border-gray-100">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold text-gray-500 mr-1">Audiencias:</span>
          {audiencias.length === 0 && (
            <span className="text-[11px] text-gray-400 italic mr-1">Ninguna programada</span>
          )}
          {audiencias.map((aud) => (
            <Link
              key={aud.id}
              href={`/expediente/${caseId}?tab=audiencia&sub=asistencia`}
              className={clsx(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors hover:brightness-95",
                ESTADO_AUD_COLOR[aud.estado] ?? "bg-gray-50 text-gray-600 border-gray-200"
              )}
              title={`${TIPO_AUD_LABEL[aud.tipo] ?? aud.tipo} · ${aud.estado}`}
            >
              <Mic className="w-3 h-3" />
              {TIPO_AUD_LABEL[aud.tipo] ?? aud.tipo}
              {aud.fecha_hora && (
                <span className="opacity-70">· <ClientDate iso={aud.fecha_hora} mode="date" /></span>
              )}
            </Link>
          ))}
          <Link
            href={`/casos/${caseId}/audiencia`}
            className="inline-flex items-center justify-center w-6 h-6 rounded-full border-2 border-dashed border-[#1B4F9B]/40 text-[#1B4F9B] hover:bg-[#1B4F9B]/10 transition-colors"
            title="Programar nueva audiencia"
          >
            +
          </Link>
        </div>
      </div>

      {editingEtapa && (
        <EditarEtapaModal
          etapa={editingEtapa}
          caso={caso}
          partes={partes}
          audiencias={audiencias}
          actas={actas}
          conciliadores={conciliadores}
          secretarios={secretarios}
          salas={salas}
          onClose={() => setEditingEtapa(null)}
          onMoverEtapa={() => moverAEtapa(editingEtapa)}
        />
      )}

      {estado === "rechazado" && (
        <div className="mt-4 bg-red-50 text-red-700 text-sm px-4 py-2 rounded-lg border border-red-200">Caso rechazado</div>
      )}
    </div>
  );
}
