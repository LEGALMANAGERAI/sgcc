// src/app/(partes)/mis-tickets/[id]/TicketDetalleClient.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Paperclip, Trash2, CheckCircle2, Loader2 } from "lucide-react";
import { TicketEstadoBadge } from "@/components/tickets/TicketEstadoBadge";
import { TicketPrioridadBadge } from "@/components/tickets/TicketPrioridadBadge";
import { AdjuntosUpload } from "@/components/tickets/AdjuntosUpload";
import type { TicketEstado, TicketPrioridad, SgccTicketAdjunto } from "@/types";

interface TicketDetalle {
  id: string;
  titulo: string;
  descripcion: string | null;
  estado: TicketEstado;
  prioridad: TicketPrioridad;
  case_id: string | null;
  caso: { id: string; numero_radicado: string } | null;
  respuesta: string | null;
  respondido_at: string | null;
  respondedor: { id: string; nombre: string } | null;
  created_at: string;
}

export function TicketDetalleClient({
  ticket,
  adjuntosIniciales,
  userId,
}: {
  ticket: TicketDetalle;
  adjuntosIniciales: SgccTicketAdjunto[];
  userId: string;
}) {
  const router = useRouter();
  const [adjuntos, setAdjuntos] = useState<SgccTicketAdjunto[]>(adjuntosIniciales);
  const [cerrando, setCerrando] = useState(false);
  const [error, setError] = useState("");

  const cerrado = ticket.estado === "Cerrado";

  async function recargarAdjuntos() {
    const res = await fetch(`/api/partes/tickets/${ticket.id}`);
    if (res.ok) {
      const data = await res.json();
      setAdjuntos(data.adjuntos ?? []);
    }
  }

  async function handleCerrar() {
    if (!confirm("¿Marcar este ticket como resuelto? No podrás reabrirlo.")) return;
    setCerrando(true);
    setError("");
    try {
      const res = await fetch(`/api/partes/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "Cerrado" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Error al cerrar");
        return;
      }
      router.refresh();
    } catch {
      setError("Error de conexión");
    } finally {
      setCerrando(false);
    }
  }

  async function handleBorrarAdjunto(adjuntoId: string) {
    if (!confirm("¿Eliminar este adjunto?")) return;
    const res = await fetch(`/api/partes/tickets/${ticket.id}/adjuntos/${adjuntoId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setAdjuntos((prev) => prev.filter((a) => a.id !== adjuntoId));
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Error al eliminar");
    }
  }

  const adjuntosParte = adjuntos.filter((a) => a.subido_por_party);
  const adjuntosStaff = adjuntos.filter((a) => a.subido_por_staff);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        href="/mis-tickets"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="w-4 h-4" /> Mis tickets
      </Link>

      <header className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold text-[#0D2340]">{ticket.titulo}</h1>
          <div className="flex flex-col gap-1 items-end">
            <TicketEstadoBadge estado={ticket.estado} />
            <TicketPrioridadBadge prioridad={ticket.prioridad} />
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
          <span>Creado: {new Date(ticket.created_at).toLocaleString("es-CO")}</span>
          {ticket.caso && (
            <span>
              Caso:{" "}
              <Link
                href={`/mis-casos/${ticket.caso.id}`}
                className="text-[#1B4F9B] hover:underline"
              >
                {ticket.caso.numero_radicado}
              </Link>
            </span>
          )}
        </div>
      </header>

      <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Mi mensaje</h2>
        <p className="text-sm text-gray-700 whitespace-pre-line">
          {ticket.descripcion || "(sin descripción)"}
        </p>
        {adjuntosParte.length > 0 && (
          <ul className="space-y-1 pt-3 border-t border-gray-100">
            {adjuntosParte.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-[#1B4F9B] hover:underline"
                >
                  <Paperclip className="w-4 h-4" /> {a.nombre_archivo}
                </a>
                {!cerrado && a.subido_por_party === userId && (
                  <button
                    onClick={() => handleBorrarAdjunto(a.id)}
                    className="text-red-500 hover:text-red-700"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Respuesta del centro</h2>
        {ticket.respuesta ? (
          <>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {ticket.respondedor?.nombre ? `${ticket.respondedor.nombre} • ` : ""}
              {ticket.respondido_at &&
                new Date(ticket.respondido_at).toLocaleString("es-CO")}
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-line">{ticket.respuesta}</p>
            {adjuntosStaff.length > 0 && (
              <ul className="space-y-1 pt-3 border-t border-gray-100">
                {adjuntosStaff.map((a) => (
                  <li key={a.id} className="text-sm">
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-[#1B4F9B] hover:underline"
                    >
                      <Paperclip className="w-4 h-4" /> {a.nombre_archivo}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400 italic">Esperando respuesta del centro…</p>
        )}
      </section>

      {!cerrado && adjuntos.length < 5 && (
        <section className="bg-gray-50 border border-gray-200 rounded-xl p-6 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Adjuntar archivo adicional</h2>
          <AdjuntosUpload
            endpoint={`/api/partes/tickets/${ticket.id}/adjuntos`}
            onUploaded={recargarAdjuntos}
            maxFiles={5 - adjuntos.length}
          />
        </section>
      )}

      {error && <div className="text-sm text-red-600">{error}</div>}

      {!cerrado ? (
        <div className="flex justify-end">
          <button
            onClick={handleCerrar}
            disabled={cerrando}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {cerrando ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            Marcar como resuelto
          </button>
        </div>
      ) : (
        <div className="text-sm text-gray-500 italic text-center">
          Este ticket fue cerrado.
        </div>
      )}
    </div>
  );
}
