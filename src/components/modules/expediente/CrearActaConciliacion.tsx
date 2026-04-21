"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  FileText,
  Send,
  Plus,
  Trash2,
  Loader2,
  CheckCircle,
  AlertCircle,
  Download,
} from "lucide-react";
import { InsertarClausulaButton } from "@/components/modules/plantillas/InsertarClausulaButton";
import { DatosHeredadosBanner } from "./DatosHeredadosBanner";
import { PanelAsistenciaAudiencia } from "./PanelAsistenciaAudiencia";
import { useContextoAudiencia } from "@/hooks/useContextoAudiencia";
import type { ActaTipo } from "@/types";

interface CrearActaConciliacionProps {
  caseId: string;
  hearingId: string;
}

const TIPOS_ACTA: { value: ActaTipo; label: string }[] = [
  { value: "acuerdo_total", label: "Acuerdo total" },
  { value: "acuerdo_parcial", label: "Acuerdo parcial" },
  { value: "no_acuerdo", label: "Sin acuerdo" },
  { value: "inasistencia", label: "Inasistencia" },
  { value: "desistimiento", label: "Desistimiento" },
  { value: "improcedente", label: "Improcedencia" },
];

interface Obligacion {
  parte: string;
  obligacion: string;
  plazo: string;
  monto: string;
}

