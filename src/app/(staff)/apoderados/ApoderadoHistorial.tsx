"use client";

import { useState, useEffect } from "react";
import { X, Loader2, FileText, Calendar, ArrowRight } from "lucide-react";
import Link from "next/link";

interface Props {
  attorneyId: string;
  nombre: string;
  onClose: () => void;
}

interface CaseAttorneyRecord {
  id: string;
  case_id: string;
  party_id: string;
  activo: boolean;
  motivo_cambio: string | null;
  poder_vigente_desde: string | null;
  poder_vigente_hasta: string | null;
  poder_url: string | null;
  created_at: string;
  caso: { numero_radicado: string; materia: string; estado: string } | null;
  party: { nombres: string | null; apellidos: string | null; razon_social: string | null } | null;
}

export function ApoderadoHistorial({ attorneyId, nombre, onClose }: Props) {
  const [records, setRecords] = useState<CaseAttorneyRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistorial();
  }, [attorneyId]);

  async function fetchHistorial() {
    try {
      const res = await fetch(`/api/apoderados/${attorneyId}/historial`);
      if (res.ok) {
        const data = await res.json();
        setRecords(data);
      }
    } catch {
      // silenciar
    } finally {
      setLoading(false);
    }
  }

  function formatDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("es-CO", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  const motivoLabel: Record<string, string> = {
    inicial: "Registro inicial",
    renuncia: "Renuncia",
    revocatoria: "Revocatoria",
    sustitucion: "Sustitución",
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-[#0D2340]">Historial de {nombre}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Participación en casos del centro
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No hay registros de participación</p>
            </div>
          ) : (
            <div className="space-y-3">
              {records.map((r) => {
                const partyName = r.party
                  ? r.party.razon_social ?? [r.party.nombres, r.party.apellidos].filter(Boolean).join(" ")
                  : "—";

                return (
                  <div
                    key={r.id}
                    className={`border rounded-xl p-4 ${
                      r.activo
                        ? "border-green-200 bg-green-50/30"
                        : "border-gray-200 bg-gray-50/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Link
                            href={`/expediente/${r.case_id}?tab=poderes`}
                            className="text-sm font-medium text-[#1B4F9B] hover:underline"
                          >
                            {r.caso?.numero_radicado ?? "Sin radicado"}
                          </Link>
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              r.activo
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {r.activo ? "Activo" : "Inactivo"}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600">
                          Representa a: <strong>{partyName}</strong>
                        </p>
                        <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[10px] text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Desde: {formatDate(r.poder_vigente_desde ?? r.created_at)}
                          </span>
                          {r.poder_vigente_hasta && (
                            <span>Hasta: {formatDate(r.poder_vigente_hasta)}</span>
                          )}
                          {r.motivo_cambio && (
                            <span className="px-1.5 py-0.5 bg-gray-100 rounded">
                              {motivoLabel[r.motivo_cambio] ?? r.motivo_cambio}
                            </span>
                          )}
                          {r.caso?.estado && (
                            <span className="capitalize">
                              Caso: {r.caso.estado}
                            </span>
                          )}
                        </div>
                      </div>
                      {r.poder_url && (
                        <a
                          href={r.poder_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 text-xs text-[#1B4F9B] hover:underline flex items-center gap-1"
                        >
                          <FileText className="w-3 h-3" />
                          Poder
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
