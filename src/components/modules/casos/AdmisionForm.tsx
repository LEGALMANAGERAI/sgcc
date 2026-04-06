"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle } from "lucide-react";

interface Conciliador { id: string; nombre: string; tarjeta_profesional: string | null }
interface Secretario { id: string; nombre: string }

interface Props {
  caseId: string;
  conciliadores: Conciliador[];
  secretarios: Secretario[];
}

export function AdmisionForm({ caseId, conciliadores, secretarios }: Props) {
  const router = useRouter();
  const [decision, setDecision] = useState<"admitido" | "rechazado" | "">("");
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [conciliadorId, setConciliadorId] = useState("");
  const [secretarioId, setSecretarioId] = useState("");
  const [tarifaBase, setTarifaBase] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!decision) return;
    setError("");
    setLoading(true);

    const res = await fetch(`/api/casos/${caseId}/admision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision,
        motivo_rechazo: decision === "rechazado" ? motivoRechazo : undefined,
        conciliador_id: conciliadorId || undefined,
        secretario_id: secretarioId || undefined,
        tarifa_base: tarifaBase ? Number(tarifaBase) : undefined,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Error al procesar la admisión");
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

      {/* Decisión */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Decisión de admisión</h3>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setDecision("admitido")}
            className={`flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all ${
              decision === "admitido"
                ? "border-green-500 bg-green-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <CheckCircle className={`w-8 h-8 ${decision === "admitido" ? "text-green-500" : "text-gray-300"}`} />
            <span className={`font-medium text-sm ${decision === "admitido" ? "text-green-700" : "text-gray-500"}`}>
              Admitir
            </span>
          </button>
          <button
            type="button"
            onClick={() => setDecision("rechazado")}
            className={`flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all ${
              decision === "rechazado"
                ? "border-red-500 bg-red-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <XCircle className={`w-8 h-8 ${decision === "rechazado" ? "text-red-500" : "text-gray-300"}`} />
            <span className={`font-medium text-sm ${decision === "rechazado" ? "text-red-700" : "text-gray-500"}`}>
              Rechazar
            </span>
          </button>
        </div>
      </div>

      {/* Si admitido: configuración */}
      {decision === "admitido" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Configuración del caso</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Conciliador asignado</label>
              <select
                value={conciliadorId}
                onChange={(e) => setConciliadorId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
              >
                <option value="">Sin asignar aún</option>
                {conciliadores.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}{c.tarjeta_profesional ? ` (T.P. ${c.tarjeta_profesional})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Secretario</label>
              <select
                value={secretarioId}
                onChange={(e) => setSecretarioId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
              >
                <option value="">Sin asignar</option>
                {secretarios.map((s) => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tarifa base ($)</label>
            <input
              type="number"
              min="0"
              value={tarifaBase}
              onChange={(e) => setTarifaBase(e.target.value)}
              placeholder="0"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
            />
          </div>
        </div>
      )}

      {/* Si rechazado: motivo */}
      {decision === "rechazado" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-3">Motivo de rechazo</h3>
          <textarea
            required
            rows={4}
            value={motivoRechazo}
            onChange={(e) => setMotivoRechazo(e.target.value)}
            placeholder="Explique el motivo por el cual se rechaza la solicitud..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340] resize-none"
          />
          <p className="text-xs text-gray-500 mt-2">
            Este motivo será notificado a las partes por correo electrónico.
          </p>
        </div>
      )}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={!decision || loading}
          className="bg-[#0D2340] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[#0d2340dd] transition-colors disabled:opacity-50"
        >
          {loading ? "Procesando..." : decision === "admitido" ? "Confirmar admisión" : decision === "rechazado" ? "Confirmar rechazo" : "Seleccione una decisión"}
        </button>
        <a href={`/casos/${caseId}`} className="text-sm text-gray-500 hover:underline">
          Cancelar
        </a>
      </div>
    </form>
  );
}
