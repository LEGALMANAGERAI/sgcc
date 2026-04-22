"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Star, RefreshCw, X, User, Hash, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";

type TipoBusqueda = "radicado" | "nombre";

interface ProcesoRama {
  idProceso: number;
  llaveProceso: string;
  fechaProceso: string;
  fechaUltimaActuacion: string;
  despacho: string;
  departamento: string;
  sujetosProcesales: string;
  esPrivado: boolean;
  actuaciones?: any[];
}

interface BusquedaGuardada {
  id: string;
  tipo: TipoBusqueda;
  query: string;
  totalResultados: number;
  notas: string | null;
  createdAt: string;
  updatedAt: string;
}

function formatFecha(fecha: string | null) {
  if (!fecha) return "—";
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return fecha;
  return d.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * BuscadorRama — Busca procesos en la Rama Judicial por nombre o radicado
 * e importa resultados como procesos vigilados del centro.
 *
 * Portado desde legados/src/app/(dashboard)/procesos/vigilancia/BuscadorRama.tsx.
 */
export function BuscadorRama() {
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoBusqueda>("nombre");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultados, setResultados] = useState<ProcesoRama[] | null>(null);
  const [expandido, setExpandido] = useState<number | null>(null);
  const [cargandoActs, setCargandoActs] = useState<number | null>(null);
  const [importando, setImportando] = useState<number | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const [guardadas, setGuardadas] = useState<BusquedaGuardada[]>([]);
  const [busquedaActualId, setBusquedaActualId] = useState<string | null>(null);
  const [guardandoBusqueda, setGuardandoBusqueda] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const busquedaIdRef = useRef(0);

  const loadGuardadas = useCallback(async () => {
    try {
      const res = await fetch("/api/busquedas-rama", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setGuardadas(Array.isArray(data) ? data : []);
    } catch {
      /* silencioso */
    }
  }, []);

  useEffect(() => {
    loadGuardadas();
  }, [loadGuardadas]);

  async function handleBuscar(e?: React.FormEvent) {
    e?.preventDefault();
    if (!query.trim()) return;

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const busquedaActual = ++busquedaIdRef.current;

    setLoading(true);
    setError(null);
    setResultados(null);
    setExpandido(null);
    setCargandoActs(null);
    setImportando(null);
    setImportMsg(null);
    setBusquedaActualId(null);

    try {
      const params =
        tipo === "nombre"
          ? `tipo=nombre&nombre=${encodeURIComponent(query.trim())}`
          : `radicado=${encodeURIComponent(query.trim())}`;
      const res = await fetch(`/api/rama-judicial?${params}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const data = await res.json();
      if (busquedaActual !== busquedaIdRef.current) return;
      if (!res.ok) throw new Error(data.error || "Error consultando la Rama Judicial");
      setResultados(data.procesos);
    } catch (err: any) {
      if (err.name === "AbortError") return;
      if (busquedaActual !== busquedaIdRef.current) return;
      setError(err.message);
    } finally {
      if (busquedaActual === busquedaIdRef.current) setLoading(false);
    }
  }

  async function handleGuardarBusqueda() {
    if (!resultados || resultados.length === 0) return;
    setGuardandoBusqueda(true);
    try {
      const res = await fetch("/api/busquedas-rama", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, query: query.trim(), resultados }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");
      setBusquedaActualId(data.id);
      loadGuardadas();
    } catch (err: any) {
      setError(err.message || "Error al guardar la búsqueda");
    } finally {
      setGuardandoBusqueda(false);
    }
  }

  async function handleCargarGuardada(id: string) {
    try {
      const res = await fetch(`/api/busquedas-rama/${id}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar");
      setTipo(data.tipo);
      setQuery(data.query);
      setResultados(data.resultados || []);
      setBusquedaActualId(data.id);
      setError(null);
      setExpandido(null);
      setImportMsg(null);
    } catch (err: any) {
      setError(err.message || "Error al cargar la búsqueda");
    }
  }

  async function handleActualizarGuardada() {
    if (!busquedaActualId || !resultados) return;
    try {
      const res = await fetch(`/api/busquedas-rama/${busquedaActualId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultados }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al actualizar");
      }
      loadGuardadas();
    } catch (err: any) {
      setError(err.message || "Error al actualizar");
    }
  }

  async function handleEliminarGuardada(id: string) {
    if (!confirm("¿Eliminar esta búsqueda guardada?")) return;
    try {
      const res = await fetch(`/api/busquedas-rama/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar");
      if (busquedaActualId === id) setBusquedaActualId(null);
      loadGuardadas();
    } catch {
      /* silencioso */
    }
  }

  async function handleVerActuaciones(proc: ProcesoRama, idx: number) {
    if (expandido === idx) {
      setExpandido(null);
      return;
    }
    if (proc.actuaciones && proc.actuaciones.length > 0) {
      setExpandido(idx);
      return;
    }
    setCargandoActs(idx);
    try {
      const res = await fetch(
        `/api/rama-judicial?radicado=${encodeURIComponent(proc.llaveProceso)}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (res.ok && data.procesos?.[0]?.actuaciones) {
        proc.actuaciones = data.procesos[0].actuaciones;
      }
      setExpandido(idx);
    } catch {
      setExpandido(idx);
    } finally {
      setCargandoActs(null);
    }
  }

  async function handleImportar(proc: ProcesoRama, idx: number) {
    if (!confirm(`¿Importar el radicado ${proc.llaveProceso} como proceso vigilado del centro?`))
      return;
    setImportando(idx);
    setImportMsg(null);
    try {
      const res = await fetch("/api/vigilancia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numero_proceso: proc.llaveProceso,
          despacho: proc.despacho,
          ciudad: proc.departamento,
          partes_texto: proc.sujetosProcesales,
          rama_id_proceso: proc.idProceso,
          departamento: proc.departamento,
          sujetos_procesales: proc.sujetosProcesales,
          fecha_proceso: proc.fechaProceso,
          es_privado: proc.esPrivado,
          rama_ultima_actuacion_fecha: proc.fechaUltimaActuacion,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al importar");
      }
      setImportMsg(`✓ Proceso ${proc.llaveProceso} importado correctamente`);
      router.refresh();
    } catch (err: any) {
      setImportMsg(`Error: ${err.message}`);
    } finally {
      setImportando(null);
    }
  }

  const inputClass =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0D2340] focus:border-transparent outline-none bg-white";

  return (
    <Card padding="md">
      <div className="flex items-center gap-2 pb-3 mb-4 border-b border-gray-200">
        <Search className="w-4 h-4 text-[#0D2340]" />
        <span className="text-sm font-bold text-gray-800">Consultar Rama Judicial</span>
        <span className="text-xs text-gray-500">— Busca procesos en tiempo real e impórtalos</span>
      </div>

      {/* Búsquedas guardadas */}
      {guardadas.length > 0 && (
        <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">
            Búsquedas guardadas ({guardadas.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {guardadas.map((g) => (
              <div
                key={g.id}
                className={`group flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs transition-colors ${
                  busquedaActualId === g.id
                    ? "bg-[#0D2340] border-[#0D2340] text-white"
                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <button
                  onClick={() => handleCargarGuardada(g.id)}
                  className="flex items-center gap-1.5 font-semibold"
                  title={`${g.tipo === "nombre" ? "Nombre" : "Radicado"}: ${g.query}`}
                >
                  {g.tipo === "nombre" ? (
                    <User className="w-3 h-3" />
                  ) : (
                    <Hash className="w-3 h-3" />
                  )}
                  <span className="max-w-[180px] truncate">{g.query}</span>
                  <span className="text-[10px] opacity-70">({g.totalResultados})</span>
                </button>
                <button
                  onClick={() => handleEliminarGuardada(g.id)}
                  className={`ml-1 opacity-60 hover:opacity-100 ${
                    busquedaActualId === g.id ? "text-white" : "text-red-500"
                  }`}
                  title="Eliminar búsqueda guardada"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tipo */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Buscar por:</span>
        {(["nombre", "radicado"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTipo(t);
              setQuery("");
              setResultados(null);
              setError(null);
              setExpandido(null);
              setImportMsg(null);
              setImportando(null);
              setCargandoActs(null);
            }}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
              tipo === t
                ? "bg-[#0D2340] text-white border-[#0D2340]"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {t === "nombre" ? "Nombre / Razón Social" : "Nº Radicado"}
          </button>
        ))}
      </div>

      {/* Barra */}
      <form onSubmit={handleBuscar} className="flex gap-2 mb-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            tipo === "nombre"
              ? "Nombre de persona natural o jurídica (ej: Opera Logística S.A.S)"
              : "Número de radicado (ej: 11001310301820130057600)"
          }
          className={inputClass + (tipo === "radicado" ? " font-mono" : "")}
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="px-5 py-2 text-sm font-bold text-white bg-[#0D2340] rounded-lg hover:bg-[#1A3A62] disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </form>

      {!resultados && !loading && !error && (
        <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200">
          {tipo === "nombre"
            ? "Ingresa el nombre completo o parcial de la persona natural o jurídica. Funciona para demandantes, demandados y cualquier parte procesal."
            : "Ingresa el número de radicado completo (23 dígitos) o el número corto del proceso."}
        </div>
      )}

      {loading && (
        <div className="text-center py-8">
          <Loader2 className="w-6 h-6 mx-auto mb-2 text-[#0D2340] animate-spin" />
          <p className="text-sm text-gray-500">Consultando la Rama Judicial...</p>
          <p className="text-xs text-gray-400 mt-1">Esto puede tomar hasta 15 segundos</p>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 mt-2">
          {error}
        </div>
      )}

      {resultados && (
        <div className="mt-4">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
              {resultados.length} proceso{resultados.length !== 1 ? "s" : ""} encontrado
              {resultados.length !== 1 ? "s" : ""}
              {resultados.length === 20 && " (mostrando máx. 20)"}
            </p>
            {resultados.length > 0 &&
              (busquedaActualId ? (
                <button
                  onClick={handleActualizarGuardada}
                  className="flex items-center gap-1.5 text-xs font-semibold text-[#0D2340] border border-[#0D2340] px-3 py-1.5 rounded-lg hover:bg-[#0D2340] hover:text-white transition-colors"
                  title="Actualizar resultados de esta búsqueda guardada"
                >
                  <RefreshCw className="w-3 h-3" /> Actualizar guardada
                </button>
              ) : (
                <button
                  onClick={handleGuardarBusqueda}
                  disabled={guardandoBusqueda}
                  className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#B8860B] px-3 py-1.5 rounded-lg hover:bg-[#9a7209] disabled:opacity-60 transition-colors"
                >
                  <Star className="w-3 h-3" />
                  {guardandoBusqueda ? "Guardando..." : "Guardar búsqueda"}
                </button>
              ))}
          </div>

          {importMsg && (
            <div
              className={`text-xs px-3 py-2 rounded-lg mb-3 ${
                importMsg.startsWith("✓")
                  ? "text-green-700 bg-green-50 border border-green-200"
                  : "text-red-600 bg-red-50 border border-red-200"
              }`}
            >
              {importMsg}
            </div>
          )}

          {resultados.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">
              No se encontraron resultados.
            </p>
          )}

          <div className="space-y-2.5">
            {resultados.map((proc, idx) => (
              <div
                key={proc.idProceso}
                className="border border-gray-200 rounded-lg bg-white overflow-hidden"
              >
                <div className="p-4">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="text-sm font-black text-[#0D2340] font-mono break-all">
                      {proc.llaveProceso}
                    </span>
                    {proc.esPrivado && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200 text-gray-500">
                        Privado
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 mb-1">
                    <span className="font-semibold text-[#0D2340]">Despacho:</span> {proc.despacho}
                  </p>
                  {proc.departamento && (
                    <p className="text-xs text-gray-500 mb-1">
                      <span className="font-semibold">Departamento:</span> {proc.departamento}
                    </p>
                  )}
                  {proc.sujetosProcesales && (
                    <p className="text-xs text-gray-500 mb-1 line-clamp-2">
                      <span className="font-semibold">Partes:</span> {proc.sujetosProcesales}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] text-gray-400">
                    <span>Fecha: {formatFecha(proc.fechaProceso)}</span>
                    <span>Última act.: {formatFecha(proc.fechaUltimaActuacion)}</span>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-3">
                    <button
                      onClick={() => handleImportar(proc, idx)}
                      disabled={importando === idx}
                      className="text-xs font-bold text-white bg-[#0D2340] px-3 py-1.5 rounded-lg hover:bg-[#1A3A62] disabled:opacity-60 transition-colors"
                    >
                      {importando === idx ? "Importando..." : "Importar como proceso"}
                    </button>
                    <button
                      onClick={() => handleVerActuaciones(proc, idx)}
                      disabled={cargandoActs === idx}
                      className="text-xs font-semibold text-[#0D2340] border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {cargandoActs === idx
                        ? "Cargando..."
                        : expandido === idx
                          ? "Ocultar actuaciones"
                          : "Ver actuaciones"}
                    </button>
                  </div>
                </div>

                {expandido === idx && (
                  <div className="border-t border-gray-200 bg-gray-50 p-4">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                      Actuaciones ({proc.actuaciones?.length ?? 0})
                    </p>
                    {!proc.actuaciones?.length ? (
                      <p className="text-xs text-gray-400 italic">
                        No se encontraron actuaciones.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {proc.actuaciones.map((act: any, i: number) => (
                          <div
                            key={act.idRegActuacion ?? i}
                            className="border border-gray-200 rounded-lg px-3 py-2.5 bg-white"
                          >
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <span className="text-xs font-bold text-[#0D2340]">
                                {act.actuacion}
                              </span>
                              <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">
                                {formatFecha(act.fechaActuacion)}
                              </span>
                            </div>
                            {act.anotacion && (
                              <p className="text-[11px] text-gray-600 leading-relaxed">
                                {act.anotacion}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
