"use client";

import { useState, useCallback } from "react";
import {
  FileText,
  Send,
  Plus,
  Trash2,
  Loader2,
  CheckCircle,
  AlertCircle,
  Download,
  Users,
  Calendar,
  Hash,
  User,
  Briefcase,
} from "lucide-react";
import { InsertarClausulaButton } from "@/components/modules/plantillas/InsertarClausulaButton";
import type { ActaTipo } from "@/types";

/* ─── Props ─────────────────────────────────────────────────────────────── */

interface CrearActaInsolvenciaProps {
  caseId: string;
  radicado: string;
  insolvente: { nombre: string; documento: string; email: string };
  acreedores: { nombre: string; documento: string; email: string }[];
  operador: { id: string; nombre: string; email: string; tarjeta?: string } | null;
  apoderadoInsolvente: { nombre: string; documento: string; email: string } | null;
  hearingId: string | null;
  fechaAudiencia: string | null;
  actaExistente: any | null;
  actasPrevias: any[];
}

type TipoActaInsolvencia =
  | "acuerdo_pago"
  | "liquidacion_patrimonial"
  | "validacion_acuerdo_privado"
  | "no_acuerdo"
  | "desistimiento";

const TIPOS_ACTA: { value: TipoActaInsolvencia; label: string }[] = [
  { value: "acuerdo_pago", label: "Acuerdo de pago" },
  { value: "liquidacion_patrimonial", label: "Liquidación patrimonial" },
  { value: "validacion_acuerdo_privado", label: "Validación acuerdo privado" },
  { value: "no_acuerdo", label: "No acuerdo" },
  { value: "desistimiento", label: "Desistimiento" },
];

const TIPO_INSOLVENCIA_A_ACTA: Record<TipoActaInsolvencia, ActaTipo> = {
  acuerdo_pago: "acuerdo_total",
  liquidacion_patrimonial: "no_acuerdo",
  validacion_acuerdo_privado: "acuerdo_total",
  no_acuerdo: "no_acuerdo",
  desistimiento: "desistimiento",
};

function resultadoActaTipo(tipo: TipoActaInsolvencia): ActaTipo {
  return TIPO_INSOLVENCIA_A_ACTA[tipo];
}

interface Obligacion {
  acreedor: string;
  obligacion: string;
  plazo: string;
  monto: string;
}

/* ─── Component ─────────────────────────────────────────────────────────── */

