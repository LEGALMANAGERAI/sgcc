"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface ActuacionRama {
  idRegActuacion: number;
  fechaActuacion: string;
  actuacion: string;
  anotacion: string;
  fechaInicial?: string;
  fechaFinal?: string;
}

interface ProcesoRama {
  idProceso: number;
  llaveProceso: string;
  fechaProceso: string;
  fechaUltimaActuacion: string;
  despacho: string;
  departamento: string;
  sujetosProcesales: string;
  esPrivado: boolean;
  actuaciones: ActuacionRama[];
  actuacionesError?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Número del proceso para consultar (llaveProceso / radicado). */
  radicadoInicial: string;
  /** ID del sgcc_watched_processes. Si se pasa, habilita botón de sincronización. */
  watchedProcessId?: string;
}

function formatFechaRama(fechaStr: string) {
  if (!fechaStr) return "—";
  const d = new Date(fechaStr);
  if (isNaN(d.getTime())) return fechaStr;
  return d.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Modal para consultar un proceso en la Rama Judicial y (opcionalmente)
 * sincronizar sus actuaciones contra un proceso vigilado existente.
 *
 * Portado desde legados/src/app/(dashboard)/procesos/RamaJudicialModal.tsx.
 */
export function RamaJudicialModal({
  open,
  onClose,
  radicadoInicial,
  watchedProcessId,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultados, setResultados] = useState<ProcesoRama[] | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    nuevas: number;
    total: number;
    errorActuaciones?: boolean;
    mensaje?: string;
  } | null>(null);

  useEffect(() => {
    if (!open) {
      setResultados(null);
      setError(null);
      setSyncResult(null);
      setSelectedIdx(0);
      return;
    }
    if (!radicadoInicial) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      setError(null);
      setResultados(null);
      try {
        const res = await fetch(
          `/api/rama-judicial?radicado=${encodeURIComponent(radicadoInicial)}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (cancel) return;
        if (!res.ok) throw new Error(data.error || "Error consultando la Rama Judicial");
        setResultados(data.procesos);
        setSelectedIdx(0);
      } catch (err: any) {
        if (cancel) return;
        setError(err.message);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [open, radicadoInicial]);

  const procesoSeleccionado = resultados?.[selectedIdx];

  async function handleSincronizar() {
    if (!watchedProcessId) return;
    setSyncing(true);
    setError(null);
    setSyncResult(null);
    try {
      const res = await fetch(`/api/vigilancia/${watchedProcessId}/sync-rama`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al sincronizar");
      setSyncResult({
        nuevas: data.nuevas ?? 0,
        total: data.total ?? 0,
        errorActuaciones: data.errorActuaciones,
        mensaje: data.mensaje,
      });
      if (!data.errorActuaciones) router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Consultar Rama Judicial" size="lg">
      <ModalBody>
        {loading && (
          <div className="text-center py-8">
            <Loader2 className="w-6 h-6 mx-auto mb-2 text-[#0D2340] animate-spin" />
            <p className="text-sm text-gray-500">Consultando la Rama Judicial...</p>
            <p className="text-xs text-gray-400 mt-1">Esto puede tomar hasta 15 segundos</p>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 mb-4">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {resultados && procesoSeleccionado && (
          <div className="space-y-4">
            {resultados.length > 1 && (
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                  {resultados.length} procesos — selecciona uno:
                </p>
                <div className="space-y-1.5">
                  {resultados.map((p, i) => (
                    <button
                      key={p.idProceso}
                      onClick={() => setSelectedIdx(i)}
                      className={`w-full text-left text-xs px-3 py-2 rounded-lg border transition-colors ${
                        i === selectedIdx
                          ? "border-[#0D2340] bg-[#0D2340]/5 text-[#0D2340] font-semibold"
                          : "border-gray-200 hover:bg-gray-50 text-gray-600"
                      }`}
                    >
                      <span className="font-mono">{p.llaveProceso}</span>
                      <span className="ml-2 text-gray-500">{p.despacho}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Info proceso */}
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-2">
              <div className="text-sm font-bold text-[#0D2340] mb-1">
                Información del proceso
              </div>
              <div className="grid grid-cols-1 gap-1 text-xs">
                <div>
                  <span className="font-semibold text-gray-600">Despacho: </span>
                  <span className="text-gray-800">{procesoSeleccionado.despacho}</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-600">Departamento: </span>
                  <span className="text-gray-800">{procesoSeleccionado.departamento}</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-600">Sujetos procesales: </span>
                  <span className="text-gray-800">
                    {procesoSeleccionado.sujetosProcesales || "—"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="font-semibold text-gray-600">Fecha inicio: </span>
                    <span className="text-gray-800">
                      {formatFechaRama(procesoSeleccionado.fechaProceso)}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-600">Última actuación: </span>
                    <span className="text-gray-800">
                      {formatFechaRama(procesoSeleccionado.fechaUltimaActuacion)}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="font-semibold text-gray-600">Radicado: </span>
                  <span className="font-mono text-gray-800">
                    {procesoSeleccionado.llaveProceso}
                  </span>
                </div>
              </div>
            </div>

            {/* Actuaciones */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                Actuaciones recientes ({procesoSeleccionado.actuaciones?.length ?? 0})
              </p>
              {procesoSeleccionado.actuacionesError ? (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                  ⚠ El servicio de actuaciones de la Rama Judicial no está disponible en
                  este momento. Puedes sincronizar más tarde.
                </div>
              ) : !procesoSeleccionado.actuaciones?.length ? (
                <p className="text-xs text-gray-400 italic px-2">
                  No se encontraron actuaciones registradas.
                </p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {procesoSeleccionado.actuaciones.map((act, i) => (
                    <div
                      key={act.idRegActuacion ?? i}
                      className="border border-gray-200 rounded-lg px-3 py-2.5 bg-white"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-xs font-bold text-[#0D2340]">
                          {act.actuacion}
                        </span>
                        <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">
                          {formatFechaRama(act.fechaActuacion)}
                        </span>
                      </div>
                      {act.anotacion && (
                        <p className="text-[11px] text-gray-600 leading-relaxed">
                          {act.anotacion}
                        </p>
                      )}
                      {(act.fechaInicial || act.fechaFinal) && (
                        <div className="flex gap-3 mt-1.5 text-[10px] text-gray-400">
                          {act.fechaInicial && (
                            <span>Inicio: {formatFechaRama(act.fechaInicial)}</span>
                          )}
                          {act.fechaFinal && (
                            <span className="text-[#B8860B] font-semibold">
                              Término: {formatFechaRama(act.fechaFinal)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {syncResult && (
              syncResult.errorActuaciones ? (
                <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold">No se pudieron traer las actuaciones</p>
                    <p className="text-xs mt-0.5">
                      {syncResult.mensaje ??
                        "El servicio de actuaciones de la Rama Judicial no respondió. Intentá de nuevo en unos minutos."}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <CheckCircle2 className="w-4 h-4" />
                  {syncResult.nuevas > 0
                    ? `Proceso sincronizado — ${syncResult.nuevas} ${
                        syncResult.nuevas === 1
                          ? "nueva actuación registrada"
                          : "nuevas actuaciones registradas"
                      }`
                    : "Proceso sincronizado — sin actuaciones nuevas"}
                </div>
              )
            )}
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
        {watchedProcessId &&
          resultados &&
          (!syncResult || syncResult.errorActuaciones) && (
            <Button onClick={handleSincronizar} disabled={syncing}>
              {syncing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-1.5" />
                  {syncResult?.errorActuaciones ? "Reintentar" : "Sincronizar proceso"}
                </>
              )}
            </Button>
          )}
      </ModalFooter>
    </Modal>
  );
}
