"use client";
import { useCallback, useEffect, useState } from "react";
import type { WizardProps } from "../WizardShell";
import { StepSidebar, type StepDef } from "@/components/partes/StepSidebar";
import { AutoSaveIndicator } from "@/components/partes/AutoSaveIndicator";
import { PersonaForm } from "@/components/partes/PersonaForm";
import { RepeatableList } from "@/components/partes/RepeatableList";
import { FileUploadBox } from "@/components/partes/FileUploadBox";
import { validarConciliacion } from "@/lib/solicitudes/validators";
import type {
  FormDataConciliacion,
  PersonaFormData,
} from "@/types/solicitudes";

type EstadoFirma =
  | "no_iniciada"
  | "pendiente"
  | "enviado"
  | "visto"
  | "firmado"
  | "rechazado"
  | "expirado";

interface FirmaEstadoResp {
  estado: EstadoFirma;
  pdf_url: string | null;
  firmado_url: string | null;
  firmada_at: string | null;
  firmante_token: string | null;
  signing_url: string | null;
}

const emptyPersona = (): PersonaFormData => ({
  tipo_persona: "natural",
  email: "",
});

const MATERIAS: [string, string][] = [
  ["civil", "Civil"],
  ["comercial", "Comercial"],
  ["laboral", "Laboral"],
  ["familiar", "Familiar"],
  ["consumidor", "Consumidor"],
  ["arrendamiento", "Arrendamiento"],
  ["otro", "Otro"],
];

