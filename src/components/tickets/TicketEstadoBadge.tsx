// src/components/tickets/TicketEstadoBadge.tsx
import type { TicketEstado } from "@/types";

const STYLES: Record<TicketEstado, string> = {
  Pendiente: "bg-gray-100 text-gray-700 border-gray-200",
  EnRevision: "bg-blue-100 text-blue-700 border-blue-200",
  Respondido: "bg-green-100 text-green-700 border-green-200",
  Cerrado: "bg-zinc-100 text-zinc-500 border-zinc-200",
};

const LABELS: Record<TicketEstado, string> = {
  Pendiente: "Pendiente",
  EnRevision: "En revisión",
  Respondido: "Respondido",
  Cerrado: "Cerrado",
};

export function TicketEstadoBadge({ estado }: { estado: TicketEstado }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${STYLES[estado]}`}
    >
      {LABELS[estado]}
    </span>
  );
}
