"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar } from "lucide-react";

interface Staff {
  id: string;
  nombre: string;
}
interface Sala {
  id: string;
  nombre: string;
  tipo: string;
}

interface Props {
  caseId: string;
  conciliadores: Staff[];
  salas: Sala[];
  defaultConciliadorId: string | null;
  tipoTramite: "conciliacion" | "insolvencia" | "acuerdo_apoyo" | string;
}

const TIPOS_AUDIENCIA: Record<string, { v: string; l: string }[]> = {
  conciliacion: [
    { v: "inicial", l: "Audiencia de conciliación" },
    { v: "continuacion", l: "Continuación" },
  ],
  insolvencia: [
    { v: "negociacion", l: "Negociación de deudas" },
    { v: "validacion", l: "Validación de acuerdo" },
    { v: "liquidacion", l: "Liquidación patrimonial" },
  ],
  acuerdo_apoyo: [
    { v: "inicial", l: "Audiencia de acuerdo de apoyo" },
    { v: "continuacion", l: "Continuación" },
  ],
};

export function ProgramarAudienciaInlineCard({
  caseId,
  conciliadores,
  salas,
  defaultConciliadorId,
  tipoTramite,
}: Props) {
  const router = useRouter();
  const tiposDisponibles = TIPOS_AUDIENCIA[tipoTramite] ?? TIPOS_AUDIENCIA.conciliacion;
  const [conciliadorId, setConciliadorId] = useState(defaultConciliadorId ?? "");
  const [salaId, setSalaId] = useState("");
  const [fechaHora, setFechaHora] = useState("");
  const [duracion, setDuracion] = useState("60");
  const [tipo, setTipo] = useState(tiposDisponibles[0].v);
  const [modalidad, setModalidad] = useState<"presencial" | "virtual" | "mixta">("presencial");
  const [plataformaVirtual, setPlataformaVirtual] = useState("");
  const [notas, setNotas] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fechaHora) {
      setError("La fecha y hora es obligatoria");
      return;
    }
    setError("");
    setLoading(true);

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
        plataforma_virtual: modalidad === "presencial" ? null : plataformaVirtual || null,
        notas_previas: notas || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data?.error ?? "Error al programar la audiencia");
      return;
    }
    // Refrescar para que el server component recargue hearings y muestre el editor de acta.
    router.refresh();
  }

  return (
    <div className="mt-6 bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="rounded-lg bg-[#1B4F9B]/10 p-2">
          <Calendar className="w-5 h-5 text-[#1B4F9B]" />
        </div>
        <div>
          <h3 className="font-semibold text-[#0D2340]">
            Programa la audiencia para generar el acta
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Necesitas una audiencia asociada para crear el acta. Llena los campos básicos y luego podrás editarla.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              Fecha y hora <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              required
              value={fechaHora}
              onChange={(e) => setFechaHora(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1B4F9B]/30 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Duración (minutos)</label>
            <input
              type="number"
              min={15}
              step={15}
              value={duracion}
              onChange={(e) => setDuracion(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1B4F9B]/30 outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Tipo de audiencia</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#1B4F9B]/30 outline-none"
            >
              {tiposDisponibles.map((t) => (
                <option key={t.v} value={t.v}>{t.l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Modalidad</label>
            <select
              value={modalidad}
              onChange={(e) => setModalidad(e.target.value as "presencial" | "virtual" | "mixta")}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#1B4F9B]/30 outline-none"
            >
              <option value="presencial">Presencial</option>
              <option value="virtual">Virtual</option>
              <option value="mixta">Mixta</option>
            </select>
          </div>
        </div>

        {modalidad !== "presencial" && (
          <div>
            <label className="block text-xs text-gray-600 mb-1">Plataforma virtual / link</label>
            <input
              type="text"
              value={plataformaVirtual}
              onChange={(e) => setPlataformaVirtual(e.target.value)}
              placeholder="Ej: Meet https://meet.google.com/..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1B4F9B]/30 outline-none"
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Conciliador</label>
            <select
              value={conciliadorId}
              onChange={(e) => setConciliadorId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#1B4F9B]/30 outline-none"
            >
              <option value="">— Sin asignar —</option>
              {conciliadores.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Sala</label>
            <select
              value={salaId}
              onChange={(e) => setSalaId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#1B4F9B]/30 outline-none"
            >
              <option value="">— Sin asignar —</option>
              {salas.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre} ({s.tipo})</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">Notas previas (opcional)</label>
          <textarea
            rows={2}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Observaciones para preparar la audiencia"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1B4F9B]/30 outline-none"
          />
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={loading || !fechaHora}
            className="px-4 py-2 bg-[#0D2340] text-white rounded-lg text-sm font-medium hover:bg-[#0D2340]/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Programando..." : "Programar audiencia"}
          </button>
        </div>
      </form>
    </div>
  );
}
