"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Send,
  Loader2,
  CheckCircle,
  AlertCircle,
  Download,
  Heart,
} from "lucide-react";
import { InsertarClausulaButton } from "@/components/modules/plantillas/InsertarClausulaButton";
import { DatosHeredadosBanner } from "./DatosHeredadosBanner";
import { PanelAsistenciaAudiencia } from "./PanelAsistenciaAudiencia";
import { useContextoAudiencia } from "@/hooks/useContextoAudiencia";
import type { ActaTipo } from "@/types";

interface CrearActaAcuerdoApoyoProps {
  caseId: string;
  hearingId: string;
}

type TipoActaApoyo =
  | "suscripcion_apoyo"
  | "suscripcion_apoyo_modificacion"
  | "suscripcion_apoyo_terminacion"
  | "no_suscripcion_apoyo"
  | "inasistencia";

const TIPOS_ACTA: { value: TipoActaApoyo; label: string; descripcion: string }[] = [
  {
    value: "suscripcion_apoyo",
    label: "Suscripción del acuerdo de apoyo",
    descripcion: "Se formaliza el acuerdo entre el(la) Titular y la Persona de apoyo (Ley 1996/2019)",
  },
  {
    value: "suscripcion_apoyo_modificacion",
    label: "Modificación del acuerdo de apoyo",
    descripcion: "Ajuste a un acuerdo de apoyo ya existente",
  },
  {
    value: "suscripcion_apoyo_terminacion",
    label: "Terminación / revocación del acuerdo",
    descripcion: "El(la) Titular revoca o se termina el acuerdo de apoyo",
  },
  {
    value: "no_suscripcion_apoyo",
    label: "Constancia de NO suscripción",
    descripcion: "El conciliador deja constancia de no ser procedente la suscripción",
  },
  {
    value: "inasistencia",
    label: "Inasistencia",
    descripcion: "El(la) Titular o Persona de apoyo no comparecieron a la audiencia",
  },
];

// Los 3 primeros tipos se mapean a suscripcion_apoyo (mismo tipo en BD, diferentes etiquetas en UI).
// Los tipos *_modificacion y *_terminacion se marcan con un prefijo en consideraciones para distinguirlos.
const TIPO_APOYO_A_ACTA: Record<TipoActaApoyo, ActaTipo> = {
  suscripcion_apoyo: "suscripcion_apoyo",
  suscripcion_apoyo_modificacion: "suscripcion_apoyo",
  suscripcion_apoyo_terminacion: "suscripcion_apoyo",
  no_suscripcion_apoyo: "no_suscripcion_apoyo",
  inasistencia: "inasistencia",
};

