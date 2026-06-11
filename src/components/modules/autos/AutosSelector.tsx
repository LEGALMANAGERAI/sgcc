"use client";

import { useState } from "react";
import { GenerarAutoSuspension } from "@/components/modules/autos/GenerarAutoSuspension";
import { GenerarAutoPrimeraAudiencia } from "@/components/modules/autos/GenerarAutoPrimeraAudiencia";

interface AutosSelectorProps {
  caseId: string;
  hearingId: string | null;
}

type TipoAuto = "suspension" | "primera_audiencia";

const TABS: Array<{ key: TipoAuto; label: string }> = [
  { key: "suspension", label: "Suspensión y reprogramación" },
  { key: "primera_audiencia", label: "Primera audiencia" },
];

export function AutosSelector({ caseId, hearingId }: AutosSelectorProps) {
  const [tipo, setTipo] = useState<TipoAuto>("suspension");

  return (
    <div>
      {/* Selector de tipo de auto */}
      <div className="flex gap-2 border-b border-gray-100 pb-3">
        {TABS.map((t) => {
          const active = tipo === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTipo(t.key)}
              aria-pressed={active}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                active
                  ? "bg-[#0D2340] text-white border-[#0D2340]"
                  : "bg-white text-[#1B4F9B] border-gray-200 hover:border-[#1B4F9B]"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tipo === "suspension" ? (
        <GenerarAutoSuspension caseId={caseId} hearingId={hearingId} />
      ) : (
        <GenerarAutoPrimeraAudiencia caseId={caseId} hearingId={hearingId} />
      )}
    </div>
  );
}
