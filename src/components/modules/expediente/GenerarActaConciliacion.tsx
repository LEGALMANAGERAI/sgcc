"use client";

import { useState } from "react";
import {
  FileText,
  Send,
  Loader2,
  CheckCircle,
  AlertCircle,
  Download,
  Hash,
  Calendar,
  User,
  Briefcase,
  Users,
} from "lucide-react";
import { InsertarClausulaButton } from "@/components/modules/plantillas/InsertarClausulaButton";
import type { ActaTipo } from "@/types";

interface Props {
  caseId: string;
  radicado: string;
  convocante: { nombre: string; documento: string; email: string };
  convocados: { nombre: string; documento: string; email: string }[];
  conciliador: { id: string; nombre: string; tarjeta?: string; codigo?: string } | null;
  apoderados: { nombre: string; parte: string }[];
  hearingId: string | null;
  fechaAudiencia: string | null;
  modalidad: "presencial" | "virtual" | "mixta" | null;
  actaExistente: any | null;
}

type TipoActaConciliacion =
  | "acuerdo_total"
  | "acuerdo_parcial"
  | "no_acuerdo"
  | "inasistencia"
  | "desistimiento";

const TIPOS: { value: TipoActaConciliacion; label: string }[] = [
  { value: "acuerdo_total", label: "Acuerdo total" },
  { value: "acuerdo_parcial", label: "Acuerdo parcial" },
  { value: "no_acuerdo", label: "No acuerdo" },
  { value: "inasistencia", label: "Inasistencia" },
  { value: "desistimiento", label: "Desistimiento" },
];

