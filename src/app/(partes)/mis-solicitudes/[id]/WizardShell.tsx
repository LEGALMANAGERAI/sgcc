"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SolicitudDraft, AdjuntoDraft } from "@/types/solicitudes";
import { useDraftAutoSave } from "@/hooks/useDraftAutoSave";
import { WizardConciliacion } from "./conciliacion/WizardConciliacion";
import { WizardInsolvencia } from "./insolvencia/WizardInsolvencia";

export interface WizardProps {
  draftId: string;
  formData: Record<string, unknown>;
  updateFormData: (patch: Record<string, unknown>) => void;
  step: number;
  updateStep: (n: number) => void;
  adjuntos: AdjuntoDraft[];
  setAdjuntos: (a: AdjuntoDraft[]) => void;
  onRadicado: (caseId: string) => void;
  autosaveState: ReturnType<typeof useDraftAutoSave>["state"];
  lastSavedAt: Date | null;
}

export function WizardShell({
  draft,
  initialAdjuntos,
}: {
  draft: SolicitudDraft;
  initialAdjuntos: AdjuntoDraft[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(draft.step_actual);
  const [formData, setFormData] = useState<Record<string, unknown>>(
    (draft.form_data as Record<string, unknown>) ?? {}
  );
  const [adjuntos, setAdjuntos] = useState<AdjuntoDraft[]>(initialAdjuntos);
  const autosave = useDraftAutoSave({ draftId: draft.id });

  const updateFormData = (patch: Record<string, unknown>) => {
    setFormData((prev) => {
      const next = { ...prev, ...patch };
      autosave.save({ form_data: next });
      return next;
    });
  };
  const updateStep = (n: number) => {
    setStep(n);
    autosave.save({ step_actual: n });
  };

  const wizardProps: WizardProps = {
    draftId: draft.id,
    formData,
    updateFormData,
    step,
    updateStep,
    adjuntos,
    setAdjuntos,
    onRadicado: (caseId: string) => router.push(`/mis-casos/${caseId}`),
    autosaveState: autosave.state,
    lastSavedAt: autosave.lastSavedAt,
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] bg-gray-50 -mx-4 sm:-mx-6 lg:-mx-8 -my-8">
      {draft.tipo_tramite === "conciliacion" && (
        <WizardConciliacion {...wizardProps} />
      )}
      {draft.tipo_tramite === "insolvencia" && (
        <WizardInsolvencia {...wizardProps} />
      )}
      {draft.tipo_tramite !== "conciliacion" &&
        draft.tipo_tramite !== "insolvencia" && (
          <div className="p-8 text-gray-600">
            Este tipo de trámite aún no está disponible. Por ahora solo
            conciliación e insolvencia.
          </div>
        )}
    </div>
  );
}
