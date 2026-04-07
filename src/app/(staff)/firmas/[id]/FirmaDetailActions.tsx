"use client";

import { useState } from "react";
import {
  Send,
  Bell,
  Download,
  XCircle,
  Loader2,
  CheckCircle2,
  FileDown,
} from "lucide-react";
import type { FirmaEstado } from "@/types/firma";

interface Props {
  documentId: string;
  estado: FirmaEstado;
  archivoUrl: string;
  archivoFirmadoUrl: string | null;
}

export function FirmaDetailActions({
  documentId,
  estado,
  archivoUrl,
  archivoFirmadoUrl,
}: Props) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const canEnviar = estado === "pendiente";
  const canRecordatorio = estado === "enviado" || estado === "en_proceso";
  const canCancelar = estado !== "completado" && estado !== "rechazado" && estado !== "expirado";
  const canDescargarFirmado = estado === "completado" && archivoFirmadoUrl;

  const doAction = async (action: string, method = "POST", body?: object) => {
    setLoadingAction(action);
    setResult(null);

    try {
      const res = await fetch(`/api/firmas/${documentId}/${action}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();

      if (!res.ok) {
        setResult({ type: "error", message: data.error ?? "Error al ejecutar la acci\u00f3n" });
      } else {
        setResult({ type: "success", message: data.message ?? "Acci\u00f3n completada" });
        // Recargar la p\u00e1gina para reflejar cambios
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch {
      setResult({ type: "error", message: "Error de conexi\u00f3n" });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCancelar = () => {
    doAction("cancelar");
    setShowCancelModal(false);
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Acciones</h3>

        {/* Resultado */}
        {result && (
          <div
            className={`mb-4 px-4 py-3 rounded-lg text-sm flex items-center gap-2 ${
              result.type === "success"
                ? "bg-green-50 border border-green-200 text-green-700"
                : "bg-red-50 border border-red-200 text-red-700"
            }`}
          >
            {result.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 flex-shrink-0" />
            )}
            {result.message}
          </div>
        )}

        <div className="space-y-2">
          {/* Enviar a firmantes */}
          {canEnviar && (
            <button
              onClick={() => doAction("enviar")}
              disabled={!!loadingAction}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0D2340] text-white rounded-lg text-sm font-medium hover:bg-[#0d2340dd] transition-colors disabled:opacity-50"
            >
              {loadingAction === "enviar" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Enviar a firmantes
            </button>
          )}

          {/* Recordatorio */}
          {canRecordatorio && (
            <button
              onClick={() => doAction("recordatorio")}
              disabled={!!loadingAction}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#B8860B] text-white rounded-lg text-sm font-medium hover:bg-[#a07609] transition-colors disabled:opacity-50"
            >
              {loadingAction === "recordatorio" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Bell className="w-4 h-4" />
              )}
              Enviar recordatorio
            </button>
          )}

          {/* Descargar PDF original */}
          <a
            href={archivoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            <Download className="w-4 h-4" />
            Descargar PDF original
          </a>

          {/* Descargar PDF firmado */}
          {canDescargarFirmado && (
            <a
              href={archivoFirmadoUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            >
              <FileDown className="w-4 h-4" />
              Descargar PDF firmado
            </a>
          )}

          {/* Cancelar */}
          {canCancelar && (
            <button
              onClick={() => setShowCancelModal(true)}
              disabled={!!loadingAction}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {loadingAction === "cancelar" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              Cancelar documento
            </button>
          )}
        </div>
      </div>

      {/* Modal de confirmaci\u00f3n de cancelaci\u00f3n */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm mx-4 w-full">
            <h4 className="text-lg font-semibold text-gray-900 mb-2">Cancelar documento</h4>
            <p className="text-sm text-gray-600 mb-6">
              Esta acci&#243;n no se puede deshacer. El documento ser&#225; cancelado y los firmantes
              no podr&#225;n acceder al enlace de firma.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Volver
              </button>
              <button
                onClick={handleCancelar}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
              >
                S&#237;, cancelar documento
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
