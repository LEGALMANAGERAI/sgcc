"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, MessageSquare, X, Filter } from "lucide-react";
import { AdjuntosUpload } from "@/components/tickets/AdjuntosUpload";

interface StaffLite {
  id: string;
  nombre: string;
  email: string;
  rol: string;
}

interface TicketRow {
  id: string;
  titulo: string;
  descripcion: string | null;
  categoria: "soporte" | "administrativo" | "operativo";
  prioridad: "Normal" | "Media" | "Alta";
  estado: "Pendiente" | "EnRevision" | "Respondido" | "Cerrado";
  respuesta: string | null;
  respondido_at: string | null;
  created_at: string;
  case_id: string | null;
  solicitante_party_id: string | null;
  solicitante_party: {
    id: string;
    nombres: string | null;
    apellidos: string | null;
    razon_social: string | null;
    email: string | null;
  } | null;
  solicitante: { id: string; nombre: string; email: string } | null;
  asignado: { id: string; nombre: string; email: string } | null;
  respondedor: { id: string; nombre: string; email: string } | null;
  caso: { id: string; numero_radicado: string } | null;
}

const PRIORIDAD_BORDER: Record<string, string> = {
  Alta: "#dc2626",
  Media: "#d97706",
  Normal: "#2563eb",
};

const PRIORIDAD_BADGE: Record<string, string> = {
  Alta: "bg-red-50 border-red-200 text-red-700",
  Media: "bg-amber-50 border-amber-200 text-amber-700",
  Normal: "bg-blue-50 border-blue-200 text-blue-700",
};

const ESTADO_BADGE: Record<string, string> = {
  Pendiente: "bg-yellow-50 border-yellow-200 text-yellow-700",
  EnRevision: "bg-blue-50 border-blue-200 text-blue-700",
  Respondido: "bg-green-50 border-green-200 text-green-700",
  Cerrado: "bg-gray-50 border-gray-200 text-gray-600",
};

const ESTADO_LABEL: Record<string, string> = {
  Pendiente: "Pendiente",
  EnRevision: "En revisión",
  Respondido: "Respondido",
  Cerrado: "Cerrado",
};

const CATEGORIA_BADGE: Record<string, string> = {
  soporte: "bg-blue-50 border-blue-200 text-blue-700",
  administrativo: "bg-purple-50 border-purple-200 text-purple-700",
  operativo: "bg-amber-50 border-amber-200 text-amber-700",
};

const ESTADO_ORDER: Record<string, number> = {
  Pendiente: 0,
  EnRevision: 1,
  Respondido: 2,
  Cerrado: 3,
};

const PRIO_ORDER: Record<string, number> = { Alta: 0, Media: 1, Normal: 2 };

interface Props {
  initialTickets: TicketRow[];
  staff: StaffLite[];
  currentStaffId: string;
  isAdmin: boolean;
}

