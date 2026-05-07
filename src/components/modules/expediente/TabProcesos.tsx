"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Scale,
  Search,
  Plus,
  Upload,
  FileText,
  Download,
  Loader2,
  Bell,
  MapPin,
  Calendar,
  ExternalLink,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { RamaJudicialModal } from "@/app/(staff)/vigilancia/RamaJudicialModal";

interface ProcesoVinculado {
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
}

interface DocumentoVigilancia {
  id: string;
  nombre: string;
  url: string | null;
  storage_path: string | null;
  created_at: string;
  descripcion: string | null;
}

interface ResultadoBusqueda {
  idProceso: number;
  llaveProceso: string;
  despacho: string;
  departamento: string;
  sujetosProcesales: string;
  fechaProceso: string;
  fechaUltimaActuacion: string;
  esPrivado: boolean;
}

interface Props {
  caseId: string;
  procesos: ProcesoVinculado[];
  documentos: DocumentoVigilancia[];
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

export function TabProcesos({ caseId, procesos, documentos }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal de detalle del proceso
  const [modal, setModal] = useState<{
    open: boolean;
    radicado: string;
    watchedProcessId: string;
    procesoLocal?: any;
  }>({ open: false, radicado: "", watchedProcessId: "" });

  // Buscador inline
  const [showBuscador, setShowBuscador] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoBusqueda[] | null>(null);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);
  const [importandoIdx, setImportandoIdx] = useState<number | null>(null);

  // Subida de documentos
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  function abrirModal(p: ProcesoVinculado) {
    setModal({
      open: true,
      radicado: p.numero_proceso,
      watchedProcessId: p.id,
      procesoLocal: {
        despacho: p.despacho,
        departamento: p.departamento,
        sujetosProcesales: p.sujetos_procesales,
        ultimaActuacion: p.ultima_actuacion,
        ultimaActuacionFecha:
          p.ultima_actuacion_fecha ?? p.rama_ultima_actuacion_fecha,
      },
    });
  }

