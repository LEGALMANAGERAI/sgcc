"use client";
import { useCallback, useEffect, useState } from "react";
import type { WizardProps } from "../WizardShell";
import type { FormDataInsolvencia } from "@/types/solicitudes";
import { validarInsolvencia } from "@/lib/solicitudes/validators";
import { JURAMENTO_TEXTO } from "@/lib/solicitudes/constants";
import { formatearFechaCorteLarga } from "@/lib/solicitudes/fecha-corte";

type EstadoFirma = "no_iniciada" | "pendiente" | "enviado" | "visto" | "firmado" | "rechazado" | "expirado";

interface FirmaEstadoResp {
  estado: EstadoFirma;
  pdf_url: string | null;
  firmado_url: string | null;
  firmada_at: string | null;
  firmante_token: string | null;
}

export function Paso13Confirmar({
  draftId,
  formData,
  updateFormData,
  adjuntos,
  onRadicado,
}: WizardProps) {
  const fd = formData as Partial<FormDataInsolvencia>;
  const [preparando, setPreparando] = useState(false);
  const [radicando, setRadicando] = useState(false);
  const [errores, setErrores] = useState<string[]>([]);
  const [firma, setFirma] = useState<FirmaEstadoResp | null>(null);

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
    if (!firma.firmante_token) return;
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

    // Validación previa (sin el juramento, que se marca aquí)
    const val = validarInsolvencia(fd, adjuntos).filter(
      (e) => !/juramento/i.test(e.message)
    );
    if (val.length) {
      setErrores(val.map((e) => e.message));
      setPreparando(false);
      return;
    }
    if (!fd.juramento_aceptado) {
      setErrores(["Debes aceptar el juramento antes de generar el documento."]);
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

  async function radicar() {
    setRadicando(true);
    setErrores([]);
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

  const yaFirmado = firma?.estado === "firmado" && !!firma.firmado_url;
  const documentoGenerado = !!firma?.pdf_url;

  return (
    <section className="space-y-5">
      <h2 className="font-semibold text-lg">Confirmar, firmar y radicar</h2>

      {/* Resumen */}
      <div className="rounded-lg border border-gray-200 p-4 text-sm space-y-1">
        <p>
          <strong>Tipo de deudor:</strong> {fd.tipo_deudor ?? "—"}
        </p>
        <p>
          <strong>Fecha de corte:</strong>{" "}
          {fd.fecha_corte ? formatearFechaCorteLarga(fd.fecha_corte) : "—"}
        </p>
        <p>
          <strong>Acreedores:</strong> {fd.acreedores?.length ?? 0}
        </p>
        <p>
          <strong>Bienes:</strong> {fd.bienes?.length ?? 0}
        </p>
        <p>
          <strong>Procesos judiciales:</strong> {fd.procesos?.length ?? 0}
        </p>
        <p>
          <strong>Anexos cargados:</strong> {adjuntos.length}
        </p>
      </div>

      {/* Juramento */}
      <label className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-4 cursor-pointer">
        <input
          type="checkbox"
          checked={!!fd.juramento_aceptado}
          onChange={(e) => updateFormData({ juramento_aceptado: e.target.checked })}
          className="mt-1"
        />
        <span className="text-sm text-amber-900">{JURAMENTO_TEXTO}</span>
      </label>

      <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={!!fd.solicita_tarifa_especial}
          onChange={(e) => updateFormData({ solicita_tarifa_especial: e.target.checked })}
        />
        Solicito tarifa especial según el Art. 536 Ley 1564/2012
      </label>

      {/* Paso 1: generar PDF */}
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
          Generamos un PDF a tu nombre con toda la información de la solicitud
          (Art. 539 Ley 2445/2025). Al regenerarlo se reemplaza cualquier firma
          previa.
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

      {/* Paso 2: firmar */}
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
          La firma electrónica se realiza con verificación OTP por correo, en
          cumplimiento de la Ley 527 de 1999 y el Decreto 2364 de 2012. Se abre
          en una ventana separada; cuando termines, esta pantalla se actualizará
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
        ) : firma?.firmante_token ? (
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={`/firmar/${firma.firmante_token}`}
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

      {/* Paso 3: radicar */}
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
          Solo disponible después de firmar. Al radicar se asignará un número
          consecutivo y tu solicitud quedará a disposición del centro de
          conciliación.
        </p>
        <button
          type="button"
          disabled={!yaFirmado || radicando || !fd.juramento_aceptado}
          onClick={radicar}
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
  );
}
