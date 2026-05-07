"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AgendaItem } from "./AgendaItemModal";
import {
  AudienciaDetalleModal,
  type AudienciaResumen,
} from "./AudienciaDetalleModal";

interface MonthDay {
  date: string;        // YYYY-MM-DD
  dayNum: number;
  inMonth: boolean;    // false para los días del mes anterior/siguiente que rellenan la grilla
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
  monthDays: MonthDay[];
  hearings: HearingRow[];
  items: AgendaItem[];
  todayKey: string;
}

const DAY_LABELS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

const stateColorsBg: Record<string, string> = {
  programada: "bg-blue-500",
  en_curso: "bg-purple-500",
  suspendida: "bg-orange-500",
  finalizada: "bg-green-500",
  cancelada: "bg-red-500",
};

export function AgendaMonthGrid({ monthDays, hearings, items, todayKey }: Props) {
  const router = useRouter();
  const [audModalOpen, setAudModalOpen] = useState(false);
  const [audSeleccionada, setAudSeleccionada] = useState<AudienciaResumen | null>(null);

  // Map de items y audiencias por fecha
  const hearingsByDate = useMemo(() => {
    const m: Record<string, HearingRow[]> = {};
    for (const h of hearings) {
      (m[h._dateKey] = m[h._dateKey] ?? []).push(h);
    }
    for (const k of Object.keys(m)) {
      m[k].sort((a, b) => a._hour - b._hour);
    }
    return m;
  }, [hearings]);

  const itemsByDate = useMemo(() => {
    const m: Record<string, AgendaItem[]> = {};
    for (const it of items) {
      (m[it.fecha] = m[it.fecha] ?? []).push(it);
    }
    return m;
  }, [items]);

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

  function navegarASemana(date: string) {
    router.push(`/agenda?week=${date}`);
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Encabezado días */}
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {DAY_LABELS.map((label) => (
            <div
              key={label}
              className="p-2 text-center text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-500 border-l border-gray-100 first:border-l-0"
            >
              {label}
            </div>
          ))}
        </div>

        {/* Grilla 7 columnas */}
        <div className="grid grid-cols-7">
          {monthDays.map((day) => {
            const isToday = day.date === todayKey;
            const dayHearings = hearingsByDate[day.date] ?? [];
            const dayItems = itemsByDate[day.date] ?? [];
            const totalEntries = dayHearings.length + dayItems.length;
            const previewHearings = dayHearings.slice(0, 2);
            const previewItems = dayItems.slice(0, Math.max(0, 3 - previewHearings.length));
            const restantes = totalEntries - previewHearings.length - previewItems.length;

            return (
              <div
                key={day.date}
                className={`min-h-[110px] border-l border-t border-gray-100 first:border-l-0 p-1.5 ${
                  day.inMonth ? "bg-white" : "bg-gray-50/50 opacity-60"
                } hover:bg-gray-50 transition-colors cursor-pointer`}
                onClick={(e) => {
                  if (e.target !== e.currentTarget) return;
                  navegarASemana(day.date);
                }}
              >
                <div
                  className={`flex items-center justify-between mb-1 ${
                    isToday ? "" : ""
                  }`}
                  onClick={() => navegarASemana(day.date)}
                >
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold ${
                      isToday
                        ? "bg-[#0D2340] text-white"
                        : day.inMonth
                          ? "text-gray-800"
                          : "text-gray-400"
                    }`}
                  >
                    {day.dayNum}
                  </span>
                </div>

                <div className="space-y-1">
                  {previewHearings.map((h) => (
                    <button
                      type="button"
                      key={h.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        abrirAudiencia(h);
                      }}
                      className="w-full text-left flex items-center gap-1 text-[10px] hover:bg-blue-50 rounded px-1 py-0.5 transition-colors"
                    >
                      <span
                        className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${
                          stateColorsBg[h.estado] ?? "bg-gray-400"
                        }`}
                      />
                      <span className="font-mono text-gray-500">{h._timeStr}</span>
                      <span className="truncate text-gray-800">
                        {h.caso_radicado ?? "Audiencia"}
                      </span>
                    </button>
                  ))}
                  {previewItems.map((it) => (
                    <div
                      key={it.id}
                      className={`flex items-center gap-1 text-[10px] rounded px-1 py-0.5 ${
                        it.tipo === "compromiso"
                          ? "bg-amber-50 text-amber-900"
                          : "bg-purple-50 text-purple-900"
                      } ${it.completado ? "opacity-50 line-through" : ""}`}
                    >
                      <span
                        className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${
                          it.tipo === "compromiso" ? "bg-amber-500" : "bg-purple-500"
                        }`}
                      />
                      {it.hora_inicio && (
                        <span className="font-mono opacity-60">
                          {it.hora_inicio.slice(0, 5)}
                        </span>
                      )}
                      <span className="truncate">{it.titulo}</span>
                    </div>
                  ))}
                  {restantes > 0 && (
                    <div
                      className="text-[10px] text-gray-500 hover:text-gray-700 px-1 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        navegarASemana(day.date);
                      }}
                    >
                      + {restantes} más
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-3 text-xs text-gray-500 text-center">
        Haz clic en un día para abrirlo en vista semanal y agregar compromisos, pendientes o
        audiencias.
      </p>

      <AudienciaDetalleModal
        open={audModalOpen}
        onClose={() => setAudModalOpen(false)}
        audiencia={audSeleccionada}
      />
    </>
  );
}