  async function buscar() {
    const q = busqueda.trim();
    if (!q) return;
    setBuscando(true);
    setErrorBusqueda(null);
    setResultados(null);
    try {
      const res = await fetch(
        `/api/rama-judicial?radicado=${encodeURIComponent(q)}`,
        { cache: "no-store" }
      );
      const text = await res.text();
      let data: any;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(
          res.status === 504
            ? "La consulta tardó demasiado. Intenta de nuevo."
            : `Error del servidor (${res.status}).`
        );
      }
      if (!res.ok) throw new Error(data.error || "Error consultando la Rama Judicial");
      setResultados(data.procesos ?? []);
    } catch (e: any) {
      setErrorBusqueda(e.message ?? "Error");
    } finally {
      setBuscando(false);
    }
  }

  async function importarYVincular(p: ResultadoBusqueda, idx: number) {
    setImportandoIdx(idx);
    setErrorBusqueda(null);
    try {
      const res = await fetch("/api/vigilancia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numero_proceso: p.llaveProceso,
          despacho: p.despacho,
          ciudad: p.departamento,
          case_id: caseId,
          rama_id_proceso: p.idProceso,
          departamento: p.departamento,
          sujetos_procesales: p.sujetosProcesales,
          fecha_proceso: p.fechaProceso,
          es_privado: p.esPrivado,
          rama_ultima_actuacion_fecha: p.fechaUltimaActuacion,
        }),
      });
      const text = await res.text();
      let data: any;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error("Respuesta inválida del servidor");
      }
      if (!res.ok) throw new Error(data.error || "Error al importar");
      setShowBuscador(false);
      setBusqueda("");
      setResultados(null);
      router.refresh();
    } catch (e: any) {
      setErrorBusqueda(e.message ?? "Error");
    } finally {
      setImportandoIdx(null);
    }
  }

  async function handleUploadFile(file: File) {
    setUploadError(null);
    if (file.type !== "application/pdf") {
      setUploadError("El archivo debe ser PDF");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("El archivo no puede superar 10 MB");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("tipo", "vigilancia");
      fd.append("nombre", file.name.replace(/\.pdf$/i, ""));
      const res = await fetch(`/api/expediente/${caseId}/documentos`, {
        method: "POST",
        body: fd,
      });
      const text = await res.text();
      let data: any;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error("Respuesta inválida del servidor");
      }
      if (!res.ok) throw new Error(data.error || "Error al subir el PDF");
      router.refresh();
    } catch (e: any) {
      setUploadError(e.message ?? "Error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Procesos vinculados al caso ──────────────────────────────────── */}
      <Card padding="md">
        <div className="flex items-center gap-3 pb-3 mb-3 border-b border-gray-200">
          <div className="p-2 rounded-lg bg-[#0D2340]/10">
            <Scale className="w-4 h-4 text-[#0D2340]" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-gray-800">
                Procesos vinculados al caso
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#0D2340] text-white">
                {procesos.length}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              Procesos vigilados en la Rama Judicial relacionados con este expediente
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowBuscador((v) => !v)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#0D2340] text-white hover:bg-[#0d2340dd] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Importar proceso
          </button>
        </div>

        {/* Buscador inline */}
        {showBuscador && (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-blue-900 uppercase tracking-[0.05em]">
                Buscar en la Rama Judicial
              </p>
              <button
                type="button"
                onClick={() => {
                  setShowBuscador(false);
                  setBusqueda("");
                  setResultados(null);
                  setErrorBusqueda(null);
                }}
                className="text-blue-900 opacity-60 hover:opacity-100"
                title="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    buscar();
                  }
                }}
                placeholder="Pega el número de radicado (23 dígitos)"
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#0D2340]"
              />
              <button
                type="button"
                onClick={buscar}
                disabled={buscando || !busqueda.trim()}
                className="inline-flex items-center gap-1 px-4 py-2 rounded-md bg-[#0D2340] text-white text-sm font-medium hover:bg-[#0d2340dd] transition-colors disabled:opacity-60"
              >
                {buscando ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Buscar
              </button>
            </div>

            {errorBusqueda && (
              <p className="text-xs text-red-700 mt-2 px-1">{errorBusqueda}</p>
            )}

            {resultados && resultados.length === 0 && (
              <p className="text-xs text-gray-500 mt-2 px-1 italic">
                No se encontraron procesos.
              </p>
            )}

            {resultados && resultados.length > 0 && (
              <div className="mt-3 space-y-2">
                {resultados.map((r, i) => (
                  <div
                    key={r.idProceso}
                    className="flex items-start justify-between gap-2 bg-white border border-gray-200 rounded-md p-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-xs font-bold text-[#0D2340] break-all">
                        {r.llaveProceso}
                      </div>
                      <div className="text-[11px] text-gray-700 line-clamp-1 mt-0.5">
                        {r.despacho}
                      </div>
                      {r.departamento && (
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          {r.departamento}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => importarYVincular(r, i)}
                      disabled={importandoIdx !== null}
                      className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
                    >
                      {importandoIdx === i ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Plus className="w-3 h-3" />
                      )}
                      Importar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Lista de procesos */}
        {procesos.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6 italic">
            Aún no hay procesos vinculados a este expediente. Usa &quot;Importar proceso&quot; para
            traer uno desde la Rama Judicial.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {procesos.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => abrirModal(p)}
                title="Ver detalle del proceso"
                className="text-left border border-gray-200 rounded-lg p-3 bg-white hover:border-[#0D2340] hover:shadow-sm cursor-pointer transition-all"
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
                  <ExternalLink className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
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
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* ── Documentos del proceso ──────────────────────────────────────── */}
      <Card padding="md">
        <div className="flex items-center gap-3 pb-3 mb-3 border-b border-gray-200">
          <div className="p-2 rounded-lg bg-amber-100">
            <FileText className="w-4 h-4 text-amber-700" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-gray-800">
                Documentos del proceso
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-700 text-white">
                {documentos.length}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              PDFs vinculados a la vigilancia (autos, edictos, escritos relacionados)
            </div>
          </div>
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-600 text-white hover:bg-amber-700 transition-colors disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            Subir PDF
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUploadFile(f);
              e.target.value = "";
            }}
          />
        </div>

        {uploadError && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-3">
            {uploadError}
          </div>
        )}

        {documentos.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6 italic">
            No hay documentos del proceso aún. Usa &quot;Subir PDF&quot; para agregar.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {documentos.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between py-2.5 px-1"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <FileText className="w-4 h-4 text-amber-700 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {d.nombre}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {formatDate(d.created_at)}
                    </p>
                  </div>
                </div>
                {d.url && (
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-[#1B4F9B]/10 text-[#1B4F9B] hover:bg-[#1B4F9B]/20"
                  >
                    <Download className="w-3 h-3" />
                    Descargar
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <RamaJudicialModal
        open={modal.open}
        onClose={() =>
          setModal({ open: false, radicado: "", watchedProcessId: "" })
        }
        radicadoInicial={modal.radicado}
        watchedProcessId={modal.watchedProcessId}
        procesoLocal={modal.procesoLocal}
      />
    </div>
  );
}
