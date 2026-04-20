"use client";
import type { WizardProps } from "../WizardShell";
import type { FormDataInsolvencia } from "@/types/solicitudes";
import { FileUploadBox } from "@/components/partes/FileUploadBox";

export function Paso8AlimentariasRedam({
  draftId,
  formData,
  updateFormData,
  adjuntos,
  setAdjuntos,
}: WizardProps) {
  const fd = formData as Partial<FormDataInsolvencia>;
  const oa = fd.obligaciones_alimentarias ?? { tiene: false };

  return (
    <section className="space-y-5">
      <h2 className="font-semibold text-lg">Obligaciones alimentarias y personas a cargo</h2>

      <label className="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={oa.tiene}
          onChange={(e) =>
            updateFormData({
              obligaciones_alimentarias: { ...oa, tiene: e.target.checked },
            })
          }
        />
        Tengo obligaciones alimentarias
      </label>

      {oa.tiene && (
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Beneficiarios (nombre y parentesco)
            </label>
            <textarea
              value={oa.beneficiarios ?? ""}
              onChange={(e) =>
                updateFormData({
                  obligaciones_alimentarias: { ...oa, beneficiarios: e.target.value },
                })
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Monto mensual (COP)
            </label>
            <input
              type="number"
              value={oa.monto_mensual ?? 0}
              onChange={(e) =>
                updateFormData({
                  obligaciones_alimentarias: {
                    ...oa,
                    monto_mensual: Number(e.target.value),
                  },
                })
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Número de personas a cargo
            </label>
            <input
              type="number"
              value={fd.personas_a_cargo ?? 0}
              onChange={(e) =>
                updateFormData({ personas_a_cargo: Number(e.target.value) })
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
      )}

      <div>
        <p className="text-sm text-gray-700 mb-2">
          <strong>Certificado REDAM (obligatorio, Art. 539 #9)</strong> — obténlo en{" "}
          <a
            href="https://srvcnpc.policia.gov.co/PSC/frm_cnp_consulta.aspx"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#1B4F9B] underline"
          >
            el portal de la Policía Nacional
          </a>
          .
        </p>
        <FileUploadBox
          draftId={draftId}
          tipoAnexo="redam"
          obligatorio
          adjuntos={adjuntos}
          onChange={setAdjuntos}
        />
      </div>
    </section>
  );
}
