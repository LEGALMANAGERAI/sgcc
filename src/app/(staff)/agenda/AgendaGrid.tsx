"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import {
  AgendaItemModal,
  type AgendaItem,
  type CasoOption,
  type ConciliadorOption,
  type SalaOption,
} from "./AgendaItemModal";
import {
  AudienciaDetalleModal,
  type AudienciaResumen,
} from "./AudienciaDetalleModal";

interface WeekDay {
  date: string;
  label: string;
  dayNum: number;
  month: string;
}

interface HearingRow {
  id: string;
  caso_id: string | null;
  caso_radicado: string | null;
  conciliador_nombre: string | null;
  sala_nombre: string | null;
  estado: string;
  fecha_iso: string;
  duracion_min: number;
  _dateKey: string;
  _hour: number;
  _timeStr: string;
}

interface Props {
  weekDays: WeekDay[];
  hours: number[];
  hearings: HearingRow[];
  items: AgendaItem[];
  casos: CasoOption[];
  conciliadores: ConciliadorOption[];
  salas: SalaOption[];
  currentStaffId: string;
  todayKey: string;
}

const stateColors: Record<string, string> = {
  programada: "bg-blue-100 border-blue-300 text-blue-900",
  en_curso: "bg-purple-100 border-purple-300 text-purple-900",
  suspendida: "bg-orange-100 border-orange-300 text-orange-900",
  finalizada: "bg-green-100 border-green-300 text-green-900",
  cancelada: "bg-red-100 border-red-300 text-red-900",
};

const tipoColors: Record<string, string> = {
  compromiso: "bg-amber-50 border-amber-300 text-amber-900",
  pendiente: "bg-purple-50 border-purple-300 text-purple-900",
};

