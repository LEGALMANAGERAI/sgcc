// src/app/(partes)/mis-tickets/MisTicketsClient.tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, LifeBuoy } from "lucide-react";
import { TicketEstadoBadge } from "@/components/tickets/TicketEstadoBadge";
import type { TicketEstado } from "@/types";

interface TicketRow {
  id: string;
  titulo: string;
  estado: TicketEstado;
  prioridad: string;
  created_at: string;
  updated_at: string;
  case_id: string | null;
  caso: { numero_radicado: string } | null;
}

type Filtro = "todos" | "abiertos" | "cerrados";

export function MisTicketsClient({ ticketsIniciales }: { ticketsIniciales: TicketRow[] }) {
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const filtrados = useMemo(() => {
    if (filtro === "todos") return ticketsIniciales;
    if (filtro === "abiertos")
      return ticketsIniciales.filter((t) => t.estado !== "Cerrado");
    return ticketsIniciales.filter((t) => t.estado === "Cerrado");
  }, [filtro, ticketsIniciales]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0D2340] flex items-center gap-2">
            <LifeBuoy className="w-6 h-6" /> Mis tickets
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Solicita ayuda al centro sobre un trámite o consulta general.
          </p>
        </div>
        <Link
          href="/mis-tickets/nuevo"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#0D2340] text-white rounded-lg text-sm font-medium hover:bg-[#0D2340]/90"
        >
          <Plus className="w-4 h-4" /> Nuevo ticket
        </Link>
      </div>

      <div className="flex gap-2">
        {(["todos", "abiertos", "cerrados"] as Filtro[]).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-3 py-1 rounded-full text-sm border ${
              filtro === f
                ? "bg-[#0D2340] text-white border-[#0D2340]"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {filtrados.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <LifeBuoy className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">
            {ticketsIniciales.length === 0
              ? "Aún no has abierto ningún ticket. Si necesitas ayuda con un trámite, abre uno aquí."
              : "No hay tickets que coincidan con el filtro."}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Título</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">Caso</th>
                <th className="text-left px-4 py-3">Estado</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Actualizado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtrados.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-3">
                    <Link href={`/mis-tickets/${t.id}`} className="block font-medium text-[#0D2340]">
                      {t.titulo}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                    {t.caso?.numero_radicado ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <TicketEstadoBadge estado={t.estado} />
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                    {new Date(t.updated_at).toLocaleDateString("es-CO")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
