"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { Trash2 } from "lucide-react";

export type Tipo = "compromiso" | "pendiente" | "audiencia";

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

export interface ConciliadorOption {
  id: string;
  nombre: string;
}

export interface SalaOption {
  id: string;
  nombre: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  item?: AgendaItem | null;
  fechaInicial?: string;
  horaInicial?: string;
  esCreador?: boolean;
  casos: CasoOption[];
  conciliadores: ConciliadorOption[];
  salas: SalaOption[];
  currentStaffId: string;
}

const MATERIAS = [
  { value: "civil", label: "Civil" },
  { value: "comercial", label: "Comercial" },
  { value: "laboral", label: "Laboral" },
  { value: "familiar", label: "Familiar" },
  { value: "consumidor", label: "Consumidor" },
  { value: "arrendamiento", label: "Arrendamiento" },
  { value: "otro", label: "Otro" },
];

export function AgendaItemModal({
  open,
  onClose,
  item,
  fechaInicial,
  horaInicial,
  esCreador = true,
  casos,
  conciliadores,
  salas,
  currentStaffId,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const editando = !!item;

  // Compartido
  const [tipo, setTipo] = useState<Tipo>("compromiso");
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [duracion, setDuracion] = useState(60);
  const [casoId, setCasoId] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Audiencia
  const [tipoAudiencia, setTipoAudiencia] = useState<"inicial" | "continuacion" | "complementaria">("inicial");
  const [modalidad, setModalidad] = useState<"presencial" | "virtual" | "mixta">("presencial");
  const [plataformaVirtual, setPlataformaVirtual] = useState("");
  const [conciliadorId, setConciliadorId] = useState("");
  const [salaId, setSalaId] = useState("");
  const [notasPrevias, setNotasPrevias] = useState("");

  // Crear expediente rápido
  const [crearNuevoCaso, setCrearNuevoCaso] = useState(false);
  const [nuevoTipoTramite, setNuevoTipoTramite] = useState("conciliacion");
  const [nuevaMateria, setNuevaMateria] = useState("civil");
  const [nuevaDescripcion, setNuevaDescripcion] = useState("");

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
      setTipoAudiencia("inicial");
      setModalidad("presencial");
      setPlataformaVirtual("");
      setConciliadorId(currentStaffId);
      setSalaId("");
      setNotasPrevias("");
      setCrearNuevoCaso(false);
      setNuevoTipoTramite("conciliacion");
      setNuevaMateria("civil");
      setNuevaDescripcion("");
    }
  }, [open, item, fechaInicial, horaInicial, currentStaffId]);

  async function guardarItemBasico() {
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
      toast({ title: editando ? "Item actualizado" : "Item creado", variant: "success" });
      onClose();
      router.refresh();
    } catch (e: any) {
      toast({ title: e.message ?? "Error", variant: "error" });
    } finally {
      setEnviando(false);
    }
  }

  async function programarAudiencia() {
    if (!horaInicio) {
      toast({ title: "Hora requerida para una audiencia", variant: "error" });
      return;
    }
    if (!crearNuevoCaso && !casoId) {
      toast({ title: "Selecciona un expediente o crea uno nuevo", variant: "error" });
      return;
    }
    if (crearNuevoCaso && !nuevaDescripcion.trim()) {
      toast({ title: "Descripción del expediente nuevo requerida", variant: "error" });
      return;
    }

    setEnviando(true);
    const fechaHoraISO = new Date(`${fecha}T${horaInicio}:00`).toISOString();
    const payload: any = {
      fecha_hora: fechaHoraISO,
      duracion_min: duracion,
      tipo: tipoAudiencia,
      modalidad,
      plataforma_virtual: modalidad === "presencial" ? null : plataformaVirtual.trim() || null,
      sala_id: salaId || null,
      conciliador_id: conciliadorId || null,
      notas_previas: notasPrevias.trim() || null,
    };
    if (crearNuevoCaso) {
      payload.caso_nuevo = {
        tipo_tramite: nuevoTipoTramite,
        materia: nuevaMateria,
        descripcion: nuevaDescripcion.trim(),
      };
    } else {
      payload.case_id = casoId;
    }

    try {
      const res = await fetch(`/api/agenda/audiencias`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al programar audiencia");
      }
      toast({ title: "Audiencia programada", variant: "success" });
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

  // Botón de tipo (3 opciones; en modo edición solo dejamos compromiso/pendiente)
  function TipoButton({ value, label, color }: { value: Tipo; label: string; color: string }) {
    const active = tipo === value;
    return (
      <button
        type="button"
        disabled={!esCreador || (editando && value === "audiencia")}
        onClick={() => setTipo(value)}
        className={`flex-1 py-2.5 px-3 rounded-lg border text-sm font-medium transition-colors ${
          active ? color : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
        } disabled:opacity-50 disabled:pointer-events-none`}
      >
        {label}
      </button>
    );
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
            <TipoButton value="compromiso" label="Compromiso" color="bg-amber-50 border-amber-400 text-amber-900" />
            <TipoButton value="pendiente" label="Pendiente" color="bg-purple-50 border-purple-400 text-purple-900" />
            {!editando && (
              <TipoButton value="audiencia" label="Audiencia" color="bg-blue-50 border-blue-400 text-blue-900" />
            )}
          </div>

          {tipo !== "audiencia" && (
            <>
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
            </>
          )}

          {/* Fecha y hora — siempre visibles */}
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
              label={tipo === "audiencia" ? "Hora" : "Hora (opcional)"}
              value={horaInicio}
              onChange={(e) => setHoraInicio(e.target.value)}
              helper={tipo === "pendiente" ? "Vacío = todo el día" : undefined}
              disabled={!esCreador}
            />
          </div>

          {(horaInicio || tipo === "audiencia") && (
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

          {/* Bloque audiencia */}
          {tipo === "audiencia" && (
            <>
              <div>
                <label className="block text-[11px] uppercase tracking-[0.15em] text-[color:var(--color-ink)] opacity-70 mb-1.5 font-medium">
                  Expediente
                </label>
                <select
                  value={crearNuevoCaso ? "__nuevo__" : casoId}
                  onChange={(e) => {
                    if (e.target.value === "__nuevo__") {
                      setCrearNuevoCaso(true);
                      setCasoId("");
                    } else {
                      setCrearNuevoCaso(false);
                      setCasoId(e.target.value);
                    }
                  }}
                  disabled={!esCreador}
                  className="w-full rounded-[8px] bg-white px-4 py-3 text-sm border-[1.5px] border-[color:var(--color-rule)] focus:border-[color:var(--color-flow)] focus:outline-none disabled:opacity-50"
                >
                  <option value="">— Selecciona un expediente —</option>
                  <option value="__nuevo__">+ Crear expediente nuevo (rápido)</option>
                  {casos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.numero_radicado ?? c.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </div>

              {crearNuevoCaso && (
                <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 space-y-3">
                  <p className="text-xs text-blue-900">
                    Se creará un expediente nuevo en estado &quot;solicitud&quot;. Las partes y otros datos se completan después en el expediente.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] uppercase tracking-[0.15em] opacity-70 mb-1 font-medium">
                        Trámite
                      </label>
                      <select
                        value={nuevoTipoTramite}
                        onChange={(e) => setNuevoTipoTramite(e.target.value)}
                        className="w-full rounded-[8px] bg-white px-3 py-2.5 text-sm border-[1.5px] border-[color:var(--color-rule)] focus:border-[color:var(--color-flow)] focus:outline-none"
                      >
                        <option value="conciliacion">Conciliación</option>
                        <option value="insolvencia">Insolvencia</option>
                        <option value="acuerdo_apoyo">Acuerdo de apoyo</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] uppercase tracking-[0.15em] opacity-70 mb-1 font-medium">
                        Materia
                      </label>
                      <select
                        value={nuevaMateria}
                        onChange={(e) => setNuevaMateria(e.target.value)}
                        className="w-full rounded-[8px] bg-white px-3 py-2.5 text-sm border-[1.5px] border-[color:var(--color-rule)] focus:border-[color:var(--color-flow)] focus:outline-none"
                      >
                        {MATERIAS.map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] uppercase tracking-[0.15em] opacity-70 mb-1 font-medium">
                      Descripción del caso
                    </label>
                    <textarea
                      value={nuevaDescripcion}
                      onChange={(e) => setNuevaDescripcion(e.target.value)}
                      rows={2}
                      placeholder="Resumen breve del asunto"
                      className="w-full rounded-[8px] bg-white px-3 py-2.5 text-sm border-[1.5px] border-[color:var(--color-rule)] focus:border-[color:var(--color-flow)] focus:outline-none resize-none"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-[0.15em] opacity-70 mb-1.5 font-medium">
                    Tipo de audiencia
                  </label>
                  <select
                    value={tipoAudiencia}
                    onChange={(e) => setTipoAudiencia(e.target.value as any)}
                    className="w-full rounded-[8px] bg-white px-4 py-3 text-sm border-[1.5px] border-[color:var(--color-rule)] focus:border-[color:var(--color-flow)] focus:outline-none"
                  >
                    <option value="inicial">Inicial</option>
                    <option value="continuacion">Continuación</option>
                    <option value="complementaria">Complementaria</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-[0.15em] opacity-70 mb-1.5 font-medium">
                    Modalidad
                  </label>
                  <select
                    value={modalidad}
                    onChange={(e) => setModalidad(e.target.value as any)}
                    className="w-full rounded-[8px] bg-white px-4 py-3 text-sm border-[1.5px] border-[color:var(--color-rule)] focus:border-[color:var(--color-flow)] focus:outline-none"
                  >
                    <option value="presencial">Presencial</option>
                    <option value="virtual">Virtual</option>
                    <option value="mixta">Mixta</option>
                  </select>
                </div>
              </div>

              {modalidad !== "presencial" && (
                <Input
                  label="Plataforma virtual"
                  value={plataformaVirtual}
                  onChange={(e) => setPlataformaVirtual(e.target.value)}
                  placeholder="Ej. Zoom, Meet, Teams"
                />
              )}

              <div>
                <label className="block text-[11px] uppercase tracking-[0.15em] opacity-70 mb-1.5 font-medium">
                  Conciliador
                </label>
                <select
                  value={conciliadorId}
                  onChange={(e) => setConciliadorId(e.target.value)}
                  className="w-full rounded-[8px] bg-white px-4 py-3 text-sm border-[1.5px] border-[color:var(--color-rule)] focus:border-[color:var(--color-flow)] focus:outline-none"
                >
                  <option value="">— Sin conciliador asignado —</option>
                  {conciliadores.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-[0.15em] opacity-70 mb-1.5 font-medium">
                  Sala (opcional)
                </label>
                <select
                  value={salaId}
                  onChange={(e) => setSalaId(e.target.value)}
                  className="w-full rounded-[8px] bg-white px-4 py-3 text-sm border-[1.5px] border-[color:var(--color-rule)] focus:border-[color:var(--color-flow)] focus:outline-none"
                >
                  <option value="">— Sin sala —</option>
                  {salas.map((s) => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-[0.15em] opacity-70 mb-1.5 font-medium">
                  Notas previas (opcional)
                </label>
                <textarea
                  value={notasPrevias}
                  onChange={(e) => setNotasPrevias(e.target.value)}
                  rows={2}
                  className="w-full rounded-[8px] bg-white px-4 py-3 text-sm border-[1.5px] border-[color:var(--color-rule)] focus:border-[color:var(--color-flow)] focus:outline-none resize-none"
                  placeholder="Información para el conciliador antes de la audiencia"
                />
              </div>
            </>
          )}

          {/* Expediente vinculado para compromiso/pendiente */}
          {tipo !== "audiencia" && (
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
          )}
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
        {editando && esCreador && tipo !== "audiencia" && (
          <Button variant="secondary" onClick={toggleCompletado} disabled={enviando}>
            {item?.completado ? "Marcar pendiente" : "Marcar completado"}
          </Button>
        )}
        <Button variant="secondary" onClick={onClose} disabled={enviando}>
          Cerrar
        </Button>
        {esCreador && (
          <Button
            onClick={tipo === "audiencia" ? programarAudiencia : guardarItemBasico}
            loading={enviando}
          >
            {tipo === "audiencia"
              ? "Programar audiencia"
              : editando
                ? "Guardar cambios"
                : "Crear"}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
