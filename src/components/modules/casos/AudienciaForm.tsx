"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Staff { id: string; nombre: string }
interface Sala { id: string; nombre: string; tipo: string; link_virtual: string | null }

interface Props {
  caseId: string;
  conciliadores: Staff[];
  salas: Sala[];
  defaultConciliadorId: string | null;
  defaultSalaId: string | null;
  defaultFechaHora: string | null;
  defaultTipo?: string;
}

function toLocalInputValue(iso: string): string {
  // datetime-local requiere "YYYY-MM-DDTHH:mm" en hora local del navegador
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AudienciaForm({ caseId, conciliadores, salas, defaultConciliadorId, defaultSalaId, defaultFechaHora, defaultTipo = "inicial" }: Props) {
  const router = useRouter();
  const [conciliadorId, setConciliadorId] = useState(defaultConciliadorId ?? "");
  const [salaId, setSalaId] = useState(defaultSalaId ?? "");
  const [fechaHora, setFechaHora] = useState(
    defaultFechaHora ? toLocalInputValue(defaultFechaHora) : ""
  );
  const [duracion, setDuracion] = useState("60");
  const [tipo, setTipo] = useState(defaultTipo);
  const [modalidad, setModalidad] = useState<"presencial" | "virtual" | "mixta">("presencial");
  const [plataformaVirtual, setPlataformaVirtual] = useState("");
  const [notas, setNotas] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    // El input datetime-local devuelve "YYYY-MM-DDTHH:mm" sin TZ. new Date()
    // lo interpreta en la TZ del navegador (Bogotá) y toISOString() lo
    // convierte a UTC antes de guardar. Sin esto Postgres asumiría UTC.
    const fechaHoraUTC = new Date(fechaHora).toISOString();

    const res = await fetch(`/api/casos/${caseId}/audiencias`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conciliador_id: conciliadorId || undefined,
        sala_id: salaId || undefined,
        fecha_hora: fechaHoraUTC,
        duracion_min: Number(duracion),
        tipo,
        modalidad,
        plataforma_virtual:
          modalidad === "presencial" ? null : plataformaVirtual || null,
        notas_previas: notas || undefined,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Error al programar la audiencia");
      return;
    }

    router.push(`/casos/${caseId}`);
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
        <h3 className="font-semibold text-gray-900">Datos de la audiencia</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha y hora *</label>
            <input
              type="datetime-local"
              required
              value={fechaHora}
              onChange={(e) => setFechaHora(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Duración (minutos)</label>
            <select
              value={duracion}
              onChange={(e) => setDuracion(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
            >
              <option value="30">30 min</option>
              <option value="60">1 hora</option>
              <option value="90">1.5 horas</option>
              <option value="120">2 horas</option>
              <option value="180">3 horas</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Conciliador</label>
            <select
              value={conciliadorId}
              onChange={(e) => setConciliadorId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
            >
              <option value="">Sin asignar</option>
              {conciliadores.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sala</label>
            <select
              value={salaId}
              onChange={(e) => setSalaId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
            >
              <option value="">Sin asignar</option>
              {salas.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre} ({s.tipo})</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de audiencia</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
            >
              <option value="inicial">Inicial</option>
              <option value="continuacion">Continuación</option>
              <option value="complementaria">Complementaria</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Modalidad</label>
            <select
              value={modalidad}
              onChange={(e) => setModalidad(e.target.value as any)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
            >
              <option value="presencial">Presencial</option>
              <option value="virtual">Virtual</option>
              <option value="mixta">Mixta (sala + virtual)</option>
            </select>
          </div>
        </div>

        {modalidad !== "presencial" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Plataforma virtual <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <select
              value={plataformaVirtual}
              onChange={(e) => setPlataformaVirtual(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
            >
              <option value="">Sin especificar</option>
              <option value="Zoom">Zoom</option>
              <option value="Google Meet">Google Meet</option>
              <option value="Microsoft Teams">Microsoft Teams</option>
              <option value="Otra">Otra</option>
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notas previas</label>
          <textarea
            rows={3}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Instrucciones o consideraciones previas para la audiencia..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340] resize-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={loading || !fechaHora}
          className="bg-[#0D2340] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[#0d2340dd] transition-colors disabled:opacity-50"
        >
          {loading ? "Programando..." : "Programar audiencia"}
        </button>
        <a href={`/casos/${caseId}`} className="text-sm text-gray-500 hover:underline">
          Cancelar
        </a>
      </div>
    </form>
  );
}