export function AgendaGrid({
  weekDays,
  hours,
  hearings,
  items,
  casos,
  conciliadores,
  salas,
  currentStaffId,
  todayKey,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AgendaItem | null>(null);
  const [prefillFecha, setPrefillFecha] = useState<string | undefined>();
  const [prefillHora, setPrefillHora] = useState<string | undefined>();

  const [audModalOpen, setAudModalOpen] = useState(false);
  const [audSeleccionada, setAudSeleccionada] = useState<AudienciaResumen | null>(null);

  // Agrupar audiencias por fecha+hora
  const hearingMap = useMemo(() => {
    const m: Record<string, HearingRow[]> = {};
    for (const h of hearings) {
      const key = `${h._dateKey}_${h._hour}`;
      (m[key] = m[key] ?? []).push(h);
    }
    return m;
  }, [hearings]);

  // Items con hora → grilla por celda; sin hora → banda "todo el día"
  const itemsByCell = useMemo(() => {
    const m: Record<string, AgendaItem[]> = {};
    for (const it of items) {
      if (!it.hora_inicio) continue;
      const hour = parseInt(it.hora_inicio.slice(0, 2), 10);
      const key = `${it.fecha}_${hour}`;
      (m[key] = m[key] ?? []).push(it);
    }
    return m;
  }, [items]);

  const itemsTodoElDia = useMemo(() => {
    const m: Record<string, AgendaItem[]> = {};
    for (const it of items) {
      if (it.hora_inicio) continue;
      (m[it.fecha] = m[it.fecha] ?? []).push(it);
    }
    return m;
  }, [items]);

  const algunoTodoElDia = Object.keys(itemsTodoElDia).length > 0;

  function abrirCreacion(fecha: string, hora?: number) {
    setEditingItem(null);
    setPrefillFecha(fecha);
    setPrefillHora(hora !== undefined ? `${String(hora).padStart(2, "0")}:00` : undefined);
    setModalOpen(true);
  }

  function abrirEdicion(item: AgendaItem) {
    setEditingItem(item);
    setPrefillFecha(undefined);
    setPrefillHora(undefined);
    setModalOpen(true);
  }

  function abrirAudiencia(h: HearingRow) {
    setAudSeleccionada({
      id: h.id,
      case_id: h.caso_id,
      caso_radicado: h.caso_radicado,
      conciliador_nombre: h.conciliador_nombre,
      sala_nombre: h.sala_nombre,
      estado: h.estado,
      fecha_iso: h.fecha_iso,
      duracion_min: h.duracion_min,
    });
    setAudModalOpen(true);
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Encabezado días */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-gray-200">
          <div className="p-2 bg-gray-50" />
          {weekDays.map((day) => {
            const isToday = day.date === todayKey;
            return (
              <div
                key={day.date}
                className={`p-3 text-center border-l border-gray-100 ${
                  isToday ? "bg-[#0D2340] text-white" : "bg-gray-50"
                }`}
              >
                <div className={`text-xs font-semibold ${isToday ? "text-white/80" : "text-gray-500"}`}>
                  {day.label}
                </div>
                <div className={`text-lg font-bold ${isToday ? "text-white" : "text-gray-800"}`}>
                  {day.dayNum}
                </div>
                <div className={`text-xs ${isToday ? "text-white/60" : "text-gray-400"}`}>
                  {day.month}
                </div>
              </div>
            );
          })}
        </div>

        {/* Banda "todo el día" para pendientes sin hora */}
        {algunoTodoElDia && (
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-gray-200 bg-purple-50/30">
            <div className="p-2 text-[10px] uppercase tracking-[0.1em] font-semibold text-gray-500 text-right pr-3 pt-2 border-r border-gray-100">
              Todo el día
            </div>
            {weekDays.map((day) => {
              const dayItems = itemsTodoElDia[day.date] ?? [];
              return (
                <div
                  key={day.date}
                  className="border-l border-gray-100 p-1 min-h-[44px]"
                >
                  {dayItems.map((it) => (
                    <button
                      type="button"
                      key={it.id}
                      onClick={() => abrirEdicion(it)}
                      className={`block w-full text-left rounded-md border p-1.5 mb-1 text-xs hover:shadow-sm transition-shadow ${
                        tipoColors[it.tipo]
                      } ${it.completado ? "opacity-50 line-through" : ""}`}
                    >
                      <div className="font-semibold truncate">{it.titulo}</div>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* Filas por hora */}
        {hours.map((hour) => (
          <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-gray-50 min-h-[60px]">
            <div className="p-2 text-xs text-gray-400 font-mono text-right pr-3 pt-3 border-r border-gray-100">
              {hour.toString().padStart(2, "0")}:00
            </div>
            {weekDays.map((day) => {
              const key = `${day.date}_${hour}`;
              const cellHearings = hearingMap[key] ?? [];
              const cellItems = itemsByCell[key] ?? [];
              const isEmpty = cellHearings.length === 0 && cellItems.length === 0;

              return (
                <div
                  key={key}
                  className={`group border-l border-gray-50 p-1 min-h-[60px] relative ${
                    isEmpty ? "cursor-pointer hover:bg-gray-50/60" : ""
                  }`}
                  onClick={(e) => {
                    if (!isEmpty) return;
                    if (e.target !== e.currentTarget) return;
                    abrirCreacion(day.date, hour);
                  }}
                >
                  {cellHearings.map((h) => (
                    <button
                      type="button"
                      key={h.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        abrirAudiencia(h);
                      }}
                      className={`block w-full text-left rounded-md border p-1.5 mb-1 text-xs cursor-pointer hover:shadow-sm transition-shadow ${
                        stateColors[h.estado] ?? "bg-gray-100 border-gray-200 text-gray-800"
                      }`}
                    >
                      <div className="font-semibold truncate">
                        {h._timeStr} — {h.caso_radicado ?? "Sin radicado"}
                      </div>
                      <div className="truncate opacity-75">
                        {h.conciliador_nombre ?? "Sin conciliador"}
                      </div>
                      {h.sala_nombre && <div className="truncate opacity-60">{h.sala_nombre}</div>}
                    </button>
                  ))}
                  {cellItems.map((it) => (
                    <button
                      type="button"
                      key={it.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        abrirEdicion(it);
                      }}
                      className={`block w-full text-left rounded-md border p-1.5 mb-1 text-xs hover:shadow-sm transition-shadow ${
                        tipoColors[it.tipo]
                      } ${it.completado ? "opacity-50 line-through" : ""}`}
                    >
                      <div className="font-semibold truncate">
                        {(it.hora_inicio ?? "").slice(0, 5)} — {it.titulo}
                      </div>
                      {it.tipo === "pendiente" && (
                        <div className="truncate opacity-60">Pendiente</div>
                      )}
                    </button>
                  ))}
                  {isEmpty && (
                    <div
                      className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                      aria-hidden
                    >
                      <Plus className="w-4 h-4 text-gray-400" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Leyenda */}
      <div className="mt-6 flex flex-wrap gap-4 text-xs">
        {Object.entries(stateColors).map(([estado, cls]) => (
          <div key={estado} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${cls.split(" ")[0]}`} />
            <span className="text-gray-600 capitalize">{estado.replace(/_/g, " ")}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-amber-50 border border-amber-300" />
          <span className="text-gray-600">Compromiso</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-purple-50 border border-purple-300" />
          <span className="text-gray-600">Pendiente</span>
        </div>
      </div>

      <AgendaItemModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        item={editingItem}
        fechaInicial={prefillFecha}
        horaInicial={prefillHora}
        esCreador={editingItem ? editingItem.staff_id === currentStaffId : true}
        casos={casos}
        conciliadores={conciliadores}
        salas={salas}
        currentStaffId={currentStaffId}
      />

      <AudienciaDetalleModal
        open={audModalOpen}
        onClose={() => setAudModalOpen(false)}
        audiencia={audSeleccionada}
      />
    </>
  );
}