export function CrearActaInsolvencia({
  caseId,
  radicado,
  insolvente,
  acreedores,
  operador,
  apoderadoInsolvente,
  hearingId,
  fechaAudiencia,
  actaExistente,
  actasPrevias,
}: CrearActaInsolvenciaProps) {
  /* Heredar datos de la última acta previa */
  const ultimaActa = actasPrevias.length > 0 ? actasPrevias[0] : null;

  /* Estado del formulario — pre-llenado con acta anterior */
  const [tipo, setTipo] = useState<TipoActaInsolvencia>(
    ultimaActa?.tipo === "acuerdo_total" ? "acuerdo_pago"
    : ultimaActa?.tipo === "no_acuerdo" ? "no_acuerdo"
    : ultimaActa?.tipo === "desistimiento" ? "desistimiento"
    : "acuerdo_pago"
  );
  const [consideraciones, setConsideraciones] = useState(ultimaActa?.consideraciones ?? "");
  const [acuerdoTexto, setAcuerdoTexto] = useState(ultimaActa?.acuerdo_texto ?? "");
  const [obligaciones, setObligaciones] = useState<Obligacion[]>(() => {
    if (ultimaActa?.obligaciones?.length) {
      return (ultimaActa.obligaciones as any[]).map((ob: any) => ({
        acreedor: ob.parte ?? "",
        obligacion: ob.obligacion ?? "",
        plazo: ob.plazo ?? "",
        monto: ob.monto ? String(ob.monto) : "",
      }));
    }
    return [{ acreedor: "", obligacion: "", plazo: "", monto: "" }];
  });

  /* Estado de acciones */
  const [generando, setGenerando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [actaCreada, setActaCreada] = useState<any | null>(actaExistente);

  /* ─── Obligaciones CRUD ────────────────────────────────────────────── */

  const agregarObligacion = useCallback(() => {
    setObligaciones((prev) => [
      ...prev,
      { acreedor: "", obligacion: "", plazo: "", monto: "" },
    ]);
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

  /* ─── Generar acta ─────────────────────────────────────────────────── */

  const generarActa = async () => {
    setGenerando(true);
    setError(null);
    setExito(null);

    try {
      // Mapear tipo de insolvencia a tipo de acta que la API entiende
      const tipoMap: Record<TipoActaInsolvencia, string> = {
        acuerdo_pago: "acuerdo_total",
        liquidacion_patrimonial: "no_acuerdo",
        validacion_acuerdo_privado: "acuerdo_total",
        no_acuerdo: "no_acuerdo",
        desistimiento: "desistimiento",
      };

      const obligacionesPayload = obligaciones
        .filter((ob) => ob.acreedor || ob.obligacion)
        .map((ob) => ({
          parte: ob.acreedor,
          obligacion: ob.obligacion,
          plazo: ob.plazo,
          monto: ob.monto ? parseFloat(ob.monto.replace(/[^0-9.]/g, "")) : undefined,
        }));

      const tipoLabel = TIPOS_ACTA.find((t) => t.value === tipo)?.label ?? tipo;
      const consideracionesFull = `TRÁMITE DE INSOLVENCIA — ${tipoLabel.toUpperCase()}\n\n${consideraciones}`;

      const res = await fetch(`/api/casos/${caseId}/acta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hearing_id: hearingId,
          tipo: tipoMap[tipo],
          consideraciones: consideracionesFull,
          acuerdo_texto: acuerdoTexto || null,
          obligaciones: obligacionesPayload.length ? obligacionesPayload : null,
          es_constancia: tipo === "no_acuerdo" || tipo === "desistimiento",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al generar el acta");
      }

      const data = await res.json();
      setActaCreada(data.acta);
      setExito("Acta generada exitosamente. Puede descargar el borrador o enviar a firma.");
    } catch (err: any) {
      setError(err.message || "Error inesperado al generar el acta");
    } finally {
      setGenerando(false);
    }
  };

  /* ─── Enviar a firma ───────────────────────────────────────────────── */

  const enviarAFirma = async () => {
    if (!actaCreada) return;
    setEnviando(true);
    setError(null);
    setExito(null);

    try {
      const res = await fetch(`/api/expediente/${caseId}/acta-firma`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acta_id: actaCreada.id }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al enviar a firma");
      }

      const data = await res.json();
      setExito(
        `Documento enviado a firma electrónica. ID: ${data.firma_documento_id}. Puede gestionar las firmas desde el módulo de firmas.`
      );
      setActaCreada({ ...actaCreada, estado_firma: "firmado_parcial" });
    } catch (err: any) {
      setError(err.message || "Error inesperado al enviar a firma");
    } finally {
      setEnviando(false);
    }
  };

  /* ─── Render ───────────────────────────────────────────────────────── */

  const fechaFormateada = fechaAudiencia
    ? new Date(fechaAudiencia).toLocaleString("es-CO", {
        dateStyle: "long",
        timeStyle: "short",
      })
    : "Sin programar";

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-purple-100">
          <FileText className="w-5 h-5 text-purple-700" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[#0D2340]">
            Acta de Audiencia de Insolvencia
          </h3>
          <p className="text-sm text-gray-500">
            Genere el acta de la audiencia y envíela a firma electrónica
          </p>
        </div>
      </div>

      {/* Datos pre-llenados */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h4 className="text-sm font-semibold text-[#0D2340] uppercase tracking-wide">
          Datos del Trámite
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Radicado */}
          <div className="flex items-start gap-3">
            <Hash className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Número de radicado</p>
              <p className="text-sm font-medium text-[#0D2340]">{radicado}</p>
            </div>
          </div>

          {/* Fecha audiencia */}
          <div className="flex items-start gap-3">
            <Calendar className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Fecha de la audiencia</p>
              <p className="text-sm font-medium text-[#0D2340]">{fechaFormateada}</p>
            </div>
          </div>

          {/* Insolvente */}
          <div className="flex items-start gap-3">
            <User className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Insolvente (Convocante)</p>
              <p className="text-sm font-medium text-[#0D2340]">{insolvente.nombre}</p>
              <p className="text-xs text-gray-400">
                {insolvente.documento} · {insolvente.email}
              </p>
            </div>
          </div>

          {/* Operador */}
          <div className="flex items-start gap-3">
            <Briefcase className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Operador (Conciliador)</p>
              {operador ? (
                <>
                  <p className="text-sm font-medium text-[#0D2340]">{operador.nombre}</p>
                  <p className="text-xs text-gray-400">{operador.email}</p>
                </>
              ) : (
                <p className="text-sm text-gray-400 italic">Sin asignar</p>
              )}
            </div>
          </div>

          {/* Apoderado */}
          {apoderadoInsolvente && (
            <div className="flex items-start gap-3">
              <User className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Apoderado del Insolvente</p>
                <p className="text-sm font-medium text-[#0D2340]">
                  {apoderadoInsolvente.nombre}
                </p>
                <p className="text-xs text-gray-400">
                  {apoderadoInsolvente.documento} · {apoderadoInsolvente.email}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Acreedores */}
        {acreedores.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-gray-400" />
              <p className="text-xs text-gray-500 font-medium">
                Acreedores ({acreedores.length})
              </p>
            </div>
            <div className="space-y-1.5">
              {acreedores.map((ac, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2 text-sm"
                >
                  <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-[#0D2340] truncate">{ac.nombre}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {ac.documento} · {ac.email}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Si ya existe un acta → mostrar estado */}
      {actaCreada && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-[#0D2340] uppercase tracking-wide">
              Acta Generada
            </h4>
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                actaCreada.estado_firma === "firmado_completo"
                  ? "bg-green-100 text-green-800"
                  : actaCreada.estado_firma === "firmado_parcial"
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {actaCreada.estado_firma === "firmado_completo"
                ? "Firmada"
                : actaCreada.estado_firma === "firmado_parcial"
                ? "En firma"
                : "Pendiente de firma"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-500">N.o Acta</p>
              <p className="font-medium text-[#0D2340]">
                {actaCreada.numero_acta ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Tipo</p>
              <p className="font-medium text-[#0D2340]">{actaCreada.tipo}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Fecha</p>
              <p className="font-medium text-[#0D2340]">
                {actaCreada.fecha_acta
                  ? new Date(actaCreada.fecha_acta).toLocaleDateString("es-CO")
                  : "—"}
              </p>
            </div>
          </div>

          {/* Botones acta existente */}
          <div className="flex flex-wrap gap-3 pt-2">
            {actaCreada.borrador_url && (
              <a
                href={actaCreada.borrador_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#1B4F9B] bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Descargar borrador
              </a>
            )}

            {actaCreada.estado_firma === "pendiente" && (
              <button
                onClick={enviarAFirma}
                disabled={enviando}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#0D2340] hover:bg-[#1B4F9B] rounded-lg transition-colors disabled:opacity-50"
              >
                {enviando ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Enviar a firma electrónica
              </button>
            )}

            {actaCreada.acta_firmada_url && (
              <a
                href={actaCreada.acta_firmada_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                Descargar acta firmada
              </a>
            )}
          </div>
        </div>
      )}

      {/* Formulario para crear nueva acta (solo si no hay acta creada) */}
      {!actaCreada && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
          <h4 className="text-sm font-semibold text-[#0D2340] uppercase tracking-wide">
            Datos del Acta
          </h4>

          {ultimaActa && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-start gap-2">
              <FileText className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-blue-700">
                  Datos heredados del acta anterior ({ultimaActa.numero_acta})
                </p>
                <p className="text-xs text-blue-600 mt-0.5">
                  Las consideraciones, acuerdo y obligaciones se pre-llenaron con los datos de la audiencia anterior. Puedes editarlos.
                </p>
              </div>
            </div>
          )}

          {/* Tipo de acta */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Tipo de acta *
            </label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoActaInsolvencia)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F9B] focus:border-transparent"
            >
              {TIPOS_ACTA.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Consideraciones */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-gray-700">
                Consideraciones
              </label>
              <InsertarClausulaButton
                tipoTramite="insolvencia"
                resultado={resultadoActaTipo(tipo)}
                categoriasPreferidas={["consideraciones", "preambulo", "identificacion_partes"]}
                onInsert={(contenido) =>
                  setConsideraciones((prev: string) => (prev ? prev + "\n\n" + contenido : contenido))
                }
              />
            </div>
            <textarea
              value={consideraciones}
              onChange={(e) => setConsideraciones(e.target.value)}
              rows={4}
              placeholder="Antecedentes, contexto y consideraciones relevantes del trámite..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F9B] focus:border-transparent resize-y"
            />
          </div>

          {/* Acuerdo / Decisión */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-gray-700">
                Acuerdo / Decisión
              </label>
              <InsertarClausulaButton
                tipoTramite="insolvencia"
                resultado={resultadoActaTipo(tipo)}
                categoriasPreferidas={[
                  "insolvencia_acuerdo_pago",
                  "insolvencia_liquidacion",
                  "obligacion_dar",
                  "obligacion_hacer",
                  "garantias",
                  "clausula_penal",
                  "cierre",
                ]}
                onInsert={(contenido) =>
                  setAcuerdoTexto((prev: string) => (prev ? prev + "\n\n" + contenido : contenido))
                }
              />
            </div>
            <textarea
              value={acuerdoTexto}
              onChange={(e) => setAcuerdoTexto(e.target.value)}
              rows={4}
              placeholder="Descripción del acuerdo alcanzado o decisión tomada..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F9B] focus:border-transparent resize-y"
            />
          </div>

          {/* Obligaciones */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">
                Obligaciones pactadas
              </label>
              <button
                type="button"
                onClick={agregarObligacion}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1B4F9B] bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar
              </button>
            </div>

            {obligaciones.length > 0 && (
              <div className="space-y-3">
                {/* Header (desktop) */}
                <div className="hidden md:grid grid-cols-[1fr_1fr_0.7fr_0.7fr_auto] gap-2 text-xs font-semibold text-gray-500 px-1">
                  <span>Acreedor</span>
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
                    <div>
                      <label className="md:hidden text-xs text-gray-500 mb-1 block">
                        Acreedor
                      </label>
                      <select
                        value={ob.acreedor}
                        onChange={(e) =>
                          actualizarObligacion(idx, "acreedor", e.target.value)
                        }
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1B4F9B]"
                      >
                        <option value="">Seleccionar acreedor...</option>
                        {acreedores.map((ac, i) => (
                          <option key={i} value={ac.nombre}>
                            {ac.nombre}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="md:hidden text-xs text-gray-500 mb-1 block">
                        Obligación
                      </label>
                      <input
                        type="text"
                        value={ob.obligacion}
                        onChange={(e) =>
                          actualizarObligacion(idx, "obligacion", e.target.value)
                        }
                        placeholder="Descripción..."
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1B4F9B]"
                      />
                    </div>

                    <div>
                      <label className="md:hidden text-xs text-gray-500 mb-1 block">
                        Plazo
                      </label>
                      <input
                        type="text"
                        value={ob.plazo}
                        onChange={(e) =>
                          actualizarObligacion(idx, "plazo", e.target.value)
                        }
                        placeholder="Ej: 30 días"
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1B4F9B]"
                      />
                    </div>

                    <div>
                      <label className="md:hidden text-xs text-gray-500 mb-1 block">
                        Monto
                      </label>
                      <input
                        type="text"
                        value={ob.monto}
                        onChange={(e) =>
                          actualizarObligacion(idx, "monto", e.target.value)
                        }
                        placeholder="$0"
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1B4F9B]"
                      />
                    </div>

                    <div className="flex items-center justify-end md:justify-center">
                      <button
                        type="button"
                        onClick={() => eliminarObligacion(idx)}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="Eliminar obligación"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Botón generar */}
          <div className="pt-2">
            <button
              onClick={generarActa}
              disabled={generando || !tipo}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#0D2340] hover:bg-[#1B4F9B] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Mensajes */}
      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Error</p>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      )}

      {exito && (
        <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-lg p-4">
          <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-green-800">Operación exitosa</p>
            <p className="text-sm text-green-600">{exito}</p>
          </div>
        </div>
      )}
    </div>
  );
}
