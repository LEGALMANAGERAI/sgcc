"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { Trash2 } from "lucide-react";

export interface AgendaItem {
  id: string;
  tipo: "compromiso" | "pendiente";
  titulo: string;
  descripcion: string | null;
  fecha: string;
  hora_inicio: string | null;
  duracion_min: number;
  caso_id: string | null;
  completado: boolean;
  staff_id: string;
}

export interface CasoOption {
  id: string;
  numero_radicado: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Cuando se proporciona, es modo edición. */
  item?: AgendaItem | null;
  /** Modo creación: fecha y hora prellenadas si vienen del click en una celda. */
  fechaInicial?: string;
  horaInicial?: string;
  /** Si el usuario actual es el dueño del item (puede editar/borrar). */
  esCreador?: boolean;
  casos: CasoOption[];
}

export function AgendaItemModal({
  open,
  onClose,
  item,
  fechaInicial,
  horaInicial,
  esCreador = true,
  casos,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const editando = !!item;

  const [tipo, setTipo] = useState<"compromiso" | "pendiente">("compromiso");
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [duracion, setDuracion] = useState(60);
  const [casoId, setCasoId] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (item) {
      setTipo(item.tipo);
      setTitulo(item.titulo);
      setDescripcion(item.descripcion ?? "");
      setFecha(item.fecha);
      setHoraInicio(item.hora_inicio ? item.hora_inicio.slice(0, 5) : "");
      setDuracion(item.duracion_min);
      setCasoId(item.caso_id ?? "");
    } else {
      setTipo("compromiso");
      setTitulo("");
      setDescripcion("");
      setFecha(fechaInicial ?? new Date().toISOString().split("T")[0]);
      setHoraInicio(horaInicial ?? "");
      setDuracion(60);
      setCasoId("");
    }
  }, [open, item, fechaInicial, horaInicial]);

  async function guardar() {
    if (!titulo.trim()) {
      toast({ title: "Título requerido", variant: "error" });
      return;
    }
    setEnviando(true);
    const payload = {
      tipo,
      titulo: titulo.trim(),
      descripcion: descripcion.trim() || null,
      fecha,
      hora_inicio: horaInicio || null,
      duracion_min: duracion,
      caso_id: casoId || null,
    };
    try {
      const url = editando ? `/api/agenda/items/${item!.id}` : `/api/agenda/items`;
      const method = editando ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al guardar");
      }
      toast({
        title: editando ? "Item actualizado" : "Item creado",
        variant: "success",
      });
      onClose();
      router.refresh();
    } catch (e: any) {
      toast({ title: e.message ?? "Error", variant: "error" });
    } finally {
      setEnviando(false);
    }
  }

  async function toggleCompletado() {
    if (!item) return;
    setEnviando(true);
    try {
      const res = await fetch(`/api/agenda/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completado: !item.completado }),
      });
      if (!res.ok) throw new Error("Error al actualizar");
      toast({
        title: !item.completado ? "Marcado como completado" : "Marcado como pendiente",
        variant: "success",
      });
      onClose();
      router.refresh();
    } catch (e: any) {
      toast({ title: e.message ?? "Error", variant: "error" });
    } finally {
      setEnviando(false);
    }
  }

  async function eliminar() {
    if (!item) return;
    if (!confirm("¿Eliminar este item de la agenda?")) return;
    setEnviando(true);
    try {
      const res = await fetch(`/api/agenda/items/${item.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al eliminar");
      }
      toast({ title: "Item eliminado", variant: "success" });
      onClose();
      router.refresh();
    } catch (e: any) {
      toast({ title: e.message ?? "Error", variant: "error" });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editando ? "Editar item de agenda" : "Nuevo item de agenda"}
      size="md"
    >
      <ModalBody>
        <div className="flex flex-col gap-4">
          {/* Tipo */}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!esCreador}
              onClick={() => setTipo("compromiso")}
              className={`flex-1 py-2.5 px-3 rounded-lg border text-sm font-medium transition-colors ${
                tipo === "compromiso"
                  ? "bg-amber-50 border-amber-400 text-amber-900"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              } disabled:opacity-50 disabled:pointer-events-none`}
            >
              Compromiso
            </button>
            <button
              type="button"
              disabled={!esCreador}
              onClick={() => setTipo("pendiente")}
              className={`flex-1 py-2.5 px-3 rounded-lg border text-sm font-medium transition-colors ${
                tipo === "pendiente"
                  ? "bg-purple-50 border-purple-400 text-purple-900"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              } disabled:opacity-50 disabled:pointer-events-none`}
            >
              Pendiente
            </button>
          </div>

          <Input
            label="Título"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder={tipo === "compromiso" ? "Ej. Reunión con apoderado" : "Ej. Revisar oficio"}
            disabled={!esCreador}
          />

          <div>
            <label className="block text-[11px] uppercase tracking-[0.15em] text-[color:var(--color-ink)] opacity-70 mb-1.5 font-medium">
              Descripción
            </label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              disabled={!esCreador}
              className="w-full rounded-[8px] bg-white px-4 py-3 text-sm border-[1.5px] border-[color:var(--color-rule)] focus:border-[color:var(--color-flow)] focus:outline-none resize-none disabled:opacity-50"
              placeholder="Detalles adicionales (opcional)"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              type="date"
              label="Fecha"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              disabled={!esCreador}
            />
            <Input
              type="time"
              label="Hora (opcional)"
              value={horaInicio}
              onChange={(e) => setHoraInicio(e.target.value)}
              helper={tipo === "pendiente" ? "Vacío = todo el día" : undefined}
              disabled={!esCreador}
            />
          </div>

          {horaInicio && (
            <div>
              <label className="block text-[11px] uppercase tracking-[0.15em] text-[color:var(--color-ink)] opacity-70 mb-1.5 font-medium">
                Duración (minutos)
              </label>
              <select
                value={duracion}
                onChange={(e) => setDuracion(Number(e.target.value))}
                disabled={!esCreador}
                className="w-full rounded-[8px] bg-white px-4 py-3 text-sm border-[1.5px] border-[color:var(--color-rule)] focus:border-[color:var(--color-flow)] focus:outline-none disabled:opacity-50"
              >
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={60}>1 hora</option>
                <option value={90}>1h 30min</option>
                <option value={120}>2 horas</option>
                <option value={180}>3 horas</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-[11px] uppercase tracking-[0.15em] text-[color:var(--color-ink)] opacity-70 mb-1.5 font-medium">
              Expediente vinculado (opcional)
            </label>
            <select
              value={casoId}
              onChange={(e) => setCasoId(e.target.value)}
              disabled={!esCreador}
              className="w-full rounded-[8px] bg-white px-4 py-3 text-sm border-[1.5px] border-[color:var(--color-rule)] focus:border-[color:var(--color-flow)] focus:outline-none disabled:opacity-50"
            >
              <option value="">— Sin expediente —</option>
              {casos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.numero_radicado ?? c.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        {editando && esCreador && (
          <Button
            variant="ghost"
            onClick={eliminar}
            disabled={enviando}
            iconLeft={<Trash2 className="w-4 h-4" />}
            className="mr-auto text-red-600 hover:text-red-700"
          >
            Eliminar
          </Button>
        )}
        {editando && esCreador && (
          <Button variant="secondary" onClick={toggleCompletado} disabled={enviando}>
            {item?.completado ? "Marcar pendiente" : "Marcar completado"}
          </Button>
        )}
        <Button variant="secondary" onClick={onClose} disabled={enviando}>
          Cerrar
        </Button>
        {esCreador && (
          <Button onClick={guardar} loading={enviando}>
            {editando ? "Guardar cambios" : "Crear"}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
