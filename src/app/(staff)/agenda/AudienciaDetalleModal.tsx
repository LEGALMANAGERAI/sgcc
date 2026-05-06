"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

export interface AudienciaResumen {
  id: string;
  case_id: string | null;
  caso_radicado: string | null;
  conciliador_nombre: string | null;
  sala_nombre: string | null;
  estado: string;
  fecha_iso: string;
  duracion_min: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  audiencia: AudienciaResumen | null;
}

export function AudienciaDetalleModal({ open, onClose, audiencia }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [reprogramar, setReprogramar] = useState(false);
  const [nuevaFecha, setNuevaFecha] = useState("");
  const [nuevaHora, setNuevaHora] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!open || !audiencia) return;
    setReprogramar(false);
    const d = new Date(audiencia.fecha_iso);
    const fechaLocal = d.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
    const horaLocal = d.toLocaleTimeString("en-GB", {
      timeZone: "America/Bogota",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    setNuevaFecha(fechaLocal);
    setNuevaHora(horaLocal);
  }, [open, audiencia]);

  if (!audiencia) return null;

  const fechaLegible = new Date(audiencia.fecha_iso).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "full",
    timeStyle: "short",
  });

  async function aplicarReprogramacion() {
    if (!nuevaFecha || !nuevaHora) {
      toast({ title: "Fecha y hora requeridas", variant: "error" });
      return;
    }
    setEnviando(true);
    try {
      const fechaHoraISO = new Date(`${nuevaFecha}T${nuevaHora}:00`).toISOString();
      const res = await fetch(`/api/agenda/audiencias/${audiencia!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha_hora: fechaHoraISO }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al reprogramar");
      }
      toast({ title: "Audiencia reprogramada", variant: "success" });
      onClose();
      router.refresh();
    } catch (e: any) {
      toast({ title: e.message ?? "Error", variant: "error" });
    } finally {
      setEnviando(false);
    }
  }

  async function cancelarAudiencia() {
    if (!confirm("¿Cancelar esta audiencia? Su estado pasará a 'cancelada'.")) return;
    setEnviando(true);
    try {
      const res = await fetch(`/api/agenda/audiencias/${audiencia!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "cancelada" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al cancelar");
      }
      toast({ title: "Audiencia cancelada", variant: "success" });
      onClose();
      router.refresh();
    } catch (e: any) {
      toast({ title: e.message ?? "Error", variant: "error" });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Audiencia programada" size="md">
      <ModalBody>
        <div className="space-y-3 text-sm">
          <div>
            <div className="text-xs uppercase tracking-[0.1em] opacity-60 mb-0.5">
              Expediente
            </div>
            <div className="font-medium">
              {audiencia.caso_radicado ?? "Sin radicado"}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.1em] opacity-60 mb-0.5">Fecha</div>
            <div className="font-medium capitalize">{fechaLegible}</div>
            <div className="text-xs text-gray-500">Duración: {audiencia.duracion_min} min</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.1em] opacity-60 mb-0.5">
              Conciliador
            </div>
            <div>{audiencia.conciliador_nombre ?? "Sin asignar"}</div>
          </div>
          {audiencia.sala_nombre && (
            <div>
              <div className="text-xs uppercase tracking-[0.1em] opacity-60 mb-0.5">Sala</div>
              <div>{audiencia.sala_nombre}</div>
            </div>
          )}
          <div>
            <div className="text-xs uppercase tracking-[0.1em] opacity-60 mb-0.5">Estado</div>
            <div className="capitalize">{audiencia.estado.replace(/_/g, " ")}</div>
          </div>

          {reprogramar && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 mt-3">
              <p className="text-xs text-blue-900 mb-2">Selecciona la nueva fecha y hora.</p>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="date"
                  label="Nueva fecha"
                  value={nuevaFecha}
                  onChange={(e) => setNuevaFecha(e.target.value)}
                />
                <Input
                  type="time"
                  label="Nueva hora"
                  value={nuevaHora}
                  onChange={(e) => setNuevaHora(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        {audiencia.case_id && (
          <Link
            href={`/casos/${audiencia.case_id}`}
            className="mr-auto text-sm text-[color:var(--color-ink)] opacity-70 hover:opacity-100 hover:underline"
          >
            Ir al expediente →
          </Link>
        )}
        {audiencia.estado !== "cancelada" && audiencia.estado !== "finalizada" && (
          <>
            <Button
              variant="ghost"
              onClick={cancelarAudiencia}
              disabled={enviando}
              className="text-red-600 hover:text-red-700"
            >
              Cancelar audiencia
            </Button>
            {!reprogramar ? (
              <Button variant="secondary" onClick={() => setReprogramar(true)} disabled={enviando}>
                Reprogramar
              </Button>
            ) : (
              <Button onClick={aplicarReprogramacion} loading={enviando}>
                Aplicar reprogramación
              </Button>
            )}
          </>
        )}
        <Button variant="secondary" onClick={onClose} disabled={enviando}>
          Cerrar
        </Button>
      </ModalFooter>
    </Modal>
  );
}