export default function TicketsClient({ initialTickets, staff, currentStaffId, isAdmin }: Props) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [respondingTo, setRespondingTo] = useState<TicketRow | null>(null);
  const [filterCategoria, setFilterCategoria] = useState<string>("");
  const [filterEstado, setFilterEstado] = useState<string>("");
  const [filterPrioridad, setFilterPrioridad] = useState<string>("");
  const [origen, setOrigen] = useState<"todos" | "parte" | "staff">("todos");

  const filtered = useMemo(() => {
    const list = initialTickets.filter((t) => {
      if (filterCategoria && t.categoria !== filterCategoria) return false;
      if (filterEstado && t.estado !== filterEstado) return false;
      if (filterPrioridad && t.prioridad !== filterPrioridad) return false;
      if (origen === "parte" && !t.solicitante_party_id) return false;
      if (origen === "staff" && t.solicitante_party_id) return false;
      return true;
    });
    return list.sort((a, b) => {
      const oa = ESTADO_ORDER[a.estado] ?? 99;
      const ob = ESTADO_ORDER[b.estado] ?? 99;
      if (oa !== ob) return oa - ob;
      return (PRIO_ORDER[a.prioridad] ?? 99) - (PRIO_ORDER[b.prioridad] ?? 99);
    });
  }, [initialTickets, filterCategoria, filterEstado, filterPrioridad, origen]);

  const anyFilter = !!(filterCategoria || filterEstado || filterPrioridad);

  return (
    <>
      <div className="bg-white border border-[#DDE4ED] rounded-xl shadow-sm">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-[#E8EEF6]">
          <div className="flex items-center gap-2 text-sm text-[#3D5068] flex-1 min-w-[200px]">
            <span className="font-bold text-[#1A2332]">🎫 Tickets</span>
            <span className="text-[#7A8FA6]">· {filtered.length} de {initialTickets.length}</span>
          </div>

          {/* Pills origen */}
          <div className="flex gap-2">
            {(["todos", "parte", "staff"] as const).map((o) => (
              <button
                key={o}
                onClick={() => setOrigen(o)}
                className={`px-3 py-1 rounded-full text-sm border ${
                  origen === o
                    ? "bg-[#0D2340] text-white border-[#0D2340]"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {o === "todos" ? "Todos" : o === "parte" ? "De partes" : "Internos"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-[#7A8FA6]" />
            <select
              value={filterCategoria}
              onChange={(e) => setFilterCategoria(e.target.value)}
              className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
            >
              <option value="">Categoría</option>
              <option value="soporte">Soporte</option>
              <option value="administrativo">Administrativo</option>
              <option value="operativo">Operativo</option>
            </select>
            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
              className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
            >
              <option value="">Estado</option>
              <option value="Pendiente">Pendiente</option>
              <option value="EnRevision">En revisión</option>
              <option value="Respondido">Respondido</option>
              <option value="Cerrado">Cerrado</option>
            </select>
            <select
              value={filterPrioridad}
              onChange={(e) => setFilterPrioridad(e.target.value)}
              className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
            >
              <option value="">Prioridad</option>
              <option value="Alta">Alta</option>
              <option value="Media">Media</option>
              <option value="Normal">Normal</option>
            </select>
            {anyFilter && (
              <button
                onClick={() => {
                  setFilterCategoria("");
                  setFilterEstado("");
                  setFilterPrioridad("");
                }}
                className="text-xs text-red-500 hover:underline"
              >
                Limpiar
              </button>
            )}
          </div>

          <button
            onClick={() => setShowCreate(true)}
            className="bg-[#0D2340] hover:bg-[#0d2340dd] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuevo ticket
          </button>
        </div>

        {/* Lista */}
        <div className="p-4">
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">🎫</div>
              <p className="text-sm font-semibold text-[#3D5068]">
                {anyFilter ? "Sin tickets con estos filtros" : "No hay tickets registrados"}
              </p>
              <p className="text-xs text-[#7A8FA6] mt-1">
                {anyFilter
                  ? "Prueba limpiando los filtros"
                  : "Crea el primer ticket usando el botón superior"}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filtered.map((t) => {
                const borderColor = PRIORIDAD_BORDER[t.prioridad] ?? "#9ca3af";
                const cerrado = t.estado === "Cerrado";
                const puedeResponder =
                  !cerrado &&
                  (isAdmin ||
                    t.asignado?.id === currentStaffId ||
                    t.solicitante?.id === currentStaffId);

                return (
                  <div
                    key={t.id}
                    className={`border border-[#DDE4ED] rounded-lg p-4 transition-shadow ${
                      cerrado ? "opacity-60" : "hover:shadow-[0_2px_8px_rgba(13,35,64,0.08)]"
                    }`}
                    style={{ borderLeft: `4px solid ${borderColor}` }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`text-sm font-bold ${cerrado ? "line-through text-[#7A8FA6]" : "text-[#0D2340]"}`}>
                            #{t.id.slice(-6)} · {t.titulo}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${
                              CATEGORIA_BADGE[t.categoria]
                            }`}
                          >
                            {t.categoria}
                          </span>
                          {t.caso && (
                            <Link
                              href={`/expediente/${t.caso.id}`}
                              className="text-[10px] font-mono text-[#1B4F9B] hover:underline"
                            >
                              Exp. {t.caso.numero_radicado}
                            </Link>
                          )}
                        </div>
                        {t.descripcion && (
                          <p className="text-xs text-[#7A8FA6] line-clamp-2 mt-0.5">{t.descripcion}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] text-[#7A8FA6]">
                          <span className="flex items-center gap-1.5">
                            👤{" "}
                            {t.solicitante_party_id ? (
                              <span className="flex items-center gap-1.5">
                                {t.solicitante_party
                                  ? [t.solicitante_party.nombres, t.solicitante_party.apellidos]
                                      .filter(Boolean)
                                      .join(" ") ||
                                    t.solicitante_party.razon_social ||
                                    t.solicitante_party.email
                                  : "Parte"}
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-violet-100 text-violet-700 border border-violet-200">
                                  Parte
                                </span>
                              </span>
                            ) : (
                              t.solicitante?.nombre ?? "—"
                            )}
                            <span className="text-[#B7C2D4]"> · solicitante</span>
                          </span>
                          {t.asignado && (
                            <span>
                              🎯 {t.asignado.nombre}
                              <span className="text-[#B7C2D4]"> · asignado</span>
                            </span>
                          )}
                          <span>
                            📅 {new Date(t.created_at).toLocaleDateString("es-CO", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                        {t.respuesta && (
                          <div className="mt-2 p-2.5 bg-green-50 border border-green-200 rounded-md">
                            <p className="text-[11px] font-bold text-green-700 mb-0.5">
                              Respuesta {t.respondedor?.nombre ? `de ${t.respondedor.nombre}` : ""}
                            </p>
                            <p className="text-xs text-green-800 whitespace-pre-line">{t.respuesta}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            PRIORIDAD_BADGE[t.prioridad]
                          }`}
                        >
                          {t.prioridad}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            ESTADO_BADGE[t.estado]
                          }`}
                        >
                          {ESTADO_LABEL[t.estado]}
                        </span>
                        {puedeResponder && (
                          <button
                            onClick={() => setRespondingTo(t)}
                            className="text-[11px] font-medium text-[#1B4F9B] hover:bg-[#1B4F9B]/10 px-2 py-1 rounded flex items-center gap-1"
                          >
                            <MessageSquare className="w-3 h-3" />
                            Responder
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <TicketForm
          staff={staff}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            router.refresh();
          }}
        />
      )}

      {respondingTo && (
        <ResponderModal
          ticket={respondingTo}
          onClose={() => setRespondingTo(null)}
          onSaved={() => {
            setRespondingTo(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// Modal crear ticket
// ─────────────────────────────────────────────────────────────────

function TicketForm({
  staff,
  onClose,
  onCreated,
}: {
  staff: StaffLite[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoria, setCategoria] = useState<"soporte" | "administrativo" | "operativo">("soporte");
  const [prioridad, setPrioridad] = useState<"Normal" | "Media" | "Alta">("Normal");
  const [asignadoId, setAsignadoId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!titulo.trim()) {
      setError("El título es requerido");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: titulo.trim(),
          descripcion: descripcion.trim() || null,
          categoria,
          prioridad,
          asignado_staff_id: asignadoId || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error ?? "Error creando ticket");
        return;
      }
      onCreated();
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-bold text-lg text-[#0D2340]">Nuevo ticket</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#3D5068] mb-1.5">Categoría</label>
            <div className="grid grid-cols-3 gap-2">
              {(["soporte", "administrativo", "operativo"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategoria(c)}
                  className={`px-3 py-2 text-xs font-medium rounded-lg border capitalize transition-colors ${
                    categoria === c
                      ? "bg-[#0D2340] text-white border-[#0D2340]"
                      : "bg-white text-[#3D5068] border-gray-300 hover:border-[#0D2340]"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#3D5068] mb-1.5">Título *</label>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
              maxLength={160}
              placeholder="Resumen breve del ticket"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#3D5068] mb-1.5">Prioridad</label>
              <select
                value={prioridad}
                onChange={(e) => setPrioridad(e.target.value as any)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
              >
                <option value="Normal">Normal</option>
                <option value="Media">Media</option>
                <option value="Alta">Alta</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#3D5068] mb-1.5">Asignar a</label>
              <select
                value={asignadoId}
                onChange={(e) => setAsignadoId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
              >
                <option value="">Sin asignar</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre} ({s.rol})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#3D5068] mb-1.5">Descripción</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={4}
              placeholder="Detalla el requerimiento o la consulta..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340] resize-none"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium text-[#3D5068] hover:bg-gray-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium bg-[#0D2340] hover:bg-[#0d2340dd] text-white rounded-lg disabled:opacity-50"
            >
              {isPending ? "Creando..." : "Crear ticket"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Modal responder / cambiar estado
// ─────────────────────────────────────────────────────────────────

function ResponderModal({
  ticket,
  onClose,
  onSaved,
}: {
  ticket: TicketRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [respuesta, setRespuesta] = useState("");
  const [estado, setEstado] = useState(ticket.estado);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [adjuntos, setAdjuntos] = useState<any[]>([]);

  async function recargarAdjuntos(ticketId: string) {
    const res = await fetch(`/api/tickets/${ticketId}`);
    if (res.ok) {
      const data = await res.json();
      setAdjuntos(data.adjuntos ?? []);
    }
  }

  useEffect(() => {
    recargarAdjuntos(ticket.id);
  }, [ticket.id]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          respuesta: respuesta.trim() || undefined,
          estado,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error ?? "Error actualizando ticket");
        return;
      }
      onSaved();
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-bold text-lg text-[#0D2340]">Responder ticket</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <div className="text-xs font-bold text-[#3D5068] mb-1">#{ticket.id.slice(-6)} · {ticket.titulo}</div>
            {ticket.descripcion && (
              <p className="text-xs text-[#7A8FA6] whitespace-pre-line">{ticket.descripcion}</p>
            )}
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#3D5068] mb-1.5">Estado</label>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value as any)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
              >
                <option value="Pendiente">Pendiente</option>
                <option value="EnRevision">En revisión</option>
                <option value="Respondido">Respondido</option>
                <option value="Cerrado">Cerrado</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#3D5068] mb-1.5">
                Respuesta {ticket.respuesta ? "(nueva)" : ""}
              </label>
              <textarea
                value={respuesta}
                onChange={(e) => setRespuesta(e.target.value)}
                rows={5}
                placeholder="Escribe tu respuesta..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340] resize-none"
              />
              {ticket.respuesta && (
                <p className="text-[11px] text-[#7A8FA6] mt-1">
                  Al enviar, reemplazará la respuesta actual.
                </p>
              )}
            </div>

            {/* Adjuntos del staff en la respuesta */}
            <div className="pt-3 border-t border-gray-100 space-y-2">
              <h4 className="text-xs font-semibold text-gray-600">Adjuntos en mi respuesta</h4>
              <AdjuntosUpload
                endpoint={`/api/tickets/${ticket.id}/adjuntos`}
                onUploaded={() => recargarAdjuntos(ticket.id)}
              />
              {adjuntos.filter((a) => a.subido_por_staff).map((a) => (
                <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="block text-sm text-[#1B4F9B] hover:underline">
                  📎 {a.nombre_archivo}
                </a>
              ))}
            </div>

            {/* Adjuntos de la parte */}
            {adjuntos.filter((a) => a.subido_por_party).length > 0 && (
              <div className="pt-3 border-t border-gray-100 space-y-2">
                <h4 className="text-xs font-semibold text-gray-600">Adjuntos de la parte</h4>
                {adjuntos.filter((a) => a.subido_por_party).map((a) => (
                  <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="block text-sm text-[#1B4F9B] hover:underline">
                    📎 {a.nombre_archivo}
                  </a>
                ))}
              </div>
            )}

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium text-[#3D5068] hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium bg-[#0D2340] hover:bg-[#0d2340dd] text-white rounded-lg disabled:opacity-50"
              >
                {isPending ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
