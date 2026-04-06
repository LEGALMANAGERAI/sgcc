import { clsx } from "clsx";
import { Check, Circle, FileText, Users, Bell, Mic, ClipboardCheck, Archive } from "lucide-react";
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
  estado: CaseEstado;
  events: Array<{ etapa: TimelineEtapa; completado: boolean; fecha: string | null }>;
}

export function CasoTimeline({ estado, events }: Props) {
  const eventMap = Object.fromEntries(events.map((e) => [e.etapa, e]));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-5">Flujo del caso</h3>
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
              {/* Connector line */}
              {idx < STEPS.length - 1 && (
                <div
                  className={clsx(
                    "absolute top-4 left-1/2 w-full h-0.5 -z-0",
                    isCompleted ? "bg-[#0D2340]" : "bg-gray-200"
                  )}
                />
              )}
              {/* Circle */}
              <div
                className={clsx(
                  "w-8 h-8 rounded-full flex items-center justify-center z-10 transition-all",
                  isCompleted
                    ? "bg-[#0D2340] text-white"
                    : isCurrent
                    ? "bg-[#B8860B] text-white ring-4 ring-amber-100"
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
              {/* Label */}
              <p
                className={clsx(
                  "text-xs mt-2 font-medium text-center",
                  isCompleted ? "text-[#0D2340]" : isCurrent ? "text-[#B8860B]" : "text-gray-400"
                )}
              >
                {step.label}
              </p>
              {fecha && (
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {new Date(fecha).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {estado === "rechazado" && (
        <div className="mt-4 bg-red-50 text-red-700 text-sm px-4 py-2 rounded-lg border border-red-200">
          Caso rechazado
        </div>
      )}
    </div>
  );
}