export function CrearActaAcuerdoApoyo({ caseId, hearingId }: CrearActaAcuerdoApoyoProps) {
  const { data: contexto, loading, error: contextoError, refresh } = useContextoAudiencia(
    caseId,
    hearingId
  );

  const [tipo, setTipo] = useState<TipoActaApoyo>("suscripcion_apoyo");
  const [autonomia, setAutonomia] = useState("");
  const [consideraciones, setConsideraciones] = useState("");
  const [decisionApoyo, setDecisionApoyo] = useState("");
  const [salvaguardias, setSalvaguardias] = useState("");
  const [generando, setGenerando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [actaCreada, setActaCreada] = useState<any | null>(null);

  useEffect(() => {
    if (!contexto || actaCreada) return;
    const ultima = contexto.ultimaActa;
    if (ultima) {
      setAutonomia(ultima.hechos ?? "");
      setConsideraciones(ultima.consideraciones ?? "");
      setDecisionApoyo(ultima.acuerdo_texto ?? "");
    }
  }, [contexto, actaCreada]);

  async function generarActa() {
    setGenerando(true);
    setApiError(null);
    setExito(null);
    try {
      const tipoLabel = TIPOS_ACTA.find((t) => t.value === tipo)?.label ?? tipo;
      const consideracionesFull = `ACUERDO DE APOYO — LEY 1996 DE 2019 — ${tipoLabel.toUpperCase()}\n\n${consideraciones}`;
      const acuerdoFull = salvaguardias
        ? `${decisionApoyo}\n\nSALVAGUARDIAS Y REVOCABILIDAD:\n${salvaguardias}`
        : decisionApoyo;

      const res = await fetch(`/api/casos/${caseId}/acta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hearing_id: hearingId,
          tipo: TIPO_APOYO_A_ACTA[tipo],
          hechos: autonomia || null,
          consideraciones: consideracionesFull,
          acuerdo_texto: acuerdoFull || null,
          obligaciones: null,
          es_constancia: tipo === "no_suscripcion_apoyo" || tipo === "inasistencia",
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

  const tipoActual = TIPOS_ACTA.find((t) => t.value === tipo);
  const audienciaFinalizada = contexto.audiencia?.estado === "finalizada";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-pink-100">
          <Heart className="w-5 h-5 text-pink-700" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[#0D2340]">
            Acta — Acuerdo de apoyo (Ley 1996/2019)
          </h3>
          <p className="text-sm text-gray-500">
            Capacidad legal plena de personas con discapacidad
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
              Selecciona el tipo de acta, completa los campos y haz clic en Generar acta.
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
                  Puedes editarlos.
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
              onChange={(e) => setTipo(e.target.value as TipoActaApoyo)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F9B]"
            >
              {TIPOS_ACTA.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            {tipoActual && (
              <p className="text-[11px] text-gray-500 mt-1">{tipoActual.descripcion}</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-gray-700">
                Autonomía del titular y relación de confianza
                {tipo === "no_suscripcion_apoyo" && (
                  <span className="ml-2 text-xs text-gray-400 font-normal">
                    (observaciones del conciliador sobre imposibilidad)
                  </span>
                )}
              </label>
              <InsertarClausulaButton
                tipoTramite="acuerdo_apoyo"
                resultado={TIPO_APOYO_A_ACTA[tipo]}
                categoriasPreferidas={["apoyo_decision"]}
                onInsert={(c) => setAutonomia((p) => (p ? p + "\n\n" + c : c))}
              />
            </div>
            <textarea
              value={autonomia}
              onChange={(e) => setAutonomia(e.target.value)}
              rows={4}
              placeholder={
                tipo === "no_suscripcion_apoyo"
                  ? "No fue posible establecer el canal de comunicación necesario para concluir la autonomía y comprensión del titular..."
                  : "El(la) Titular participó de forma autónoma, sin vicios del consentimiento (error, fuerza o dolo). Entre el(la) Titular y el(la) Apoyo existe relación de confianza por [vínculo]..."
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F9B] resize-y"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-gray-700">
                Preámbulo e identificación
              </label>
              <InsertarClausulaButton
                tipoTramite="acuerdo_apoyo"
                resultado={TIPO_APOYO_A_ACTA[tipo]}
                categoriasPreferidas={["preambulo", "identificacion_partes", "consideraciones"]}
                onInsert={(c) => setConsideraciones((p) => (p ? p + "\n\n" + c : c))}
              />
            </div>
            <textarea
              value={consideraciones}
              onChange={(e) => setConsideraciones(e.target.value)}
              rows={4}
              placeholder="Fecha, modalidad (presencial/virtual), identificación del(la) Titular y Persona(s) de apoyo designada(s)..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F9B] resize-y"
            />
          </div>

          {tipo !== "no_suscripcion_apoyo" && tipo !== "inasistencia" && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  Alcance del apoyo + obligaciones (Art. 46 Ley 1996)
                </label>
                <InsertarClausulaButton
                  tipoTramite="acuerdo_apoyo"
                  resultado={TIPO_APOYO_A_ACTA[tipo]}
                  categoriasPreferidas={["apoyo_decision", "obligacion_hacer"]}
                  onInsert={(c) => setDecisionApoyo((p) => (p ? p + "\n\n" + c : c))}
                />
              </div>
              <textarea
                value={decisionApoyo}
                onChange={(e) => setDecisionApoyo(e.target.value)}
                rows={6}
                placeholder="Lista de actos asistidos (EPS, FOMAG, bienes, contratos, productos financieros...) + obligaciones del apoyo según Art. 46 Ley 1996/2019."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F9B] resize-y"
              />
            </div>
          )}

          {(tipo === "suscripcion_apoyo" || tipo === "suscripcion_apoyo_modificacion") && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  Salvaguardas, vigencia y revocabilidad
                </label>
                <InsertarClausulaButton
                  tipoTramite="acuerdo_apoyo"
                  resultado={TIPO_APOYO_A_ACTA[tipo]}
                  categoriasPreferidas={["apoyo_decision", "otro"]}
                  onInsert={(c) => setSalvaguardias((p) => (p ? p + "\n\n" + c : c))}
                />
              </div>
              <textarea
                value={salvaguardias}
                onChange={(e) => setSalvaguardias(e.target.value)}
                rows={4}
                placeholder="Rendición semestral, vigencia (máx 5 años Ley 1996), revocabilidad por WhatsApp o correo electrónico..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F9B] resize-y"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Ley 1996/2019 arts. 11, 32-35: salvaguardias proporcionales y revisables · vigencia máx 5 años · revocable por el(la) Titular en cualquier momento.
              </p>
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={generarActa}
              disabled={generando || !tipo}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#0D2340] hover:bg-[#1B4F9B] rounded-lg disabled:opacity-50"
            >
              {generando ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              {generando ? "Generando acta..." : "Generar acta"}
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
            {enviando ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
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
