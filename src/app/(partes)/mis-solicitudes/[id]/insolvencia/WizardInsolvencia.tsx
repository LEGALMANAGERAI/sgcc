"use client";
import { useState } from "react";
import type { WizardProps } from "../WizardShell";
import { StepSidebar, type StepDef } from "@/components/partes/StepSidebar";
import { AutoSaveIndicator } from "@/components/partes/AutoSaveIndicator";
import { Paso1TipoDeudor } from "./Paso1TipoDeudor";
import { Paso2Supuestos } from "./Paso2Supuestos";
import { Paso3DatosDeudor } from "./Paso3DatosDeudor";
import { Paso4Causas } from "./Paso4Causas";
import { Paso5Acreedores } from "./Paso5Acreedores";
import { Paso6Bienes } from "./Paso6Bienes";
import { Paso7Procesos } from "./Paso7Procesos";
import { Paso8AlimentariasRedam } from "./Paso8AlimentariasRedam";
import { Paso9IngresosGastos } from "./Paso9IngresosGastos";
import { Paso10SociedadConyugal } from "./Paso10SociedadConyugal";
import { Paso11PropuestaPago } from "./Paso11PropuestaPago";
import { Paso12Anexos } from "./Paso12Anexos";
import { Paso13Confirmar } from "./Paso13Confirmar";

const STEP_LABELS = [
  "Tipo de deudor",
  "Supuestos",
  "Datos del deudor",
  "Causas",
  "Acreedores",
  "Bienes",
  "Procesos judiciales",
  "Obligaciones alimentarias",
  "Ingresos y gastos",
  "Sociedad conyugal",
  "Propuesta de pago",
  "Anexos",
  "Confirmar",
];

export function WizardInsolvencia(p: WizardProps) {
  const [_tick, setTick] = useState(0);

  const steps: StepDef[] = STEP_LABELS.map((label, i) => ({
    num: i + 1,
    label,
    done: i + 1 < p.step,
  }));

  const Paso = (() => {
    switch (p.step) {
      case 1: return <Paso1TipoDeudor {...p} />;
      case 2: return <Paso2Supuestos {...p} />;
      case 3: return <Paso3DatosDeudor {...p} />;
      case 4: return <Paso4Causas {...p} />;
      case 5: return <Paso5Acreedores {...p} />;
      case 6: return <Paso6Bienes {...p} />;
      case 7: return <Paso7Procesos {...p} />;
      case 8: return <Paso8AlimentariasRedam {...p} />;
      case 9: return <Paso9IngresosGastos {...p} />;
      case 10: return <Paso10SociedadConyugal {...p} />;
      case 11: return <Paso11PropuestaPago {...p} />;
      case 12: return <Paso12Anexos {...p} />;
      case 13: return <Paso13Confirmar {...p} />;
      default: return <div className="text-gray-500">Paso {p.step} desconocido.</div>;
    }
  })();

  return (
    <>
      <StepSidebar steps={steps} current={p.step} onJump={p.updateStep} />
      <main className="flex-1 p-8 max-w-4xl overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-[#0D2340]">
            Solicitud de insolvencia (Ley 2445/2025)
          </h1>
          <AutoSaveIndicator state={p.autosaveState} lastSavedAt={p.lastSavedAt} />
        </div>
        {Paso}
        <div className="mt-8 flex justify-between">
          {p.step > 1 ? (
            <button
              type="button"
              onClick={() => { p.updateStep(p.step - 1); setTick((t) => t + 1); }}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              ← Anterior
            </button>
          ) : <div />}
          {p.step < 13 && (
            <button
              type="button"
              onClick={() => { p.updateStep(p.step + 1); setTick((t) => t + 1); }}
              className="bg-[#0D2340] text-white px-4 py-2 rounded-lg text-sm"
            >
              Siguiente →
            </button>
          )}
        </div>
      </main>
    </>
  );
}
