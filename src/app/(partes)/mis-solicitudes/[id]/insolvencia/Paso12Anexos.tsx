"use client";
import type { WizardProps } from "../WizardShell";
import type { FormDataInsolvencia } from "@/types/solicitudes";
import { FileUploadBox } from "@/components/partes/FileUploadBox";

export function Paso12Anexos({ draftId, formData, adjuntos, setAdjuntos }: WizardProps) {
  const fd = formData as Partial<FormDataInsolvencia>;
  const requiereMatricula = fd.tipo_deudor === "pequeno_comerciante";
  const fuente = fd.tipo_fuente_ingresos;
  const requiereLiqSC = fd.sociedad_conyugal_estado === "liquidada_menos_2_anios";
  const hayBienes = (fd.bienes ?? []).length > 0;

  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-lg mb-1">Anexos</h2>
      <p className="text-sm text-gray-600 mb-4">
        Documentos requeridos por el Art. 539 Ley 2445/2025. Los marcados con{" "}
        <span className="text-red-600">*</span> son obligatorios.
      </p>

      {/* Obligatorios siempre */}
      <FileUploadBox draftId={draftId} tipoAnexo="cedula" obligatorio adjuntos={adjuntos} onChange={setAdjuntos} />
      <FileUploadBox draftId={draftId} tipoAnexo="redam" obligatorio adjuntos={adjuntos} onChange={setAdjuntos} />

      {/* Certificación de ingresos según fuente */}
      {(fuente === "empleado" || fuente === "mixto") && (
        <FileUploadBox draftId={draftId} tipoAnexo="certif_laboral" obligatorio adjuntos={adjuntos} onChange={setAdjuntos} />
      )}
      {(fuente === "pensionado" || fuente === "mixto") && (
        <FileUploadBox draftId={draftId} tipoAnexo="certif_pension" obligatorio adjuntos={adjuntos} onChange={setAdjuntos} />
      )}
      {(fuente === "independiente" || fuente === "mixto") && (
        <FileUploadBox draftId={draftId} tipoAnexo="declaracion_independiente" obligatorio adjuntos={adjuntos} onChange={setAdjuntos} />
      )}

      {/* Matrícula mercantil para pequeño comerciante */}
      {requiereMatricula && (
        <FileUploadBox draftId={draftId} tipoAnexo="matricula_mercantil" obligatorio adjuntos={adjuntos} onChange={setAdjuntos} />
      )}

      {/* Liquidación de sociedad conyugal reciente */}
      {requiereLiqSC && (
        <FileUploadBox
          draftId={draftId}
          tipoAnexo="liquidacion_sociedad_conyugal"
          obligatorio
          adjuntos={adjuntos}
          onChange={setAdjuntos}
        />
      )}

      {/* Documentos idóneos de bienes (Art. 539 #4) */}
      {hayBienes && (
        <>
          <FileUploadBox draftId={draftId} tipoAnexo="tradicion" adjuntos={adjuntos} onChange={setAdjuntos} />
          <FileUploadBox draftId={draftId} tipoAnexo="documento_bien" adjuntos={adjuntos} onChange={setAdjuntos} />
        </>
      )}

      {/* Opcionales comunes */}
      <FileUploadBox draftId={draftId} tipoAnexo="soporte_acreencia" adjuntos={adjuntos} onChange={setAdjuntos} />
      <FileUploadBox draftId={draftId} tipoAnexo="ingresos_contador" adjuntos={adjuntos} onChange={setAdjuntos} />
      <FileUploadBox draftId={draftId} tipoAnexo="poder" adjuntos={adjuntos} onChange={setAdjuntos} />
      <FileUploadBox draftId={draftId} tipoAnexo="otro" adjuntos={adjuntos} onChange={setAdjuntos} />
    </section>
  );
}
