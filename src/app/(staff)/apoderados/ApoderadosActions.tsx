"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { VerificarButton } from "./VerificarButton";
import { ApoderadoHistorial } from "./ApoderadoHistorial";
import { History, Trash2, Loader2 } from "lucide-react";

interface Props {
  attorneyId: string;
  nombre: string;
  verificado: boolean;
}

export function ApoderadosActions({ attorneyId, nombre, verificado }: Props) {
  const router = useRouter();
  const [showHistorial, setShowHistorial] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function eliminar() {
    if (
      !confirm(
        `¿Eliminar a ${nombre} de la lista de apoderados? Sus vinculaciones activas en el centro se marcarán como inactivas. El historial queda intacto.`
      )
    ) {
      return;
    }
    setError(null);
    setEliminando(true);
    try {
      const res = await fetch(`/api/apoderados/${attorneyId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al eliminar");
      }
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Error");
    } finally {
      setEliminando(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {!verificado && <VerificarButton attorneyId={attorneyId} nombre={nombre} />}
      <button
        onClick={() => setShowHistorial(true)}
        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#0D2340]/10 text-[#0D2340] hover:bg-[#0D2340]/20 transition-colors"
        title="Ver historial"
      >
        <History className="w-3 h-3" />
        Historial
      </button>
      <button
        onClick={eliminar}
        disabled={eliminando}
        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-60"
        title="Eliminar (desvincular del centro)"
      >
        {eliminando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
        Eliminar
      </button>
      {error && <span className="text-[10px] text-red-600">{error}</span>}

      {showHistorial && (
        <ApoderadoHistorial
          attorneyId={attorneyId}
          nombre={nombre}
          onClose={() => setShowHistorial(false)}
        />
      )}
    </div>
  );
}