export function GenerarActaConciliacion({
  caseId,
  radicado,
  convocante,
  convocados,
  conciliador,
  apoderados,
  hearingId,
  fechaAudiencia,
  modalidad,
  actaExistente,
}: Props) {
  const [tipo, setTipo] = useState<TipoActaConciliacion>("acuerdo_total");
  const [hechos, setHechos] = useState("");
  const [consideraciones, setConsideraciones] = useState("");
  const [acuerdoTexto, setAcuerdoTexto] = useState("");
  const [generando, setGenerando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [acta, setActa] = useState<any | null>(actaExistente);

  async function generar() {
    setGenerando(true);
    setError(null);
    setExito(null);
    try {
      const res = await fetch(`/api/casos/${caseId}/acta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hearing_id: hearingId,
          tipo,
          hechos: hechos || null,
          consideraciones: consideraciones || null,
          acuerdo_texto: acuerdoTexto || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al generar el acta");
      setActa(data.acta);
      setExito("Acta generada. Puede descargar el borrador o enviar a firma.");
    } catch (e: any) {
      setError(e.message ?? "Error inesperado");
    } finally {
      setGenerando(false);
    }
  }

  async function enviarFirma() {
    if (!acta) return;
    setEnviando(true);
    setError(null);
    setExito(null);
    try {
      const res = await fetch(`/api/expediente/${caseId}/acta-firma`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acta_id: acta.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al enviar a firma");
      setExito(`Enviado a firma electrónica. ID: ${data.firma_documento_id}`);
      setActa({ ...acta, estado_firma: "firmado_parcial" });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  const resultadoActaTipo: ActaTipo = tipo;
  const fechaTxt = fechaAudiencia
    ? new Date(fechaAudiencia).toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short" })
    : "Sin programar";
  const modalidadLabel =
    modalidad === "virtual" ? "Virtual" : modalidad === "mixta" ? "Mixta" : modalidad === "presencial" ? "Presencial" : "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-100">
          <FileText className="w-5 h-5 text-[#1B4F9B]" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[#0D2340]">Acta de Audiencia de Conciliación</h3>
          <p className="text-sm text-gray-500">Estructura: preámbulo · asistencia · hechos · consideraciones · acuerdo · cierre</p>
        </div>
      </div>

      {/* Datos pre-llenados */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h4 className="text-sm font-semibold text-[#0D2340] uppercase tracking-wide">Datos del Trámite</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex items-start gap-3">
            <Hash className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <div><p className="text-xs text-gray-500">Radicado</p><p className="font-medium">{radicado}</p></div>
          </div>
          <div className="flex items-start gap-3">
            <Calendar className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Fecha · Modalidad</p>
              <p className="font-medium">{fechaTxt} · {modalidadLabel}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <User className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Convocante</p>
              <p className="font-medium">{convocante.nombre}</p>
              <p className="text-xs text-gray-400">{convocante.documento} · {convocante.email}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Briefcase className="w-4 h-4 text-[#1B4F9B] mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Conciliador</p>
              {conciliador ? (
                <>
                  <p className="font-medium">{conciliador.nombre}</p>
                  <p className="text-xs text-gray-400">
                    T.P. {conciliador.tarjeta ?? "—"}
                    {conciliador.codigo ? ` · Código ${conciliador.codigo}` : ""}
                  </p>
                </>
              ) : <p className="text-gray-400 italic">Sin asignar</p>}
            </div>
          </div>
        </div>

        {convocados.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-gray-400" />
              <p className="text-xs text-gray-500 font-medium">Convocado(s) ({convocados.length})</p>
            </div>
            <div className="space-y-1.5">
              {convocados.map((c, i) => (
                <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2 text-sm">
                  <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  <div>
                    <p className="font-medium text-[#0D2340]">{c.nombre}</p>
                    <p className="text-xs text-gray-400">{c.documento} · {c.email}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {apoderados.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 font-medium mb-2">Apoderados</p>
            <div className="space-y-1">
              {apoderados.map((a, i) => (
                <p key={i} className="text-xs text-gray-700">
                  <span className="font-medium">{a.nombre}</span>
                  <span className="text-gray-400"> — apoderado(a) de {a.parte}</span>
                </p>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Acta existente */}
      {acta && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-[#0D2340] uppercase tracking-wide">Acta generada</h4>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
              acta.estado_firma === "firmado_completo" ? "bg-green-100 text-green-800" :
              acta.estado_firma === "firmado_parcial" ? "bg-yellow-100 text-yellow-800" :
              "bg-gray-100 text-gray-700"
            }`}>
              {acta.estado_firma === "firmado_completo" ? "Firmada" :
               acta.estado_firma === "firmado_parcial" ? "En firma" : "Pendiente de firma"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div><p className="text-xs text-gray-500">N.º Acta</p><p className="font-medium">{acta.numero_acta ?? "—"}</p></div>
            <div><p className="text-xs text-gray-500">Tipo</p><p className="font-medium">{acta.tipo}</p></div>
            <div><p className="text-xs text-gray-500">Fecha</p><p className="font-medium">
              {acta.fecha_acta ? new Date(acta.fecha_acta).toLocaleDateString("es-CO") : "—"}
            </p></div>
          </div>
          <div className="flex flex-wrap gap-3 pt-2">
            {acta.borrador_url && (
              <a href={acta.borrador_url} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#1B4F9B] bg-blue-50 hover:bg-blue-100 rounded-lg">
                <Download className="w-4 h-4" /> Descargar borrador
              </a>
            )}
            {acta.estado_firma === "pendiente" && (
              <button onClick={enviarFirma} disabled={enviando}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#0D2340] hover:bg-[#1B4F9B] rounded-lg disabled:opacity-50">
                {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Enviar a firma electrónica
              </button>
            )}
            {acta.acta_firmada_url && (
              <a href={acta.acta_firmada_url} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg">
                <CheckCircle className="w-4 h-4" /> Descargar firmada
              </a>
            )}
          </div>
        </div>
      )}

      {/* Form */}
      {!acta && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
          <h4 className="text-sm font-semibold text-[#0D2340] uppercase tracking-wide">Generar nueva acta</h4>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo de resultado *</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoActaConciliacion)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F9B]">
              {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-gray-700">Hechos (pretensiones)</label>
              <InsertarClausulaButton
                tipoTramite="conciliacion"
                resultado={resultadoActaTipo}
                categoriasPreferidas={["consideraciones"]}
                label="Insertar estructura"
                onInsert={(c) => setHechos((p) => (p ? p + "\n\n" + c : c))}
              />
            </div>
            <textarea value={hechos} onChange={(e) => setHechos(e.target.value)} rows={5}
              placeholder="PRIMERO: ... SEGUNDO: ... (pretensiones del convocante)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F9B] resize-y" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-gray-700">Preámbulo + consideraciones</label>
              <InsertarClausulaButton
                tipoTramite="conciliacion"
                resultado={resultadoActaTipo}
                categoriasPreferidas={["preambulo", "consideraciones", "identificacion_partes", "confidencialidad"]}
                onInsert={(c) => setConsideraciones((p) => (p ? p + "\n\n" + c : c))}
              />
            </div>
            <textarea value={consideraciones} onChange={(e) => setConsideraciones(e.target.value)} rows={5}
              placeholder="Fecha, hora, modalidad, apertura de la audiencia, consideraciones del conciliador..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F9B] resize-y" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-gray-700">Acuerdo / Decisión + cierre</label>
              <InsertarClausulaButton
                tipoTramite="conciliacion"
                resultado={resultadoActaTipo}
                categoriasPreferidas={[
                  "obligacion_dar",
                  "obligacion_hacer",
                  "obligacion_no_hacer",
                  "garantias",
                  "clausula_penal",
                  "domicilio_notificaciones",
                  "cierre",
                ]}
                onInsert={(c) => setAcuerdoTexto((p) => (p ? p + "\n\n" + c : c))}
              />
            </div>
            <textarea value={acuerdoTexto} onChange={(e) => setAcuerdoTexto(e.target.value)} rows={6}
              placeholder="Texto del acuerdo conciliatorio (PRIMERO: ... SEGUNDO: ...) + cláusulas de cierre."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F9B] resize-y" />
          </div>

          <button onClick={generar} disabled={generando}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#0D2340] hover:bg-[#1B4F9B] rounded-lg disabled:opacity-50">
            {generando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {generando ? "Generando acta..." : "Generar acta"}
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div><p className="text-sm font-medium text-red-800">Error</p><p className="text-sm text-red-600">{error}</p></div>
        </div>
      )}
      {exito && (
        <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-lg p-4">
          <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
          <div><p className="text-sm font-medium text-green-800">Operación exitosa</p><p className="text-sm text-green-600">{exito}</p></div>
        </div>
      )}
    </div>
  );
}
