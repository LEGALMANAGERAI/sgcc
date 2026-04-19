"use client";
import type { WizardProps } from "../WizardShell";
import type { FormDataInsolvencia } from "@/types/solicitudes";
import { FileUploadBox } from "@/components/partes/FileUploadBox";

export function Paso12Anexos({ draftId, formData, adjuntos, setAdjuntos }: WizardProps) {
  const fd = formData as Partial<FormDataInsolvencia>;
  const requiereMatricula = fd.tipo_deudor === "pequeno_comerciante";
  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-lg mb-1">Anexos</h2>
      <p className="text-sm text-gray-600 mb-4">
        Documentos requeridos por el Art. 539 Ley 2445/2025. Los marcados con{" "}
        <span className="text-red-600">*</span> son obligatorios.
      </p>

      <FileUploadBox draftId={draftId} tipoAnexo="cedula" obligatorio adjuntos={adjuntos} onChange={setAdjuntos} />
      <FileUploadBox draftId={draftId} tipoAnexo="redam" obligatorio adjuntos={adjuntos} onChange={setAdjuntos} />
      {requiereMatricula && (
        <FileUploadBox draftId={draftId} tipoAnexo="matricula_mercantil" obligatorio adjuntos={adjuntos} onChange={setAdjuntos} />
      )}
      <FileUploadBox draftId={draftId} tipoAnexo="tradicion" adjuntos={adjuntos} onChange={setAdjuntos} />
      <FileUploadBox draftId={draftId} tipoAnexo="soporte_acreencia" adjuntos={adjuntos} onChange={setAdjuntos} />
      <FileUploadBox draftId={draftId} tipoAnexo="ingresos_contador" adjuntos={adjuntos} onChange={setAdjuntos} />
      <FileUploadBox draftId={draftId} tipoAnexo="poder" adjuntos={adjuntos} onChange={setAdjuntos} />
      <FileUploadBox draftId={draftId} tipoAnexo="otro" adjuntos={adjuntos} onChange={setAdjuntos} />
    </section>
  );
}
