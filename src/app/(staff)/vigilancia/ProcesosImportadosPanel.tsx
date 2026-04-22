"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Scale,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MapPin,
  Calendar,
  Bell,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { RamaJudicialModal } from "./RamaJudicialModal";

interface Importado {
  id: string;
  numero_proceso: string;
  despacho: string | null;
  departamento: string | null;
  sujetos_procesales: string | null;
  ultima_actuacion: string | null;
  ultima_actuacion_fecha: string | null;
  rama_ultima_actuacion_fecha: string | null;
  rama_id_proceso: number | null;
  actuaciones_no_leidas: number;
  caso?: { id: string; numero_radicado: string } | null;
}

interface Props {
  procesos: Importado[];
}

function formatDate(d: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const PREVIEW = 4;

/**
 * Panel con los procesos que fueron importados desde la Rama Judicial
 * (tienen rama_id_proceso). Muestra una lista compacta con radicado,
 * despacho, última actuación y un botón para sincronizar on-demand.
 *
 * Por defecto muestra los 4 más recientes; "Ver todos" expande la lista.
 */
export function ProcesosImportadosPanel({ procesos }: Props) {
  const [expandido, setExpandido] = useState(false);
  const [modal, setModal] = useState<{
    open: boolean;
    radicado: string;
    watchedProcessId: string;
  }>({ open: false, radicado: "", watchedProcessId: "" });

  const total = procesos.length;
  const conNuevas = procesos.filter((p) => p.actuaciones_no_leidas > 0).length;
  const visibles = expandido ? procesos : procesos.slice(0, PREVIEW);

  function openModal(p: Importado) {
    setModal({ open: true, radicado: p.numero_proceso, watchedProcessId: p.id });
  }

  function closeModal() {
    setModal({ open: false, radicado: "", watchedProcessId: "" });
  }

  if (total === 0) {
    return (
      <Card padding="md">
        <div className="flex items-center gap-3 pb-3 mb-3 border-b border-gray-200">
          <div className="p-2 rounded-lg bg-[#0D2340]/10">
            <Scale className="w-4 h-4 text-[#0D2340]" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold text-gray-800">
              Procesos importados de la Rama Judicial
            </div>
            <div className="text-xs text-gray-500">
              Los procesos que importes desde el buscador aparecerán aquí
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-400 text-center py-4">
          Aún no hay procesos importados. Usá el buscador de arriba para traerlos de la Rama Judicial.
        </p>
      </Card>
    );
  }

  return (
    <>
      <Card padding="md">
        <div className="flex items-center gap-3 pb-3 mb-3 border-b border-gray-200">
          <div className="p-2 rounded-lg bg-[#0D2340]/10">
            <Scale className="w-4 h-4 text-[#0D2340]" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-gray-800">
                Procesos importados de la Rama Judicial
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#0D2340] text-white">
                {total}
              </span>
              {conNuevas > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                  <Bell className="w-3 h-3" /> {conNuevas} con novedad
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              Sincronización automática diaria + manual bajo demanda
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visibles.map((p) => (
            <div
              key={p.id}
              className="border border-gray-200 rounded-lg p-3 bg-white hover:border-[#0D2340]/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span className="text-xs font-mono font-black text-[#0D2340] break-all">
                      {p.numero_proceso}
                    </span>
                    {p.actuaciones_no_leidas > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
                        {p.actuaciones_no_leidas}
                      </span>
                    )}
                  </div>
                  {p.despacho && (
                    <p className="text-xs text-gray-700 line-clamp-1">
                      {p.despacho}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => openModal(p)}
                  title="Sincronizar con Rama Judicial"
                  className="flex-shrink-0 p-1.5 rounded-lg hover:bg-[#0D2340] hover:text-white text-gray-500 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-1 text-[11px] text-gray-500">
                {p.departamento && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate">{p.departamento}</span>
                  </div>
                )}
                {p.ultima_actuacion && (
                  <div className="flex items-start gap-1">
                    <Calendar className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-gray-700 line-clamp-2">
                        {p.ultima_actuacion}
                      </p>
                      <p className="text-gray-400">
                        {formatDate(
                          p.ultima_actuacion_fecha ??
                            p.rama_ultima_actuacion_fecha
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {p.caso && (
                <Link
                  href={`/expediente/${p.caso.id}`}
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#1B4F9B] hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  Caso {p.caso.numero_radicado}
                </Link>
              )}
            </div>
          ))}
        </div>

        {total > PREVIEW && (
          <div className="mt-3 pt-3 border-t border-gray-200 flex justify-center">
            <button
              onClick={() => setExpandido((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0D2340] hover:underline"
            >
              {expandido ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" /> Mostrar menos
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" /> Ver todos ({total})
                </>
              )}
            </button>
          </div>
        )}
      </Card>

      <RamaJudicialModal
        open={modal.open}
        onClose={closeModal}
        radicadoInicial={modal.radicado}
        watchedProcessId={modal.watchedProcessId}
      />
    </>
  );
}
