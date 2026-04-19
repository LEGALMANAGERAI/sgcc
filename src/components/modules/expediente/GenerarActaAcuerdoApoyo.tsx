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
  UserCheck,
  Briefcase,
} from "lucide-react";
import { InsertarClausulaButton } from "@/components/modules/plantillas/InsertarClausulaButton";
import type { ActaTipo } from "@/types";

interface Props {
  caseId: string;
  radicado: string;
  titular: { nombre: string; documento: string; email: string };
  apoyos: { nombre: string; documento: string; email: string }[];
  conciliador: { id: string; nombre: string; tarjeta?: string; codigo?: string } | null;
  hearingId: string | null;
  fechaAudiencia: string | null;
  modalidad: "presencial" | "virtual" | "mixta" | null;
  actaExistente: any | null;
}

type TipoActaApoyo = "suscripcion_apoyo" | "no_suscripcion_apoyo";

const TIPOS: { value: TipoActaApoyo; label: string; resultado: ActaTipo }[] = [
  { value: "suscripcion_apoyo", label: "Suscripción del acuerdo de apoyo", resultado: "acuerdo_total" },
  { value: "no_suscripcion_apoyo", label: "Constancia de NO suscripción", resultado: "no_acuerdo" },
];

export function GenerarActaAcuerdoApoyo({
  caseId,
  radicado,
  titular,
  apoyos,
  conciliador,
  hearingId,
  fechaAudiencia,
  modalidad,
  actaExistente,
}: Props) {
  const [tipo, setTipo] = useState<TipoActaApoyo>("suscripcion_apoyo");
  const [encabezado, setEncabezado] = useState("");
  const [autonomia, setAutonomia] = useState("");
  const [actos, setActos] = useState("");
  const [salvaguardas, setSalvaguardas] = useState("");
  const [cierre, setCierre] = useState("");
  const [generando, setGenerando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [acta, setActa] = useState<any | null>(actaExistente);

  // Para acuerdos de apoyo el backend recibe hechos (autonomía) + consideraciones
  // (encabezado y relación) + acuerdo_texto (actos, salvaguardas, cierre).
  async function generar() {
    setGenerando(true);
    setError(null);
    setExito(null);
    try {
      const acuerdoCombinado = [actos, salvaguardas, cierre]
        .map((s) => s?.trim())
        .filter(Boolean)
        .join("\n\n");

      const res = await fetch(`/api/casos/${caseId}/acta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hearing_id: hearingId,
          tipo,
          hechos: autonomia || null,
          consideraciones: encabezado || null,
          acuerdo_texto: acuerdoCombinado || null,
          es_constancia: tipo === "no_suscripcion_apoyo",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al generar el acta");
      setActa(data.acta);
      setExito("Acta generada. Puede descargar el borrador o enviar a firma.");
    } catch (e: any) {
      setError(e.message);
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

  const tipoCfg = TIPOS.find((t) => t.value === tipo)!;
  const resultadoFiltro: ActaTipo = tipoCfg.resultado;
  const fechaTxt = fechaAudiencia
    ? new Date(fechaAudiencia).toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short" })
    : "Sin programar";
  const modalidadLabel =
    modalidad === "virtual" ? "Virtual" : modalidad === "mixta" ? "Mixta" : modalidad === "presencial" ? "Presencial" : "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-emerald-100">
          <FileText className="w-5 h-5 text-emerald-700" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[#0D2340]">Acuerdo de Apoyo — Acta</h3>
          <p className="text-sm text-gray-500">Ley 1996 de 2019 · Titular · Persona de apoyo · Relación de confianza</p>
        </div>
      </div>

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
            <User className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Titular del acto jurídico</p>
              <p className="font-medium">{titular.nombre}</p>
              <p className="text-xs text-gray-400">{titular.documento} · {titular.email}</p>
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

        {apoyos.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="w-4 h-4 text-gray-400" />
              <p className="text-xs text-gray-500 font-medium">Persona(s) designada(s) como apoyo</p>
            </div>
            <div className="space-y-1.5">
              {apoyos.map((a, i) => (
                <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2 text-sm">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  <div>
                    <p className="font-medium text-[#0D2340]">{a.nombre}</p>
                    <p className="text-xs text-gray-400">{a.documento} · {a.email}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

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

      {!acta && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
          <h4 className="text-sm font-semibold text-[#0D2340] uppercase tracking-wide">Generar acta</h4>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Resultado *</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoActaApoyo)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
              {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-gray-700">1. Encabezado y asistentes</label>
              <InsertarClausulaButton
                tipoTramite="acuerdo_apoyo"
                resultado={resultadoFiltro}
                categoriasPreferidas={["preambulo", "identificacion_partes"]}
                onInsert={(c) => setEncabezado((p) => (p ? p + "\n\n" + c : c))}
              />
            </div>
            <textarea value={encabezado} onChange={(e) => setEncabezado(e.target.value)} rows={4}
              placeholder="Previa citación... comparecieron: Titular del acto jurídico y Persona de apoyo."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-gray-700">
                2. Autonomía del titular y relación de confianza
                {tipo === "no_suscripcion_apoyo" && <span className="ml-2 text-xs text-gray-400">(para no suscripción: observaciones del conciliador)</span>}
              </label>
              <InsertarClausulaButton
                tipoTramite="acuerdo_apoyo"
                resultado={resultadoFiltro}
                categoriasPreferidas={["apoyo_decision"]}
                onInsert={(c) => setAutonomia((p) => (p ? p + "\n\n" + c : c))}
              />
            </div>
            <textarea value={autonomia} onChange={(e) => setAutonomia(e.target.value)} rows={5}
              placeholder={
                tipo === "suscripcion_apoyo"
                  ? "El titular participó de forma autónoma, sin vicios del consentimiento. Entre el titular y el apoyo existe relación de confianza por..."
                  : "Observaciones del conciliador sobre la imposibilidad de suscribir el acuerdo."
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y" />
          </div>

          {tipo === "suscripcion_apoyo" && (
            <>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-gray-700">3. Actos jurídicos asistidos + obligaciones del apoyo</label>
                  <InsertarClausulaButton
                    tipoTramite="acuerdo_apoyo"
                    resultado={resultadoFiltro}
                    categoriasPreferidas={["apoyo_decision"]}
                    onInsert={(c) => setActos((p) => (p ? p + "\n\n" + c : c))}
                  />
                </div>
                <textarea value={actos} onChange={(e) => setActos(e.target.value)} rows={5}
                  placeholder="Lista de actos en que se prestará apoyo (EPS, FOMAG, bienes, productos financieros) + Art. 46 Ley 1996."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-gray-700">4. Salvaguardas + vigencia + revocabilidad</label>
                  <InsertarClausulaButton
                    tipoTramite="acuerdo_apoyo"
                    resultado={resultadoFiltro}
                    categoriasPreferidas={["apoyo_decision", "otro"]}
                    onInsert={(c) => setSalvaguardas((p) => (p ? p + "\n\n" + c : c))}
                  />
                </div>
                <textarea value={salvaguardas} onChange={(e) => setSalvaguardas(e.target.value)} rows={4}
                  placeholder="Rendición semestral, vigencia máx 5 años, revocabilidad por WhatsApp/email."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y" />
              </div>
            </>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-gray-700">
                {tipo === "suscripcion_apoyo" ? "5. Cierre y firma" : "3. Cierre"}
              </label>
              <InsertarClausulaButton
                tipoTramite="acuerdo_apoyo"
                resultado={resultadoFiltro}
                categoriasPreferidas={["cierre", "apoyo_decision"]}
                onInsert={(c) => setCierre((p) => (p ? p + "\n\n" + c : c))}
              />
            </div>
            <textarea value={cierre} onChange={(e) => setCierre(e.target.value)} rows={3}
              placeholder={
                tipo === "suscripcion_apoyo"
                  ? "Lectura, aceptación íntegra y firma de los comparecientes."
                  : "Resuelve el conciliador no suscribir el acuerdo de apoyo solicitado."
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y" />
          </div>

          <button onClick={generar} disabled={generando}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg disabled:opacity-50">
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
