"use client";

import { useState, useEffect } from "react";
import { Clock, Play, AlertTriangle } from "lucide-react";
import { ClientDate } from "@/components/ui/ClientDate";

interface Props {
  caseId: string;
  fechaInicioTermino: string | null;
  diasTermino: number;
  diasHabilesTranscurridos: number;
  diasHabilesRestantes: number;
  fechaLimite: string | null;
  prorrogado: boolean;
}

export function ContadorTermino({
  caseId,
  fechaInicioTermino,
  diasTermino,
  diasHabilesTranscurridos,
  diasHabilesRestantes,
  fechaLimite,
  prorrogado,
}: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleProrrogar() {
    if (!confirm("¿Confirma prorrogar el término por 30 días hábiles adicionales? Los 30 días se contarán desde el día siguiente al vencimiento del término inicial.")) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/expediente/${caseId}/termino`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "prorrogar" }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Error al prorrogar");
        return;
      }
      window.location.reload();
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  async function handleIniciar() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/expediente/${caseId}/termino`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "iniciar" }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Error al iniciar término");
        return;
      }
      window.location.reload();
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  // Sin término iniciado
  if (!fechaInicioTermino) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gray-100">
              <Clock className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Término del procedimiento</p>
              <p className="text-xs text-gray-500">{diasTermino} días hábiles — No iniciado</p>
            </div>
          </div>
          <button
            onClick={handleIniciar}
            disabled={loading}
            className="inline-flex items-center gap-1.5 bg-[#1B4F9B] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#164080] transition-colors disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            {loading ? "Iniciando..." : "Iniciar término"}
          </button>
        </div>
        {error && (
          <p className="text-xs text-red-600 mt-2">{error}</p>
        )}
      </div>
    );
  }

  // Término iniciado - mostrar contador
  const porcentaje = Math.min((diasHabilesTranscurridos / diasTermino) * 100, 100);
  const esUrgente = diasHabilesRestantes <= 10;
  const esVencido = diasHabilesRestantes <= 0;

  const barColor = esVencido
    ? "bg-red-500"
    : esUrgente
    ? "bg-amber-500"
    : "bg-[#1B4F9B]";

  const bgColor = esVencido
    ? "bg-red-50 border-red-200"
    : esUrgente
    ? "bg-amber-50 border-amber-200"
    : "bg-white border-gray-100";

  if (!mounted) {
    return (
      <div className="rounded-xl shadow-sm border bg-gray-50 border-gray-200 p-5 text-sm text-gray-400">
        Cargando término...
      </div>
    );
  }

  return (
    <div className={`rounded-xl shadow-sm border p-5 ${bgColor}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${esVencido ? "bg-red-100" : esUrgente ? "bg-amber-100" : "bg-blue-50"}`}>
            {esUrgente || esVencido ? (
              <AlertTriangle className={`w-5 h-5 ${esVencido ? "text-red-500" : "text-amber-500"}`} />
            ) : (
              <Clock className="w-5 h-5 text-[#1B4F9B]" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">
              Término del procedimiento
              {prorrogado && <span className="text-amber-600 ml-2">— Prorrogado (+30 días)</span>}
              {esVencido && <span className="text-red-600 ml-2">— VENCIDO</span>}
            </p>
            <p className="text-xs text-gray-500">
              Inicio: <ClientDate iso={fechaInicioTermino + "T12:00:00"} mode="date" />
              {fechaLimite && (
                <>
                  {" · "}Límite: <ClientDate iso={fechaLimite + "T12:00:00"} mode="date" />
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Botón prorrogar: solo si no ha sido prorrogado y quedan ≤10 días o vencido */}
          {!prorrogado && (esUrgente || esVencido) && (
            <button
              onClick={handleProrrogar}
              disabled={loading}
              className="inline-flex items-center gap-1.5 bg-amber-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-amber-600 transition-colors disabled:opacity-50"
            >
              {loading ? "..." : "+ 30 días"}
            </button>
          )}
          <div className="text-right">
            <p className={`text-2xl font-bold ${esVencido ? "text-red-600" : esUrgente ? "text-amber-600" : "text-[#1B4F9B]"}`}>
              {diasHabilesRestantes}
            </p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">días hábiles restantes</p>
          </div>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${porcentaje}%` }}
        />
      </div>
      <div className="flex justify-between mt-1.5 text-[10px] text-gray-400">
        <span>{diasHabilesTranscurridos} días transcurridos</span>
        <span>{diasTermino} días totales</span>
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}
