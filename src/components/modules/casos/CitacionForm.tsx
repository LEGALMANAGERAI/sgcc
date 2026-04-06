"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";

interface Template { id: string; nombre: string; tipo: string }
interface Sala { id: string; nombre: string; tipo: string; link_virtual: string | null }

interface Props {
  caseId: string;
  templates: Template[];
  salas: Sala[];
  currentSalaId: string | null;
}

export function CitacionForm({ caseId, templates, salas, currentSalaId }: Props) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [fechaAudiencia, setFechaAudiencia] = useState("");
  const [salaId, setSalaId] = useState(currentSalaId ?? "");
  const [mensajeExtra, setMensajeExtra] = useState("");
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!templateId) {
      setError("Seleccione una plantilla");
      return;
    }
    setError("");
    setLoading(true);

    const res = await fetch(`/api/casos/${caseId}/citacion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template_id: templateId,
        fecha_audiencia_propuesta: fechaAudiencia || undefined,
        sala_id: salaId || undefined,
        mensaje_personalizado: mensajeExtra || undefined,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Error al generar la citación");
      return;
    }

    setDocUrl(data.url);
  }

  if (docUrl) {
    return (
      <div className="max-w-2xl">
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <div className="text-5xl mb-4">✓</div>
          <h3 className="font-semibold text-green-800 text-lg mb-2">Citación generada y enviada</h3>
          <p className="text-sm text-green-700 mb-5">
            El documento fue enviado por correo a todas las partes del proceso.
          </p>
          <div className="flex items-center justify-center gap-3">
            <a
              href={docUrl}
              target="_blank"
              className="flex items-center gap-2 bg-[#0D2340] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#0d2340dd] transition-colors"
            >
              <Download className="w-4 h-4" /> Descargar citación
            </a>
            <button
              onClick={() => router.push(`/casos/${caseId}`)}
              className="border border-gray-200 text-gray-600 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Volver al caso
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
        <h3 className="font-semibold text-gray-900">Configuración de la citación</h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Plantilla *</label>
          <select
            required
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
          >
            <option value="">Seleccionar plantilla...</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.nombre}</option>
            ))}
          </select>
          {!templates.length && (
            <p className="text-xs text-amber-600 mt-1">
              No hay plantillas de citación configuradas.{" "}
              <a href="/plantillas" className="underline">Crear plantilla →</a>
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha y hora propuesta</label>
            <input
              type="datetime-local"
              value={fechaAudiencia}
              onChange={(e) => setFechaAudiencia(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
            />
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Mensaje adicional (opcional)
          </label>
          <textarea
            rows={3}
            value={mensajeExtra}
            onChange={(e) => setMensajeExtra(e.target.value)}
            placeholder="Instrucciones adicionales para las partes..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340] resize-none"
          />
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 text-sm text-blue-800">
        <strong>¿Qué pasa al generar la citación?</strong>
        <ul className="mt-2 space-y-1 text-blue-700 list-disc list-inside">
          <li>Se genera el documento Word (.docx) con los datos del caso</li>
          <li>Se envía por correo a todas las partes con el documento adjunto</li>
          <li>El estado del caso cambia a &quot;Citado&quot;</li>
          <li>Queda registrado en el historial del caso</li>
        </ul>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={loading || !templateId}
          className="bg-[#0D2340] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[#0d2340dd] transition-colors disabled:opacity-50"
        >
          {loading ? "Generando y enviando..." : "Generar y enviar citación"}
        </button>
        <a href={`/casos/${caseId}`} className="text-sm text-gray-500 hover:underline">
          Cancelar
        </a>
      </div>
    </form>
  );
}
