"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  attorneyId: string;
  nombre: string;
}

export function VerificarButton({ attorneyId, nombre }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleVerificar() {
    if (!confirm(`¿Verificar al apoderado "${nombre}"? Esta acción confirma que su tarjeta profesional y documentos han sido validados.`)) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/apoderados/${attorneyId}/verificar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificado: true }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Error al verificar apoderado");
        return;
      }

      router.refresh();
    } catch {
      alert("Error de conexión al verificar apoderado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleVerificar}
      disabled={loading}
      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? "Verificando..." : "Verificar"}
    </button>
  );
}
