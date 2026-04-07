"use client";

import { useState } from "react";

// ─── Tipos ─────────────────────────────────────────────────────────────────

interface SlotDisponible {
  fecha: string; // "YYYY-MM-DD" (serializado del API)
  horaInicio: string;
  horaFin: string;
  sala: { id: string; nombre: string; tipo: string };
  conciliador: { id: string; nombre: string };
  score: number;
}

interface Props {
  centerId: string;
  conciliadorId?: string;
  salaId?: string;
  duracionMin?: number;
  onSelect: (slot: SlotDisponible) => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const DIAS_SEMANA = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function formatearFecha(fechaStr: string): string {
  const [y, m, d] = fechaStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const diaSemana = DIAS_SEMANA[date.getDay()];
  const mes = MESES[date.getMonth()];
  return `${diaSemana} ${d} de ${mes}`;
}

function tipoBadge(tipo: string) {
  if (tipo === "presencial") {
    return (
      <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
        Presencial
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
      Virtual
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 70
      ? "bg-green-500"
      : score >= 40
        ? "bg-yellow-500"
        : "bg-red-400";

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 rounded-full bg-gray-200">
        <div
          className={`h-2 rounded-full ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs text-gray-500">{score}%</span>
    </div>
  );
}

// ─── Skeleton ──────────────────────────────────────────────────────────────

function SlotSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-gray-200 p-4">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-4 w-40 rounded bg-gray-200" />
          <div className="h-3 w-28 rounded bg-gray-200" />
          <div className="h-3 w-32 rounded bg-gray-200" />
          <div className="h-3 w-24 rounded bg-gray-200" />
        </div>
        <div className="h-6 w-24 rounded bg-gray-200" />
      </div>
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────

export default function SugerenciaHorarios({
  centerId,
  conciliadorId,
  salaId,
  duracionMin = 60,
  onSelect,
}: Props) {
  const [sugerencias, setSugerencias] = useState<SlotDisponible[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buscado, setBuscado] = useState(false);

  async function buscarSugerencias() {
    setLoading(true);
    setError(null);
    setBuscado(true);

    try {
      const params = new URLSearchParams({
        center_id: centerId,
        duracion_min: String(duracionMin),
        max: "5",
      });

      if (conciliadorId) params.set("conciliador_id", conciliadorId);
      if (salaId) params.set("sala_id", salaId);

      const res = await fetch(`/api/audiencias/sugerir?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Error al obtener sugerencias");
        setSugerencias([]);
        return;
      }

      setSugerencias(data.sugerencias ?? []);
    } catch {
      setError("Error de conexion al buscar sugerencias");
      setSugerencias([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Boton principal */}
      <button
        type="button"
        onClick={buscarSugerencias}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
      >
        {loading ? (
          <>
            <svg
              className="h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Buscando...
          </>
        ) : (
          <>
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
              />
            </svg>
            Sugerir horarios disponibles
          </>
        )}
      </button>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          <SlotSkeleton />
          <SlotSkeleton />
          <SlotSkeleton />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Sin resultados */}
      {buscado && !loading && !error && sugerencias.length === 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          <p className="font-medium">No se encontraron horarios disponibles</p>
          <p className="mt-1 text-yellow-700">
            Intente ampliar el rango de fechas o verificar que haya
            conciliadores y salas activas en el centro.
          </p>
        </div>
      )}

      {/* Lista de sugerencias */}
      {!loading && sugerencias.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-600">
            {sugerencias.length} horario{sugerencias.length !== 1 ? "s" : ""}{" "}
            disponible{sugerencias.length !== 1 ? "s" : ""}
          </p>

          {sugerencias.map((slot, idx) => (
            <button
              key={`${slot.fecha}-${slot.horaInicio}-${slot.sala.id}-${slot.conciliador.id}`}
              type="button"
              onClick={() => onSelect(slot)}
              className="group w-full rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm transition-all hover:border-indigo-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1 space-y-1.5">
                  {/* Fecha */}
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">
                      {formatearFecha(slot.fecha)}
                    </p>
                    {idx === 0 && (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                        Recomendado
                      </span>
                    )}
                  </div>

                  {/* Hora */}
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">
                      {slot.horaInicio} - {slot.horaFin}
                    </span>
                  </p>

                  {/* Sala */}
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <svg
                      className="h-4 w-4 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 7.5h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z"
                      />
                    </svg>
                    <span>{slot.sala.nombre}</span>
                    {tipoBadge(slot.sala.tipo)}
                  </div>

                  {/* Conciliador */}
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <svg
                      className="h-4 w-4 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                      />
                    </svg>
                    <span>{slot.conciliador.nombre}</span>
                  </div>

                  {/* Score */}
                  <ScoreBar score={slot.score} />
                </div>

                {/* Flecha seleccionar */}
                <div className="ml-4 flex-shrink-0 text-gray-300 transition-colors group-hover:text-indigo-500">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8.25 4.5l7.5 7.5-7.5 7.5"
                    />
                  </svg>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
