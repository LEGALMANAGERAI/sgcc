"use client";

import { useState } from "react";

export function ConfirmarAsistenciaButton({
  hearingId,
  caseId,
}: {
  hearingId: string;
  caseId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirmar() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/partes/confirmar-asistencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hearing_id: hearingId, case_id: caseId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Error al confirmar asistencia");
        return;
      }

      setConfirmado(true);
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  if (confirmado) {
    return (
      <span className="text-xs text-green-600 font-medium">Confirmada</span>
    );
  }

  return (
    <div>
      <button
        onClick={handleConfirmar}
        disabled={loading}
        className="px-3 py-1.5 bg-[#B8860B] text-white text-xs font-medium rounded-lg hover:bg-[#9a7209] transition-colors disabled:opacity-50"
      >
        {loading ? "Confirmando..." : "Confirmar asistencia"}
      </button>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
