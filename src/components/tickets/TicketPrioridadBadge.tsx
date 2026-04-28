// src/components/tickets/TicketPrioridadBadge.tsx
import type { TicketPrioridad } from "@/types";

const STYLES: Record<TicketPrioridad, string> = {
  Normal: "bg-slate-100 text-slate-600 border-slate-200",
  Media: "bg-amber-100 text-amber-700 border-amber-200",
  Alta: "bg-red-100 text-red-700 border-red-200",
};

export function TicketPrioridadBadge({ prioridad }: { prioridad: TicketPrioridad }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${STYLES[prioridad]}`}
    >
      {prioridad}
    </span>
  );
}
