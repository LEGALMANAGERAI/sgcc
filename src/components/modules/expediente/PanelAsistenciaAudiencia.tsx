"use client";

import { useMemo, useState } from "react";
import {
  UserCheck,
  UserX,
  Loader2,
  Save,
  UserCog,
  ShieldCheck,
  ShieldAlert,
  CheckCircle,
  AlertCircle,
  History,
  ChevronDown,
  ChevronUp,
  FileText,
} from "lucide-react";
import { partyDisplayName } from "@/types";
import { CambiarApoderadoModal } from "./CambiarApoderadoModal";

interface PanelAsistenciaAudienciaProps {
  caseId: string;
  hearingId: string;
  partes: any[];                 // de contexto.caso.partes
  apoderadosVigentes: any[];     // de contexto.apoderadosVigentes (vigentes a la fecha)
  asistenciaInicial: any[];      // de contexto.asistencia
  historialApoderados?: any[];   // de contexto.historialApoderados (todos los registros del caso)
  onGuardado: () => void;        // refresh del contexto
}

const MOTIVO_CAMBIO_LABEL: Record<string, string> = {
  inicial: "Registro inicial",
  renuncia: "Renuncia",
  revocatoria: "Revocatoria",
  sustitucion: "Sustitución",
};

function fmtFechaCorta(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Bogota",
  });
}

interface AsistenciaLocal {
  party_id: string;
  attorney_id: string | null;
  asistio: boolean;
  representado_por_nombre: string | null;
  poder_verificado: boolean;
  notas: string | null;
}