export function CrearActaConciliacion({ caseId, hearingId }: CrearActaConciliacionProps) {
  const { data: contexto, loading, error: contextoError, refresh } = useContextoAudiencia(
    caseId,
    hearingId
  );

  const [tipo, setTipo] = useState<ActaTipo>("acuerdo_total");
  const [hechos, setHechos] = useState("");
  const [consideraciones, setConsideraciones] = useState("");
  const [acuerdoTexto, setAcuerdoTexto] = useState("");
  const [obligaciones, setObligaciones] = useState<Obligacion[]>([
    { parte: "", obligacion: "", plazo: "", monto: "" },
  ]);
  const [generando, setGenerando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [actaCreada, setActaCreada] = useState<any | null>(null);

  // Hidratar desde la última acta (heredar consideraciones/acuerdo/obligaciones)
  useEffect(() => {
    if (!contexto) return;
    if (actaCreada) return;
    const ultima = contexto.ultimaActa;
    if (ultima) {
      setTipo(ultima.tipo ?? "acuerdo_total");
      setHechos(ultima.hechos ?? "");
      setConsideraciones(ultima.consideraciones ?? "");
      setAcuerdoTexto(ultima.acuerdo_texto ?? "");
      if (Array.isArray(ultima.obligaciones) && ultima.obligaciones.length > 0) {
        setObligaciones(
          ultima.obligaciones.map((ob: any) => ({
            parte: ob.parte ?? "",
            obligacion: ob.obligacion ?? "",
            plazo: ob.plazo ?? "",
            monto: ob.monto != null ? String(ob.monto) : "",
          }))
        );
      }
    } else if (contexto.caso?.sub_estado) {
      // Pre-seleccionar tipo según resultado de la audiencia (sub_estado del caso)
      const subEstado = contexto.caso.sub_estado as ActaTipo;
      const tiposValidos: ActaTipo[] = [
        "acuerdo_total",
        "acuerdo_parcial",
        "no_acuerdo",
        "inasistencia",
        "desistimiento",
        "improcedente",
      ];
      if (tiposValidos.includes(subEstado)) {
        setTipo(subEstado);
      }
    }
  }, [contexto, actaCreada]);

  const partesSelect = useMemo(() => {
    if (!contexto?.caso?.partes) return [];
    return contexto.caso.partes.map((cp: any) => ({
      id: cp.party?.id ?? cp.id,
      label:
        cp.party?.tipo_persona === "juridica"
          ? cp.party.razon_social ?? "—"
          : [cp.party?.nombres, cp.party?.apellidos].filter(Boolean).join(" ") || "—",
    }));
  }, [contexto]);

  const agregarObligacion = useCallback(() => {
    setObligaciones((prev) => [...prev, { parte: "", obligacion: "", plazo: "", monto: "" }]);
  }, []);
  const eliminarObligacion = useCallback((idx: number) => {
    setObligaciones((prev) => prev.filter((_, i) => i !== idx));
  }, []);
  const actualizarObligacion = useCallback(
    (idx: number, campo: keyof Obligacion, valor: string) => {
      setObligaciones((prev) =>
        prev.map((ob, i) => (i === idx ? { ...ob, [campo]: valor } : ob))
      );
    },
    []
  );

  async function generarActa() {
    setGenerando(true);
    setApiError(null);
    setExito(null);
    try {
      const obligacionesPayload = obligaciones
        .filter((ob) => ob.parte || ob.obligacion)
        .map((ob) => ({
          parte: ob.parte,
          obligacion: ob.obligacion,
          plazo: ob.plazo,
          monto: ob.monto ? parseFloat(ob.monto.replace(/[^0-9.]/g, "")) : undefined,
        }));

      const res = await fetch(`/api/casos/${caseId}/acta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hearing_id: hearingId,
          tipo,
          hechos: hechos || null,
          consideraciones: consideraciones || null,
          acuerdo_texto: acuerdoTexto || null,
          obligaciones: obligacionesPayload.length ? obligacionesPayload : null,
          es_constancia:
            tipo === "inasistencia" || tipo === "desistimiento" || tipo === "improcedente",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Error al generar el acta");
      }

      const data = await res.json();
      setActaCreada(data.acta);
      setExito("Acta generada. Puedes descargar el borrador o enviarla a firma.");
    } catch (err: any) {
      setApiError(err.message ?? "Error inesperado");
    } finally {
      setGenerando(false);
    }
  }

  async function enviarAFirma() {
    if (!actaCreada) return;
    setEnviando(true);
    setApiError(null);
    setExito(null);
    try {
      const res = await fetch(`/api/expediente/${caseId}/acta-firma`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acta_id: actaCreada.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Error al enviar a firma");
      }
      const data = await res.json();
      setExito(`Documento enviado a firma. ID: ${data.firma_documento_id}.`);
      setActaCreada({ ...actaCreada, estado_firma: "firmado_parcial" });
    } catch (err: any) {
      setApiError(err.message ?? "Error inesperado");
    } finally {
      setEnviando(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }
  if (contextoError || !contexto) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-600">
        {contextoError ?? "No se pudo cargar el contexto de la audiencia"}
      </div>
    );
  }

  const muestraObligaciones = tipo === "acuerdo_total" || tipo === "acuerdo_parcial";

  const audienciaFinalizada = contexto.audiencia?.estado === "finalizada";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-100">
          <FileText className="w-5 h-5 text-[#1B4F9B]" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[#0D2340]">Acta de conciliación</h3>
          <p className="text-sm text-gray-500">
            Genera el acta y envíala a firma electrónica
          </p>
        </div>
      </div>

      {audienciaFinalizada && !actaCreada && !contexto.ultimaActa && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-start gap-2">
          <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-800">
              Audiencia finalizada — lista para generar acta
            </p>
            <p className="text-xs text-green-700 mt-0.5">
              El tipo de acta ya está pre-seleccionado según el resultado de la audiencia.
              Completa consideraciones y obligaciones (si aplica) y haz clic en Generar acta.
            </p>
          </div>
        </div>
      )}

      <DatosHeredadosBanner caso={contexto.caso} partes={contexto.caso.partes ?? []} />

      <PanelAsistenciaAudiencia
        caseId={caseId}
        hearingId={hearingId}
        partes={contexto.caso.partes ?? []}
        apoderadosVigentes={contexto.apoderadosVigentes}
        asistenciaInicial={contexto.asistencia}
        historialApoderados={contexto.historialApoderados}
        onGuardado={refresh}
      />

      {actaCreada ? (
        <ActaCreadaCard
          acta={actaCreada}
          onEnviarFirma={enviarAFirma}
          enviando={enviando}
        />
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
          <h4 className="text-sm font-semibold text-[#0D2340] uppercase tracking-wide">
            Datos del acta
          </h4>

          {contexto.ultimaActa && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-start gap-2">
              <FileText className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-blue-700">
                  Datos heredados del acta anterior ({contexto.ultimaActa.numero_acta})
                </p>
                <p className="text-xs text-blue-600 mt-0.5">
                  Puedes editarlos. Los datos del expediente no se reescriben.
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Tipo de acta *
            </label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as ActaTipo)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F9B]"
            >
              {TIPOS_ACTA.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-gray-700">
                Hechos (pretensiones del convocante)
              </label>
              <InsertarClausulaButton
                tipoTramite="conciliacion"
                resultado={tipo}
                categoriasPreferidas={["consideraciones"]}
                label="Insertar estructura"
                onInsert={(c) => setHechos((p) => (p ? p + "\n\n" + c : c))}
              />
            </div>
            <textarea
              value={hechos}
              onChange={(e) => setHechos(e.target.value)}
              rows={5}
              placeholder="PRIMERO: ... SEGUNDO: ... TERCERO: ... (enumera las pretensiones del convocante con ordinales)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F9B] resize-y"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-gray-700">
                Consideraciones
              </label>
              <InsertarClausulaButton
                tipoTramite="conciliacion"
                resultado={tipo}
                categoriasPreferidas={["consideraciones", "preambulo", "identificacion_partes"]}
                onInsert={(c) =>
                  setConsideraciones((p) => (p ? p + "\n\n" + c : c))
                }
              />
            </div>
            <textarea
              value={consideraciones}
              onChange={(e) => setConsideraciones(e.target.value)}
              rows={4}
              placeholder="Antecedentes, contexto y consideraciones relevantes..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F9B] resize-y"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-gray-700">
                Acuerdo / Decisión
              </label>
              <InsertarClausulaButton
                tipoTramite="conciliacion"
                resultado={tipo}
                categoriasPreferidas={[
                  "obligacion_dar",
                  "obligacion_hacer",
                  "obligacion_no_hacer",
                  "garantias",
                  "clausula_penal",
                  "confidencialidad",
                  "desistimiento",
                  "inasistencia",
                  "cierre",
                ]}
                onInsert={(c) => setAcuerdoTexto((p) => (p ? p + "\n\n" + c : c))}
              />
            </div>
            <textarea
              value={acuerdoTexto}
              onChange={(e) => setAcuerdoTexto(e.target.value)}
              rows={4}
              placeholder="Descripción del acuerdo alcanzado o decisión..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F9B] resize-y"
            />
          </div>

          {muestraObligaciones && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-gray-700">
                  Obligaciones pactadas
                </label>
                <button
                  type="button"
                  onClick={agregarObligacion}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1B4F9B] bg-blue-50 hover:bg-blue-100 rounded-lg"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar
                </button>
              </div>

              <div className="space-y-3">
                <div className="hidden md:grid grid-cols-[1fr_1fr_0.7fr_0.7fr_auto] gap-2 text-xs font-semibold text-gray-500 px-1">
                  <span>Parte obligada</span>
                  <span>Obligación</span>
                  <span>Plazo</span>
                  <span>Monto</span>
                  <span className="w-8" />
                </div>

                {obligaciones.map((ob, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 md:grid-cols-[1fr_1fr_0.7fr_0.7fr_auto] gap-2 items-start bg-gray-50 rounded-lg p-3 md:p-2"
                  >
                    <select
                      value={ob.parte}
                      onChange={(e) => actualizarObligacion(idx, "parte", e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1B4F9B]"
                    >
                      <option value="">Seleccionar parte...</option>
                      {partesSelect.map((p: any) => (
                        <option key={p.id} value={p.label}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={ob.obligacion}
                      onChange={(e) => actualizarObligacion(idx, "obligacion", e.target.value)}
                      placeholder="Descripción..."
                      className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1B4F9B]"
                    />
                    <input
                      type="text"
                      value={ob.plazo}
                      onChange={(e) => actualizarObligacion(idx, "plazo", e.target.value)}
                      placeholder="30 días"
                      className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1B4F9B]"
                    />
                    <input
                      type="text"
                      value={ob.monto}
                      onChange={(e) => actualizarObligacion(idx, "monto", e.target.value)}
                      placeholder="$0"
                      className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1B4F9B]"
                    />
                    <button
                      type="button"
                      onClick={() => eliminarObligacion(idx)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={generarActa}
              disabled={generando || !tipo}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#0D2340] hover:bg-[#1B4F9B] rounded-lg disabled:opacity-50"
            >
              {generando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              {generando ? "Generando..." : "Generar acta"}
            </button>
          </div>
        </div>
      )}

      {apiError && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
          <p className="text-sm text-red-600">{apiError}</p>
        </div>
      )}
      {exito && (
        <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-lg p-4">
          <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
          <p className="text-sm text-green-700">{exito}</p>
        </div>
      )}
    </div>
  );
}

function ActaCreadaCard({
  acta,
  onEnviarFirma,
  enviando,
}: {
  acta: any;
  onEnviarFirma: () => void;
  enviando: boolean;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-[#0D2340] uppercase tracking-wide">
          Acta generada
        </h4>
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
            acta.estado_firma === "firmado_completo"
              ? "bg-green-100 text-green-800"
              : acta.estado_firma === "firmado_parcial"
              ? "bg-yellow-100 text-yellow-800"
              : "bg-gray-100 text-gray-700"
          }`}
        >
          {acta.estado_firma === "firmado_completo"
            ? "Firmada"
            : acta.estado_firma === "firmado_parcial"
            ? "En firma"
            : "Pendiente"}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-xs text-gray-500">N.º Acta</p>
          <p className="font-medium text-[#0D2340]">{acta.numero_acta ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Tipo</p>
          <p className="font-medium text-[#0D2340]">{acta.tipo}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Fecha</p>
          <p className="font-medium text-[#0D2340]">
            {acta.fecha_acta
              ? new Date(acta.fecha_acta).toLocaleDateString("es-CO")
              : "—"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 pt-2">
        {acta.borrador_url && (
          <a
            href={acta.borrador_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#1B4F9B] bg-blue-50 hover:bg-blue-100 rounded-lg"
          >
            <Download className="w-4 h-4" />
            Descargar borrador
          </a>
        )}

        {acta.estado_firma === "pendiente" && (
          <button
            onClick={onEnviarFirma}
            disabled={enviando}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#0D2340] hover:bg-[#1B4F9B] rounded-lg disabled:opacity-50"
          >
            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar a firma electrónica
          </button>
        )}

        {acta.acta_firmada_url && (
          <a
            href={acta.acta_firmada_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg"
          >
            <CheckCircle className="w-4 h-4" />
            Descargar acta firmada
          </a>
        )}
      </div>
    </div>
  );
}
