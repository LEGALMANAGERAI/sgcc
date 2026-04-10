"use client";

import { useState } from "react";
import { VerificarButton } from "./VerificarButton";
import { ApoderadoHistorial } from "./ApoderadoHistorial";
import { History } from "lucide-react";

interface Props {
  attorneyId: string;
  nombre: string;
  verificado: boolean;
}

export function ApoderadosActions({ attorneyId, nombre, verificado }: Props) {
  const [showHistorial, setShowHistorial] = useState(false);

  return (
    <div className="flex items-center justify-end gap-2">
      {!verificado && (
        <VerificarButton attorneyId={attorneyId} nombre={nombre} />
      )}
      <button
        onClick={() => setShowHistorial(true)}
        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#0D2340]/10 text-[#0D2340] hover:bg-[#0D2340]/20 transition-colors"
        title="Ver historial"
      >
        <History className="w-3 h-3" />
        Historial
      </button>

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