export function PanelAsistenciaAudiencia({
  caseId,
  hearingId,
  partes,
  apoderadosVigentes,
  asistenciaInicial,
  historialApoderados = [],
  onGuardado,
}: PanelAsistenciaAudienciaProps) {
  const apoderadoPorParte = useMemo(() => {
    const map = new Map<string, any>();
    for (const ca of apoderadosVigentes) {
      if (!map.has(ca.party_id)) map.set(ca.party_id, ca);
    }
    return map;
  }, [apoderadosVigentes]);

  const historialPorParte = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const h of historialApoderados) {
      const arr = map.get(h.party_id) ?? [];
      arr.push(h);
      map.set(h.party_id, arr);
    }
    // Ya viene ordenado por created_at desc del endpoint
    return map;
  }, [historialApoderados]);

  const [historialAbiertoPara, setHistorialAbiertoPara] = useState<Set<string>>(
    new Set()
  );

  function toggleHistorial(partyId: string) {
    setHistorialAbiertoPara((prev) => {
      const copy = new Set(prev);
      if (copy.has(partyId)) copy.delete(partyId);
      else copy.add(partyId);
      return copy;
    });
  }

  const [rows, setRows] = useState<Record<string, AsistenciaLocal>>(() => {
    const map: Record<string, AsistenciaLocal> = {};
    for (const cp of partes) {
      const existente = asistenciaInicial.find((a) => a.party_id === cp.party_id);
      const apoderado = apoderadoPorParte.get(cp.party_id);
      map[cp.party_id] = existente
        ? {
            party_id: cp.party_id,
            attorney_id: existente.attorney_id ?? apoderado?.attorney_id ?? null,
            asistio: existente.asistio,
            representado_por_nombre:
              existente.representado_por_nombre ?? apoderado?.attorney?.nombre ?? null,
            poder_verificado: existente.poder_verificado,
            notas: existente.notas ?? null,
          }
        : {
            party_id: cp.party_id,
            attorney_id: apoderado?.attorney_id ?? null,
            asistio: false,
            representado_por_nombre: apoderado?.attorney?.nombre ?? null,
            poder_verificado: apoderado?.attorney?.verificado ?? false,
            notas: null,
          };
    }
    return map;
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardadoOk, setGuardadoOk] = useState(false);
  const [cambiarPara, setCambiarPara] = useState<{
    partyId: string;
    parteNombre: string;
    actualNombre?: string | null;
  } | null>(null);

  function toggleAsistio(partyId: string) {
    setRows((prev) => ({
      ...prev,
      [partyId]: { ...prev[partyId], asistio: !prev[partyId].asistio },
    }));
    setGuardadoOk(false);
  }

  function togglePoderVerificado(partyId: string) {
    setRows((prev) => ({
      ...prev,
      [partyId]: {
        ...prev[partyId],
        poder_verificado: !prev[partyId].poder_verificado,
      },
    }));
    setGuardadoOk(false);
  }

  async function guardar() {
    setSaving(true);
    setError(null);
    setGuardadoOk(false);
    try {
      const payload = {
        asistencia: Object.values(rows).map((r) => ({
          party_id: r.party_id,
          attorney_id: r.attorney_id,
          asistio: r.asistio,
          representado_por_nombre: r.representado_por_nombre,
          poder_verificado: r.poder_verificado,
          notas: r.notas,
        })),
      };
      const res = await fetch(
        `/api/casos/${caseId}/audiencia/${hearingId}/asistencia`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Error guardando asistencia");
      }
      setGuardadoOk(true);
      onGuardado();
    } catch (e: any) {
      setError(e.message ?? "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h4 className="text-sm font-bold text-[#0D2340] uppercase tracking-wide">
            Asistencia a la audiencia
          </h4>
          <p className="text-xs text-gray-500">
            Marca quiénes asistieron. Si cambió el apoderado de alguna parte, regístralo aquí.
          </p>
        </div>
        <button
          onClick={guardar}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#0D2340] hover:bg-[#1B4F9B] rounded-lg disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Guardando..." : "Guardar asistencia"}
        </button>
      </div>

      <div className="divide-y divide-gray-100">
        {partes.map((cp) => {
          const row = rows[cp.party_id];
          const apoderado = apoderadoPorParte.get(cp.party_id);
          const parteNombre = cp.party ? partyDisplayName(cp.party) : "—";

          return (
            <div key={cp.id} className="px-5 py-4">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[#0D2340]">{parteNombre}</p>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        cp.rol === "convocante"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      {cp.rol === "convocante" ? "Convocante" : "Convocado"}
                    </span>
                  </div>
                  {cp.party?.numero_doc && (
                    <p className="text-[11px] text-gray-500">
                      {cp.party.tipo_doc} {cp.party.numero_doc}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => toggleAsistio(cp.party_id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    row.asistio
                      ? "bg-green-100 text-green-700 hover:bg-green-200"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {row.asistio ? (
                    <>
                      <UserCheck className="w-3.5 h-3.5" />
                      Asistió
                    </>
                  ) : (
                    <>
                      <UserX className="w-3.5 h-3.5" />
                      No asistió
                    </>
                  )}
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between flex-wrap gap-3 bg-gray-50 rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <p className="text-[11px] text-gray-500 uppercase font-medium">
                    Apoderado vigente
                  </p>
                  {apoderado ? (
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-sm text-[#0D2340]">
                        {apoderado.attorney?.nombre}
                      </p>
                      {apoderado.attorney?.tarjeta_profesional && (
                        <span className="text-[11px] text-gray-400">
                          T.P. {apoderado.attorney.tarjeta_profesional}
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic mt-0.5">
                      Sin apoderado registrado
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {apoderado && (
                    <button
                      onClick={() => togglePoderVerificado(cp.party_id)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] font-medium ${
                        row.poder_verificado
                          ? "bg-green-100 text-green-700 hover:bg-green-200"
                          : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                      }`}
                      title="Marcar poder como verificado"
                    >
                      {row.poder_verificado ? (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Poder verificado
                        </>
                      ) : (
                        <>
                          <ShieldAlert className="w-3.5 h-3.5" />
                          Poder sin verificar
                        </>
                      )}
                    </button>
                  )}

                  {(historialPorParte.get(cp.party_id)?.length ?? 0) > 0 && (
                    <button
                      onClick={() => toggleHistorial(cp.party_id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] font-medium text-gray-600 bg-gray-100 hover:bg-gray-200"
                    >
                      <History className="w-3.5 h-3.5" />
                      Historial ({historialPorParte.get(cp.party_id)?.length ?? 0})
                      {historialAbiertoPara.has(cp.party_id) ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                  )}

                  <button
                    onClick={() =>
                      setCambiarPara({
                        partyId: cp.party_id,
                        parteNombre,
                        actualNombre: apoderado?.attorney?.nombre,
                      })
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] font-medium text-[#1B4F9B] bg-blue-50 hover:bg-blue-100"
                  >
                    <UserCog className="w-3.5 h-3.5" />
                    {apoderado ? "Cambiar apoderado" : "Registrar apoderado"}
                  </button>
                </div>
              </div>

              {historialAbiertoPara.has(cp.party_id) && (
                <HistorialApoderadosParte
                  registros={historialPorParte.get(cp.party_id) ?? []}
                />
              )}
            </div>
          );
        })}
      </div>

      {(error || guardadoOk) && (
        <div className="px-5 py-3 border-t border-gray-100">
          {error && (
            <div className="flex items-start gap-2 text-sm text-red-600">
              <AlertCircle className="w-4 h-4 mt-0.5" />
              {error}
            </div>
          )}
          {guardadoOk && (
            <div className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle className="w-4 h-4" />
              Asistencia guardada
            </div>
          )}
        </div>
      )}

      {cambiarPara && (
        <CambiarApoderadoModal
          caseId={caseId}
          partyId={cambiarPara.partyId}
          parteNombre={cambiarPara.parteNombre}
          apoderadoActualNombre={cambiarPara.actualNombre}
          onClose={() => setCambiarPara(null)}
          onSuccess={() => {
            setCambiarPara(null);
            onGuardado();
          }}
        />
      )}
    </div>
  );
}

function HistorialApoderadosParte({ registros }: { registros: any[] }) {
  if (!registros.length) return null;

  return (
    <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
      <p className="text-[11px] font-semibold text-gray-600 uppercase mb-2 flex items-center gap-1">
        <History className="w-3 h-3" />
        Historial de apoderados
      </p>
      <div className="space-y-2">
        {registros.map((r, idx) => {
          const isActive = r.activo === true;
          const esActual = idx === 0 && isActive;
          return (
            <div
              key={r.id}
              className={`flex items-start justify-between gap-3 p-2.5 rounded-lg border ${
                esActual
                  ? "bg-green-50 border-green-200"
                  : "bg-white border-gray-200"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-[#0D2340]">
                    {r.attorney?.nombre ?? "—"}
                  </p>
                  {esActual && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">
                      Actual
                    </span>
                  )}
                  {!esActual && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
                      Inactivo
                    </span>
                  )}
                  {r.motivo_cambio && (
                    <span className="text-[10px] text-gray-500">
                      · {MOTIVO_CAMBIO_LABEL[r.motivo_cambio] ?? r.motivo_cambio}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-gray-500">
                  {r.attorney?.numero_doc && (
                    <span>Doc: {r.attorney.numero_doc}</span>
                  )}
                  {r.attorney?.tarjeta_profesional && (
                    <span>T.P. {r.attorney.tarjeta_profesional}</span>
                  )}
                  <span>
                    Desde:{" "}
                    {fmtFechaCorta(r.poder_vigente_desde ?? r.created_at)}
                  </span>
                  {r.poder_vigente_hasta && (
                    <span>Hasta: {fmtFechaCorta(r.poder_vigente_hasta)}</span>
                  )}
                </div>
              </div>
              {r.poder_url && (
                <a
                  href={r.poder_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 inline-flex items-center gap-1 text-[11px] text-[#1B4F9B] hover:underline"
                  title="Ver poder"
                >
                  <FileText className="w-3 h-3" />
                  Poder
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
