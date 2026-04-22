import { clsx } from "clsx";
import type { CaseEstado, ActaEstadoFirma, HearingEstado } from "@/types";

/**
 * StatusChip — mapper de estados de dominio SGCC (case / hearing / firma)
 * a la paleta FlowCase (§4.4 del brand brief).
 *
 * Para badges genéricos usar <Badge>.
 */

// Tokens FlowCase reutilizables por familia de estado.
const T = {
  radicado: "bg-[rgba(27,49,82,0.1)] text-[color:var(--color-ink-soft)]",
  activo: "bg-[rgba(20,184,166,0.12)] text-[color:var(--color-flow-deep)]",
  audiencia: "bg-[rgba(245,158,11,0.12)] text-[#B45309]",
  acuerdo: "bg-[color:var(--color-ink)] text-[color:var(--color-flow)]",
  archivado: "bg-[color:var(--color-paper-warm)] text-[color:var(--color-ink-soft)]",
  vencido: "bg-[rgba(198,88,64,0.12)] text-[color:var(--color-terracotta)]",
} as const;

const caseColors: Record<CaseEstado, string> = {
  solicitud: T.radicado,
  admitido: T.activo,
  citado: T.activo,
  audiencia: T.audiencia,
  cerrado: T.acuerdo,
  rechazado: T.vencido,
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
  pendiente: T.radicado,
  firmado_parcial: T.audiencia,
  firmado_completo: T.activo,
  archivado: T.archivado,
};

const hearingColors: Record<HearingEstado, string> = {
  programada: T.radicado,
  en_curso: T.audiencia,
  suspendida: T.audiencia,
  finalizada: T.activo,
  cancelada: T.vencido,
};

interface Props {
  value: string;
  type: "case" | "firma" | "hearing" | "acta";
  size?: "sm" | "md";
}

export function StatusChip({ value, type, size = "sm" }: Props) {
  let color: string = T.archivado;
  let label: string = value;

  if (type === "case") {
    color = caseColors[value as CaseEstado] ?? color;
    label = caseLabels[value as CaseEstado] ?? value;
  } else if (type === "firma" || type === "acta") {
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