export function WizardConciliacion({
  draftId,
  formData,
  updateFormData,
  step,
  updateStep,
  adjuntos,
  setAdjuntos,
  onRadicado,
  autosaveState,
  lastSavedAt,
}: WizardProps) {
  const fd = formData as Partial<FormDataConciliacion>;
  const [radicando, setRadicando] = useState(false);
  const [errores, setErrores] = useState<string[]>([]);
  const [firma, setFirma] = useState<FirmaEstadoResp | null>(null);
  const [preparando, setPreparando] = useState(false);

  const cargarEstadoFirma = useCallback(async () => {
    const res = await fetch(`/api/partes/solicitudes/${draftId}/firma-estado`);
    if (res.ok) {
      const data = (await res.json()) as FirmaEstadoResp;
      setFirma(data);
    }
  }, [draftId]);

  useEffect(() => {
    cargarEstadoFirma();
  }, [cargarEstadoFirma]);

  // Polling mientras esperamos la firma (cada 4s, y cuando la ventana vuelve a estar visible).
  useEffect(() => {
    if (!firma) return;
    if (firma.estado === "firmado") return;
    if (!firma.signing_url && !firma.firmante_token) return;
    const t = window.setInterval(cargarEstadoFirma, 4000);
    const onFocus = () => cargarEstadoFirma();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [firma, cargarEstadoFirma]);

  async function prepararFirma() {
    setPreparando(true);
    setErrores([]);
    const valErrors = validarConciliacion(fd);
    if (valErrors.length) {
      setErrores(valErrors.map((e) => e.message));
      setPreparando(false);
      return;
    }
    if (!fd.acepta_terminos) {
      setErrores(["Debes aceptar los términos antes de generar el documento."]);
      setPreparando(false);
      return;
    }
    const res = await fetch(`/api/partes/solicitudes/${draftId}/preparar-firma`, {
      method: "POST",
    });
    const data = await res.json();
    setPreparando(false);
    if (!res.ok) {
      setErrores(
        data.errors?.map((e: { message: string }) => e.message) ?? [
          data.error ?? "Error generando el documento",
        ]
      );
      return;
    }
    await cargarEstadoFirma();
  }

  const steps: StepDef[] = [
    { num: 1, label: "Convocado(s)", done: (fd.convocados ?? []).length > 0 },
    {
      num: 2,
      label: "Materia y hechos",
      done: !!fd.materia && !!fd.descripcion,
    },
    { num: 3, label: "Anexos", done: adjuntos.length > 0 },
    {
      num: 4,
      label: "Apoderado",
      done: fd.apoderado === undefined || !!fd.apoderado?.email,
    },
    { num: 5, label: "Confirmar", done: !!fd.acepta_terminos },
  ];

  const yaFirmado = firma?.estado === "firmado" && !!firma.firmado_url;
  const documentoGenerado = !!firma?.pdf_url;

  async function radicar() {
    setRadicando(true);
    setErrores([]);
    const valErrors = validarConciliacion(fd);
    if (valErrors.length) {
      setErrores(valErrors.map((e) => e.message));
      setRadicando(false);
      return;
    }
    const res = await fetch(`/api/partes/solicitudes/${draftId}/radicar`, {
      method: "POST",
    });
    const data = await res.json();
    setRadicando(false);
    if (!res.ok) {
      setErrores(
        data.errors?.map((e: { message: string }) => e.message) ?? [
          data.error ?? "Error al radicar",
        ]
      );
      return;
    }
    onRadicado(data.case_id);
  }

  return (
    <>
      <StepSidebar steps={steps} current={step} onJump={updateStep} />
      <main className="flex-1 p-8 max-w-3xl overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-[#0D2340]">
            Solicitud de conciliación
          </h1>
          <AutoSaveIndicator state={autosaveState} lastSavedAt={lastSavedAt} />
        </div>

        {step === 1 && (
          <section>
            <h2 className="font-semibold mb-4">Convocado(s)</h2>
            <p className="text-sm text-gray-600 mb-4">
              Datos de la(s) persona(s) contra quien(es) presentas la solicitud.
            </p>
            <RepeatableList<PersonaFormData>
              items={fd.convocados ?? [emptyPersona()]}
              onChange={(convocados) => updateFormData({ convocados })}
              makeEmpty={emptyPersona}
              addLabel="Agregar otro convocado"
              minItems={1}
              renderItem={(p, _i, onC) => (
                <PersonaForm value={p} onChange={onC} />
              )}
            />
          </section>
        )}

        {step === 2 && (
          <section className="space-y-4">
            <h2 className="font-semibold">Materia y hechos</h2>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Materia *
              </label>
              <select
                value={fd.materia ?? ""}
                onChange={(e) =>
                  updateFormData({ materia: e.target.value as FormDataConciliacion["materia"] })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Selecciona…</option>
                {MATERIAS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Cuantía (COP)
              </label>
              <input
                type="number"
                value={fd.cuantia ?? ""}
                onChange={(e) =>
                  updateFormData({
                    cuantia: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                disabled={fd.cuantia_indeterminada}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-100"
              />
              <label className="mt-2 inline-flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={!!fd.cuantia_indeterminada}
                  onChange={(e) =>
                    updateFormData({
                      cuantia_indeterminada: e.target.checked,
                      cuantia: e.target.checked ? undefined : fd.cuantia,
                    })
                  }
                />
                Cuantía indeterminada
              </label>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Descripción del conflicto *
              </label>
              <textarea
                value={fd.descripcion ?? ""}
                onChange={(e) => updateFormData({ descripcion: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[140px]"
                placeholder="Describe los hechos y la pretensión de tu solicitud…"
              />
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-3">
            <h2 className="font-semibold mb-2">
              Anexos (opcional para conciliación)
            </h2>
            <FileUploadBox
              draftId={draftId}
              tipoAnexo="cedula"
              adjuntos={adjuntos}
              onChange={setAdjuntos}
            />
            <FileUploadBox
              draftId={draftId}
              tipoAnexo="soporte_acreencia"
              adjuntos={adjuntos}
              onChange={setAdjuntos}
            />
            <FileUploadBox
              draftId={draftId}
              tipoAnexo="otro"
              adjuntos={adjuntos}
              onChange={setAdjuntos}
            />
          </section>
        )}

        {step === 4 && (
          <section>
            <h2 className="font-semibold mb-4">¿Actúas con apoderado?</h2>
            <label className="inline-flex items-center gap-2 text-sm mb-4">
              <input
                type="checkbox"
                checked={!!fd.apoderado}
                onChange={(e) =>
                  updateFormData({
                    apoderado: e.target.checked ? emptyPersona() : undefined,
                  })
                }
              />
              Sí, tengo apoderado
            </label>
            {fd.apoderado && (
              <>
                <PersonaForm
                  value={fd.apoderado}
                  onChange={(patch) =>
                    updateFormData({
                      apoderado: { ...(fd.apoderado ?? emptyPersona()), ...patch },
                    })
                  }
                />
                {fd.apoderado.tipo_persona === "natural" && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Tarjeta profesional
                    </label>
                    <input
                      value={fd.apoderado.tarjeta_profesional ?? ""}
                      onChange={(e) =>
                        updateFormData({
                          apoderado: {
                            ...(fd.apoderado ?? emptyPersona()),
                            tarjeta_profesional: e.target.value,
                          },
                        })
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                )}
                <div className="mt-4">
                  <FileUploadBox
                    draftId={draftId}
                    tipoAnexo="poder"
                    adjuntos={adjuntos}
                    onChange={setAdjuntos}
                    obligatorio
                  />
                </div>
              </>
            )}
          </section>
        )}

        {step === 5 && (
          <section className="space-y-5">
            <h2 className="font-semibold text-lg">Confirmar, firmar y radicar</h2>

            {/* Resumen */}
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 text-sm text-gray-700 space-y-1">
              <p>
                <strong>Materia:</strong> {fd.materia ?? "—"}
              </p>
              <p>
                <strong>Cuantía:</strong>{" "}
                {fd.cuantia_indeterminada
                  ? "Indeterminada"
                  : fd.cuantia
                  ? `$${fd.cuantia.toLocaleString("es-CO")}`
                  : "—"}
              </p>
              <p>
                <strong>Convocados:</strong> {(fd.convocados ?? []).length}
              </p>
              <p>
                <strong>Anexos:</strong> {adjuntos.length}
              </p>
              <p>
                <strong>Apoderado:</strong> {fd.apoderado ? "Sí" : "No"}
              </p>
            </div>

            {/* Aceptar términos */}
            <label className="inline-flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={!!fd.acepta_terminos}
                onChange={(e) =>
                  updateFormData({ acepta_terminos: e.target.checked })
                }
                className="mt-1"
              />
              <span>
                Acepto los términos y condiciones y autorizo el tratamiento de
                mis datos personales conforme a la Ley 1581 de 2012.
              </span>
            </label>

            {/* Sub-bloque 1: Generar documento */}
            <div className="rounded-lg border border-gray-200 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs ${
                    documentoGenerado ? "bg-emerald-600" : "bg-gray-400"
                  }`}
                >
                  1
                </div>
                <h3 className="font-medium text-[#0D2340]">Generar documento</h3>
              </div>
              <p className="text-sm text-gray-600">
                Generamos un PDF con toda la información de tu solicitud de
                conciliación (Ley 527 de 1999). Al regenerarlo se reemplaza
                cualquier firma previa.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={prepararFirma}
                  disabled={preparando || yaFirmado}
                  className="bg-[#0D2340] text-white px-4 py-2 rounded-lg text-sm disabled:opacity-40"
                >
                  {preparando
                    ? "Generando…"
                    : documentoGenerado
                    ? "Regenerar documento"
                    : "Generar documento"}
                </button>
                {firma?.pdf_url && (
                  <a
                    href={firma.pdf_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-[#1B4F9B] underline"
                  >
                    Ver PDF original
                  </a>
                )}
              </div>
            </div>

            {/* Sub-bloque 2: Firmar electrónicamente */}
            <div className="rounded-lg border border-gray-200 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs ${
                    yaFirmado
                      ? "bg-emerald-600"
                      : documentoGenerado
                      ? "bg-[#0D2340]"
                      : "bg-gray-400"
                  }`}
                >
                  2
                </div>
                <h3 className="font-medium text-[#0D2340]">Firmar electrónicamente</h3>
              </div>
              <p className="text-sm text-gray-600">
                La firma se realiza en el portal seguro de Legal Manager
                (verificación OTP + foto, Ley 527 de 1999). Se abre en una
                ventana separada; cuando termines, esta pantalla se actualizará
                automáticamente.
              </p>

              {yaFirmado ? (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900 flex flex-wrap items-center gap-3">
                  <span>
                    ✓ Documento firmado
                    {firma?.firmada_at
                      ? ` el ${new Date(firma.firmada_at).toLocaleString("es-CO")}`
                      : ""}
                    .
                  </span>
                  {firma?.firmado_url && (
                    <a
                      href={firma.firmado_url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      Ver PDF firmado
                    </a>
                  )}
                </div>
              ) : firma?.signing_url || firma?.firmante_token ? (
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href={firma.signing_url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-[#1B4F9B] text-white px-4 py-2 rounded-lg text-sm"
                  >
                    Abrir firma →
                  </a>
                  <button
                    type="button"
                    onClick={cargarEstadoFirma}
                    className="text-sm text-gray-600 underline"
                  >
                    Actualizar estado
                  </button>
                  {firma.estado && firma.estado !== "enviado" && (
                    <span className="text-xs text-gray-500">
                      Estado actual: {firma.estado}
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  Primero genera el documento para habilitar la firma.
                </p>
              )}
            </div>

            {/* Sub-bloque 3: Radicar */}
            <div className="rounded-lg border border-gray-200 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs ${
                    yaFirmado ? "bg-[#0D2340]" : "bg-gray-400"
                  }`}
                >
                  3
                </div>
                <h3 className="font-medium text-[#0D2340]">Radicar la solicitud</h3>
              </div>
              <p className="text-sm text-gray-600">
                Solo disponible después de firmar. Al radicar se asignará un
                número consecutivo y tu solicitud quedará a disposición del
                centro de conciliación.
              </p>
              <button
                type="button"
                onClick={radicar}
                disabled={radicando || !fd.acepta_terminos || !yaFirmado}
                className="bg-[#0D2340] text-white px-6 py-2.5 rounded-lg disabled:opacity-40 text-sm font-medium"
              >
                {radicando ? "Radicando…" : "Radicar solicitud"}
              </button>
            </div>

            {errores.length > 0 && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                <ul className="list-disc pl-5">
                  {errores.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        <div className="mt-8 flex justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => updateStep(step - 1)}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              ← Anterior
            </button>
          ) : (
            <div />
          )}
          {step < 5 && (
            <button
              type="button"
              onClick={() => updateStep(step + 1)}
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
