import { clsx } from "clsx";
import type { CaseEstado, ActaEstadoFirma, HearingEstado } from "@/types";

const caseColors: Record<CaseEstado, string> = {
  solicitud: "bg-yellow-100 text-yellow-800",
  admitido: "bg-blue-100 text-blue-800",
  citado: "bg-indigo-100 text-indigo-800",
  audiencia: "bg-purple-100 text-purple-800",
  cerrado: "bg-green-100 text-green-800",
  rechazado: "bg-red-100 text-red-800",
};

const caseLabels: Record<CaseEstado, string> = {
  solicitud: "Solicitud",
  admitido: "Admitido",
  citado: "Citado",
  audiencia: "En Audiencia",
  cerrado: "Cerrado",
  rechazado: "Rechazado",
};

const firmaColors: Record<ActaEstadoFirma, string> = {
  pendiente: "bg-yellow-100 text-yellow-800",
  firmado_parcial: "bg-orange-100 text-orange-800",
  firmado_completo: "bg-green-100 text-green-800",
  archivado: "bg-gray-100 text-gray-600",
};

const hearingColors: Record<HearingEstado, string> = {
  programada: "bg-blue-100 text-blue-800",
  en_curso: "bg-purple-100 text-purple-800",
  suspendida: "bg-orange-100 text-orange-800",
  finalizada: "bg-green-100 text-green-800",
  cancelada: "bg-red-100 text-red-800",
};

interface Props {
  value: CaseEstado | ActaEstadoFirma | HearingEstado;
  type: "case" | "firma" | "hearing";
  size?: "sm" | "md";
}

export function StatusChip({ value, type, size = "sm" }: Props) {
  let color = "bg-gray-100 text-gray-600";
  let label = value;

  if (type === "case") {
    color = caseColors[value as CaseEstado] ?? color;
    label = caseLabels[value as CaseEstado] ?? value;
  } else if (type === "firma") {
    color = firmaColors[value as ActaEstadoFirma] ?? color;
    label = value.replace(/_/g, " ");
  } else if (type === "hearing") {
    color = hearingColors[value as HearingEstado] ?? color;
    label = value.replace(/_/g, " ");
  }

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full font-medium capitalize",
        color,
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
      )}
    >
      {label}
    </span>
  );
}
