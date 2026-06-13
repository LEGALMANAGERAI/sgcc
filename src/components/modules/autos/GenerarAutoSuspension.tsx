"use client";

import { useState, useEffect } from "react";
import {
  Loader2,
  FileText,
  UserCheck,
  UserX,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import {
  type ResolvedAutoVars,
  type AutoSuspensionOpciones,
  type QuorumFila,
  BLOQUES_ESTANDAR,
} from "@/lib/autos/types";

/* ─── Props ─────────────────────────────────────────────────────────────── */

interface GenerarAutoSuspensionProps {
  caseId: string;
  hearingId: string | null;
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */

const BLOQUES_DEFAULT = [
  "ilustracion",
  "reparos_admisorio",
  "expediente_digital",
  "reconocimiento_personeria",
];

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/**
 * Convierte el valor de un <input type="datetime-local"> ("2026-05-26T10:00")
 * en los strings en español que consume el generador del auto. Se parsea el
 * string directamente (sin `new Date()`) porque ya es la hora de pared que el
 * operador tecleó en zona Colombia — así no se arrastra ningún desfase UTC.
 */
function formatearContinuacion(dt: string): { fecha: string; hora: string } {
  if (!dt || !dt.includes("T")) return { fecha: "", hora: "" };
  const [d, t] = dt.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [hh, mm] = t.split(":").map(Number);
  if (!y || !m || !day) return { fecha: "", hora: "" };
  const fecha = `${day} de ${MESES[m - 1]} del ${y}`;
  let h = hh % 12;
  if (h === 0) h = 12;
  const hora = `${h}:${String(mm).padStart(2, "0")} ${hh >= 12 ? "PM" : "AM"}`;
  return { fecha, hora };
}

/** Construye el quórum editable desde el ResolvedAutoVars. */
function buildQuorum(vars: ResolvedAutoVars): QuorumFila[] {
  const filas: QuorumFila[] = vars.acreedores.map((a) => ({
    nombre: a.nombre ?? "",
    documento: a.documento ?? "",
    clase: a.clase_credito ?? "",
    email: a.email ?? "",
    telefono: a.telefono ?? "",
    direccion: a.direccion ?? "",
    presente: a.presente ?? false,
    apoderado_nombre: a.apoderado?.nombre ?? "",
    apoderado_cedula: a.apoderado?.cedula ?? "",
    apoderado_tp: a.apoderado?.tarjeta_profesional ?? "",
    apoderado_email: a.apoderado?.email ?? "",
    apoderado_telefono: a.apoderado?.telefono ?? "",
    apoderado_direccion: a.apoderado?.direccion ?? "",
    apoderado_presente: a.apoderado ? false : null,
    es_deudor: false,
  }));

  // Fila del deudor al final.
  const d = vars.deudor;
  filas.push({
    nombre: d.nombre ?? "",
    documento: d.documento ?? "",
    clase: "",
    email: d.email ?? "",
    telefono: d.telefono ?? "",
    direccion: d.direccion ?? "",
    presente: false,
    apoderado_nombre: d.apoderado?.nombre ?? "",
    apoderado_cedula: d.apoderado?.cedula ?? "",
    apoderado_tp: d.apoderado?.tarjeta_profesional ?? "",
    apoderado_email: d.apoderado?.email ?? "",
    apoderado_telefono: d.apoderado?.telefono ?? "",
    apoderado_direccion: d.apoderado?.direccion ?? "",
    apoderado_presente: d.apoderado ? false : null,
    es_deudor: true,
  });

  return filas;
}

/* ─── Component ─────────────────────────────────────────────────────────── */

export function GenerarAutoSuspension({
  caseId,
  hearingId,
}: GenerarAutoSuspensionProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState<null | "word" | "pdf">(null);

  // Considerandos libres como texto (uno por línea) para el textarea.
  const [considerandosTexto, setConsiderandosTexto] = useState("");

  const [opts, setOpts] = useState<AutoSuspensionOpciones | null>(null);
  // Acreencias del caso (para el selector de cuáles incluir en la tabla).
  const [acreencias, setAcreencias] = useState<ResolvedAutoVars["acreedores"]>([]);

  // ── Cargar variables y pre-llenar ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const qs = hearingId ? `?hearing_id=${encodeURIComponent(hearingId)}` : "";
        const res = await fetch(`/api/casos/${caseId}/autos${qs}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? `Error HTTP ${res.status}`);
        }
        const vars: ResolvedAutoVars = await res.json();
        if (cancelled) return;

        setAcreencias(vars.acreedores);

        const initial: AutoSuspensionOpciones = {
          numero_auto: "",
          fecha_audiencia_texto: "",
          hora_audiencia_texto: "",
          hora_audiencia_corta: "",
          zoom_apertura_url: "",
          zoom_apertura_id: "",
          zoom_apertura_codigo: "",
          considerandos: [],
          bloques_estandar: [...BLOQUES_DEFAULT],
          motivo_suspension: "",
          incluir_tabla_acreencias: false,
          acreenciasSeleccionadasIds: vars.acreedores.map((a) => a.id),
          continuacion_dt: "",
          continuacion_fecha: "",
          continuacion_hora: "",
          continuacion_zoom_url: "",
          continuacion_zoom_codigo: "",
          quorum: buildQuorum(vars),
        };
        setOpts(initial);
        setConsiderandosTexto("");
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Error al cargar las variables del auto");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [caseId, hearingId]);

  // ── Helpers de estado ───────────────────────────────────────────────────
  function patch(p: Partial<AutoSuspensionOpciones>) {
    setOpts((prev) => (prev ? { ...prev, ...p } : prev));
  }

  function patchFila(idx: number, p: Partial<QuorumFila>) {
    setOpts((prev) => {
      if (!prev) return prev;
      const quorum = prev.quorum.map((f, i) => (i === idx ? { ...f, ...p } : f));
      return { ...prev, quorum };
    });
  }

  function removeFila(idx: number) {
    setOpts((prev) => {
      if (!prev) return prev;
      return { ...prev, quorum: prev.quorum.filter((_, i) => i !== idx) };
    });
  }

  function toggleBloque(id: string) {
    setOpts((prev) => {
      if (!prev) return prev;
      const has = prev.bloques_estandar.includes(id);
      const bloques_estandar = has
        ? prev.bloques_estandar.filter((b) => b !== id)
        : [...prev.bloques_estandar, id];
      return { ...prev, bloques_estandar };
    });
  }

  function toggleAcreencia(id: string) {
    setOpts((prev) => {
      if (!prev) return prev;
      const actual = prev.acreenciasSeleccionadasIds ?? [];
      const has = actual.includes(id);
      const acreenciasSeleccionadasIds = has
        ? actual.filter((x) => x !== id)
        : [...actual, id];
      return { ...prev, acreenciasSeleccionadasIds };
    });
  }

  // ── Generar ─────────────────────────────────────────────────────────────
  async function handleGenerar(formato: "word" | "pdf" = "word") {
    if (!opts) return;
    setGenerating(formato);
    setError(null);

    // Volcar los considerandos libres del textarea al array.
    const considerandos = considerandosTexto
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    // Derivar fecha/hora de continuación en español desde el calendario.
    const { fecha, hora } = formatearContinuacion(opts.continuacion_dt);
    const opciones: AutoSuspensionOpciones = {
      ...opts,
      considerandos,
      continuacion_fecha: fecha,
      continuacion_hora: hora,
    };

    try {
      const res = await fetch(`/api/casos/${caseId}/autos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "suspension",
          hearing_id: hearingId,
          formato,
          opciones,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Error HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data?.url) {
        window.open(data.url, "_blank");
      } else {
        setError("El servidor no devolvió la URL del documento.");
      }
    } catch (e: any) {
      setError(e?.message ?? "Error al generar el auto");
    } finally {
      setGenerating(null);
    }
  }

  /* ── Render guards ──────────────────────────────────────────────────── */

  if (!mounted) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-sm text-gray-400">
        Cargando...
      </div>
    );
  }

  if (!hearingId) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center">
        <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-3" />
        <p className="text-sm text-gray-600 font-medium">
          No hay una audiencia registrada
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Programa una audiencia antes de generar el auto de suspensión.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
        <Loader2 className="w-6 h-6 text-[#1B4F9B] animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-400">Cargando variables del expediente...</p>
      </div>
    );
  }

  if (error && !opts) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-red-100 p-10 text-center">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
        <p className="text-sm text-red-600 font-medium">{error}</p>
      </div>
    );
  }

  if (!opts) return null;

  /* ── Estilos compartidos ────────────────────────────────────────────── */
  const inputCls =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F9B]";
  const labelCls = "block text-xs font-medium text-gray-600 mb-1";

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-6 mt-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-6 py-4">
        <h3 className="font-semibold text-[#0D2340] text-base flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#1B4F9B]" />
          Auto de suspensión
        </h3>
        <p className="text-xs text-gray-400 mt-1">
          Revisa y completa los datos diligenciados en vivo. El esqueleto del auto lo
          arma el sistema.
        </p>
      </div>

      {/* Datos de apertura */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 px-6 py-5">
        <h4 className="text-sm font-semibold text-[#0D2340] mb-4">Datos de apertura</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Número de auto</label>
            <input
              type="text"
              value={opts.numero_auto}
              onChange={(e) => patch({ numero_auto: e.target.value })}
              placeholder="Ej. 008"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Fecha de la audiencia (texto)</label>
            <input
              type="text"
              value={opts.fecha_audiencia_texto}
              onChange={(e) => patch({ fecha_audiencia_texto: e.target.value })}
              placeholder="11 de mayo de 2026"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Hora de la audiencia (texto)</label>
            <input
              type="text"
              value={opts.hora_audiencia_texto}
              onChange={(e) => patch({ hora_audiencia_texto: e.target.value })}
              placeholder="diez y veintitrés de la mañana"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Hora de la audiencia (corta)</label>
            <input
              type="text"
              value={opts.hora_audiencia_corta}
              onChange={(e) => patch({ hora_audiencia_corta: e.target.value })}
              placeholder="10:23 AM"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Zoom — URL</label>
            <input
              type="text"
              value={opts.zoom_apertura_url}
              onChange={(e) => patch({ zoom_apertura_url: e.target.value })}
              placeholder="https://zoom.us/j/..."
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Zoom — ID</label>
            <input
              type="text"
              value={opts.zoom_apertura_id}
              onChange={(e) => patch({ zoom_apertura_id: e.target.value })}
              placeholder="123 4567 8900"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Zoom — Código</label>
            <input
              type="text"
              value={opts.zoom_apertura_codigo}
              onChange={(e) => patch({ zoom_apertura_codigo: e.target.value })}
              className={inputCls}
            />
          </div>
        </div>
      </section>

      {/* Quórum */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100">
          <h4 className="text-sm font-semibold text-[#0D2340]">Quórum</h4>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Marca la asistencia de cada acreedor, del deudor y de sus apoderados.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Documento
                </th>
                <th className="px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Clase
                </th>
                <th className="px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider text-center w-32">
                  Presente
                </th>
                <th className="px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Apoderado
                </th>
                <th className="px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider text-center w-32">
                  Apod. presente
                </th>
                <th className="px-2 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {opts.quorum.map((f, idx) => (
                <tr
                  key={idx}
                  className={f.es_deudor ? "bg-blue-50/40" : "hover:bg-gray-50/50"}
                >
                  {/* Nombre */}
                  <td className="px-4 py-2.5">
                    <input
                      type="text"
                      value={f.nombre}
                      onChange={(e) => patchFila(idx, { nombre: e.target.value })}
                      className="w-full min-w-[160px] border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1B4F9B]"
                    />
                    {f.es_deudor && (
                      <span className="inline-block mt-1 text-[10px] font-medium text-blue-700">
                        Deudor
                      </span>
                    )}
                  </td>
                  {/* Documento */}
                  <td className="px-3 py-2.5">
                    <input
                      type="text"
                      value={f.documento}
                      onChange={(e) => patchFila(idx, { documento: e.target.value })}
                      className="w-full min-w-[110px] border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1B4F9B]"
                    />
                  </td>
                  {/* Clase */}
                  <td className="px-3 py-2.5">
                    <input
                      type="text"
                      value={f.clase}
                      onChange={(e) => patchFila(idx, { clase: e.target.value })}
                      disabled={f.es_deudor}
                      className="w-full min-w-[90px] border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1B4F9B] disabled:bg-gray-100 disabled:text-gray-400"
                    />
                  </td>
                  {/* Presente (acreedor/deudor) */}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => patchFila(idx, { presente: true })}
                        aria-pressed={f.presente === true}
                        title="Presente"
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border transition-colors ${
                          f.presente === true
                            ? "bg-green-100 text-green-700 border-green-300"
                            : "bg-white text-gray-400 border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => patchFila(idx, { presente: false })}
                        aria-pressed={f.presente === false}
                        title="Ausente"
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border transition-colors ${
                          f.presente === false
                            ? "bg-red-100 text-red-700 border-red-300"
                            : "bg-white text-gray-400 border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <UserX className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                  {/* Apoderado */}
                  <td className="px-3 py-2.5">
                    <input
                      type="text"
                      value={f.apoderado_nombre}
                      onChange={(e) =>
                        patchFila(idx, {
                          apoderado_nombre: e.target.value,
                          // Si pasa de "sin apoderado" a tener uno, inicializa el toggle.
                          apoderado_presente:
                            e.target.value.trim() && f.apoderado_presente === null
                              ? false
                              : !e.target.value.trim()
                              ? null
                              : f.apoderado_presente,
                        })
                      }
                      placeholder="Sin apoderado"
                      className="w-full min-w-[150px] border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1B4F9B]"
                    />
                    {f.apoderado_nombre.trim() && (
                      <input
                        type="text"
                        value={f.apoderado_tp}
                        onChange={(e) => patchFila(idx, { apoderado_tp: e.target.value })}
                        placeholder="T.P."
                        className="w-full min-w-[150px] mt-1 border border-gray-200 rounded-lg px-2 py-1 text-[11px] text-gray-500 focus:outline-none focus:ring-1 focus:ring-[#1B4F9B]"
                      />
                    )}
                  </td>
                  {/* Apoderado presente */}
                  <td className="px-3 py-2.5">
                    {f.apoderado_nombre.trim() ? (
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => patchFila(idx, { apoderado_presente: true })}
                          aria-pressed={f.apoderado_presente === true}
                          title="Apoderado presente"
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border transition-colors ${
                            f.apoderado_presente === true
                              ? "bg-green-100 text-green-700 border-green-300"
                              : "bg-white text-gray-400 border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => patchFila(idx, { apoderado_presente: false })}
                          aria-pressed={f.apoderado_presente === false}
                          title="Apoderado ausente"
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border transition-colors ${
                            f.apoderado_presente === false
                              ? "bg-red-100 text-red-700 border-red-300"
                              : "bg-white text-gray-400 border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="block text-center text-[11px] text-gray-300">—</span>
                    )}
                  </td>
                  {/* Eliminar fila */}
                  <td className="px-2 py-2.5 text-center">
                    <button
                      type="button"
                      onClick={() => removeFila(idx)}
                      title="Quitar fila"
                      className="text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Considerandos */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 px-6 py-5">
        <h4 className="text-sm font-semibold text-[#0D2340] mb-4">Considerandos</h4>
        <div className="space-y-2.5">
          {BLOQUES_ESTANDAR.map((b) => (
            <label
              key={b.id}
              className="flex items-start gap-2.5 text-sm text-gray-700 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={opts.bloques_estandar.includes(b.id)}
                onChange={() => toggleBloque(b.id)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#1B4F9B] focus:ring-[#1B4F9B]"
              />
              <span>{b.label}</span>
            </label>
          ))}
        </div>

        <label className="flex items-center gap-2.5 text-sm text-gray-700 cursor-pointer mt-4 pt-4 border-t border-gray-100">
          <input
            type="checkbox"
            checked={opts.incluir_tabla_acreencias}
            onChange={(e) => patch({ incluir_tabla_acreencias: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300 text-[#1B4F9B] focus:ring-[#1B4F9B]"
          />
          <span>Incluir tabla de relación de acreencias</span>
        </label>

        {/* Selección de cuáles acreencias incluir en la tabla (las relacionadas
            en ESTA audiencia). Por defecto van todas. */}
        {opts.incluir_tabla_acreencias && acreencias.length > 0 && (
          <div className="mt-3 ml-7 space-y-2 border-l-2 border-gray-100 pl-4">
            <p className="text-[11px] text-gray-400">
              Selecciona cuáles acreencias se relacionan en esta audiencia.
            </p>
            {acreencias.map((a) => (
              <label
                key={a.id}
                className="flex items-center gap-2.5 text-xs text-gray-700 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={(opts.acreenciasSeleccionadasIds ?? []).includes(a.id)}
                  onChange={() => toggleAcreencia(a.id)}
                  className="h-4 w-4 rounded border-gray-300 text-[#1B4F9B] focus:ring-[#1B4F9B]"
                />
                <span>
                  {a.nombre || "(sin nombre)"}
                  {a.documento ? ` — ${a.documento}` : ""}
                  {a.clase_credito ? ` · ${a.clase_credito}` : ""}
                </span>
              </label>
            ))}
          </div>
        )}

        <div className="mt-4">
          <label className={labelCls}>
            Numerales adicionales (uno por línea)
          </label>
          <textarea
            value={considerandosTexto}
            onChange={(e) => setConsiderandosTexto(e.target.value)}
            rows={4}
            placeholder={"Un considerando por línea..."}
            className={inputCls}
          />
        </div>
      </section>

      {/* Motivo de la suspensión */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 px-6 py-5">
        <h4 className="text-sm font-semibold text-[#0D2340] mb-4">
          Motivo de la suspensión
        </h4>
        <textarea
          value={opts.motivo_suspension}
          onChange={(e) => patch({ motivo_suspension: e.target.value })}
          rows={4}
          placeholder="Describe el motivo por el cual se suspende la audiencia..."
          className={inputCls}
        />
      </section>

      {/* Continuación (RESUELVE) */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 px-6 py-5">
        <h4 className="text-sm font-semibold text-[#0D2340] mb-4">
          Continuación (RESUELVE)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Fecha y hora de continuación</label>
            <input
              type="datetime-local"
              value={opts.continuacion_dt}
              onChange={(e) => patch({ continuacion_dt: e.target.value })}
              className={inputCls}
            />
            {opts.continuacion_dt && (
              <p className="text-[11px] text-gray-400 mt-1">
                {(() => {
                  const { fecha, hora } = formatearContinuacion(opts.continuacion_dt);
                  return `Quedará como: ${fecha} a las ${hora}`;
                })()}
              </p>
            )}
          </div>
          <div>
            <label className={labelCls}>Zoom continuación — URL</label>
            <input
              type="text"
              value={opts.continuacion_zoom_url}
              onChange={(e) => patch({ continuacion_zoom_url: e.target.value })}
              placeholder="https://zoom.us/j/..."
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Zoom continuación — Código</label>
            <input
              type="text"
              value={opts.continuacion_zoom_codigo}
              onChange={(e) => patch({ continuacion_zoom_codigo: e.target.value })}
              className={inputCls}
            />
          </div>
        </div>
      </section>

      {/* Acciones */}
      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => handleGenerar("word")}
          disabled={!!generating}
          className="inline-flex items-center gap-2 bg-[#0D2340] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[#0d2340dd] transition-colors disabled:opacity-50"
        >
          {generating === "word" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileText className="w-4 h-4" />
          )}
          Generar auto (Word)
        </button>
      </div>
    </div>
  );
}
