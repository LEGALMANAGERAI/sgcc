// src/app/(partes)/mis-tickets/nuevo/NuevoTicketForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";

interface CasoOpcion {
  id: string;
  numero_radicado: string;
  tipo_tramite: string;
}

export function NuevoTicketForm({ casos }: { casos: CasoOpcion[] }) {
  const router = useRouter();
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [caseId, setCaseId] = useState("");
  const [prioridad, setPrioridad] = useState<"Normal" | "Media" | "Alta">("Normal");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!titulo.trim()) {
      setError("El título es requerido");
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch("/api/partes/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: titulo.trim(),
          descripcion: descripcion.trim() || null,
          case_id: caseId || null,
          prioridad,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Error al crear el ticket");
        return;
      }
      const data = await res.json();
      router.push(`/mis-tickets/${data.id}`);
    } catch {
      setError("Error de conexión");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        href="/mis-tickets"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="w-4 h-4" /> Volver
      </Link>

      <h1 className="text-2xl font-bold text-[#0D2340]">Nuevo ticket</h1>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Título <span className="text-red-500">*</span>
          </label>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={200}
            placeholder="Ej: Necesito ayuda con la audiencia"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1B4F9B]/30 focus:border-[#1B4F9B] outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            maxLength={2000}
            rows={5}
            placeholder="Cuéntanos en detalle…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1B4F9B]/30 focus:border-[#1B4F9B] outline-none"
          />
          <p className="text-[10px] text-gray-400 mt-1">{descripcion.length}/2000</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Caso relacionado</label>
            <select
              value={caseId}
              onChange={(e) => setCaseId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Sin caso específico</option>
              {casos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.numero_radicado} ({c.tipo_tramite})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Prioridad</label>
            <select
              value={prioridad}
              onChange={(e) => setPrioridad(e.target.value as any)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="Normal">Normal</option>
              <option value="Media">Media</option>
              <option value="Alta">Alta</option>
            </select>
          </div>
        </div>

        <p className="text-xs text-gray-400">
          Podrás adjuntar archivos después de crear el ticket.
        </p>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={enviando}
            className="flex items-center gap-2 px-4 py-2 bg-[#0D2340] text-white rounded-lg text-sm font-medium hover:bg-[#0D2340]/90 disabled:opacity-50"
          >
            {enviando && <Loader2 className="w-4 h-4 animate-spin" />}
            Crear ticket
          </button>
          <Link
            href="/mis-tickets"
            className="px-4 py-2 text-gray-600 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
