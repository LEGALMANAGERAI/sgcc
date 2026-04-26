"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, AlertTriangle, XCircle } from "lucide-react";

const MOTIVO_MIN = 20;

export function EliminarExpediente({ caseId, numeroRadicado }: { caseId: string; numeroRadicado: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const motivoOk = motivo.trim().length >= MOTIVO_MIN;
  const puedeEliminar = motivoOk && confirmado && !loading;

  function cerrar() {
    if (loading) return;
    setOpen(false);
    setMotivo("");
    setConfirmado(false);
    setError(null);
  }

  async function eliminar() {
    if (!puedeEliminar) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/casos/${caseId}/eliminar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: motivo.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? "Error al eliminar");
        setLoading(false);
        return;
      }
      // Redirigir al listado
      router.push("/casos");
      router.refresh();
    } catch (e: any) {
      setError(`Error de conexión: ${e?.message ?? "intenta de nuevo"}`);
      setLoading(false);
    }
  }

  return (
    <>
      <div className="mt-8 pt-6 border-t border-gray-200">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-red-800">Zona de peligro</h3>
              <p className="text-xs text-red-700 mt-1">
                Eliminar un expediente lo retira de todas las vistas del centro. Quedará registro de
                quién lo eliminó, cuándo y por qué; si necesitas restaurarlo, contáctanos.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg px-3 py-1.5 hover:bg-red-700 transition-colors flex-shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Eliminar expediente
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md my-8">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-red-700">Eliminar expediente</h3>
              <button
                type="button"
                onClick={cerrar}
                disabled={loading}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                Vas a eliminar el expediente <strong>{numeroRadicado}</strong>. Quedará oculto en
                todas las vistas, pero conservaremos un registro auditable de esta acción.
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Motivo de la eliminación <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={4}
                  placeholder="Ej: Caso radicado por error con datos de prueba; el solicitante pidió retiro por escrito el 20/04/2026; ..."
                  className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500/30 ${
                    motivo.length > 0 && !motivoOk ? "border-red-300 bg-red-50/30" : "border-gray-300"
                  }`}
                  disabled={loading}
                />
                <p className={`text-[11px] mt-1 ${motivoOk ? "text-gray-500" : "text-red-600"}`}>
                  {motivo.trim().length}/{MOTIVO_MIN} caracteres mínimos.
                </p>
              </div>

              <label className="flex items-start gap-2 text-xs text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={confirmado}
                  onChange={(e) => setConfirmado(e.target.checked)}
                  disabled={loading}
                  className="mt-0.5"
                />
                <span>
                  Confirmo que entiendo que este expediente quedará oculto en todas las vistas del centro.
                </span>
              </label>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
                  {error}
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={cerrar}
                disabled={loading}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={eliminar}
                disabled={!puedeEliminar}
                className="inline-flex items-center gap-2 bg-red-600 text-white text-sm font-medium rounded-lg px-4 py-2 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Eliminar definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
