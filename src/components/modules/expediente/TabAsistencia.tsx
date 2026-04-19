"use client";

import { useState } from "react";
import { partyDisplayName } from "@/types";
import { StatusChip } from "@/components/ui/StatusChip";
import { sumarDiasHabiles, siguienteDiaHabil } from "@/lib/dias-habiles-colombia";
import {
  Calendar,
  UserCheck,
  UserX,
  AlertTriangle,
  Loader2,
  Save,
  Plus,
  ShieldCheck,
  ShieldAlert,
  StickyNote,
} from "lucide-react";

/* ─── Props ─────────────────────────────────────────────────────────────── */

interface TabAsistenciaProps {
  caseId: string;
  hearings: any[];
  parties: any[];
  attorneys: any[];
  attendance: any[];
}

/* ─── Component ─────────────────────────────────────────────────────────── */

export function TabAsistencia({
  caseId,
  hearings,
  parties,
  attorneys,
  attendance,
}: TabAsistenciaProps) {
  const [saving, setSaving] = useState<string | null>(null);

  // Resolver apoderado activo por parte (el primero activo)
  const apoderadoActivoPorParte = new Map<string, any>();
  for (const ca of attorneys) {
    if (ca.activo && !apoderadoActivoPorParte.has(ca.party_id)) {
      apoderadoActivoPorParte.set(ca.party_id, ca);
    }
  }

  const [localAttendance, setLocalAttendance] = useState<Record<string, any>>(
    () => {
      const map: Record<string, any> = {};
      for (const a of attendance) {
        // Auto-resolver attorney_id si está vacío y hay apoderado activo
        let rec = a;
        if (!a.attorney_id) {
          const activo = apoderadoActivoPorParte.get(a.party_id);
          if (activo?.attorney_id) {
            rec = {
              ...a,
              attorney_id: activo.attorney_id,
              representado_por_nombre: activo.attorney?.nombre ?? a.representado_por_nombre,
            };
          }
        }
        map[`${a.hearing_id}-${a.party_id}`] = rec;
      }
      return map;
    }
  );

  // Mapa de apoderados (activos e inactivos) por party_id para el select
  const activeAttorneysByParty = new Map<string, any[]>();
  for (const ca of attorneys) {
    const arr = activeAttorneysByParty.get(ca.party_id) ?? [];
    arr.push(ca);
    activeAttorneysByParty.set(ca.party_id, arr);
  }

  // Detectar cambio de apoderado entre audiencias
  function getAttorneyForHearing(
    hearingId: string,
    partyId: string
  ): string | null {
    const key = `${hearingId}-${partyId}`;
    return localAttendance[key]?.attorney_id ?? null;
  }

  function hasSwitchedAttorney(
    hearingIdx: number,
    partyId: string
  ): boolean {
    if (hearingIdx === 0) return false;
    const prevHearing = hearings[hearingIdx - 1];
    const currHearing = hearings[hearingIdx];
    const prevAttorney = getAttorneyForHearing(prevHearing.id, partyId);
    const currAttorney = getAttorneyForHearing(currHearing.id, partyId);
    if (!prevAttorney || !currAttorney) return false;
    return prevAttorney !== currAttorney;
  }

  // PATCH asistencia
  async function handleUpdate(
    hearingId: string,
    partyId: string,
    field: string,
    value: any
  ) {
    const key = `${hearingId}-${partyId}`;
    setSaving(key);

    // Optimistic update
    setLocalAttendance((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        hearing_id: hearingId,
        party_id: partyId,
        [field]: value,
      },
    }));

    // Si el campo que cambia NO es attorney_id pero el registro tiene
    // un attorney_id resuelto localmente (ej. por auto-asignación),
    // incluirlo en el PATCH para persistirlo también.
    const currentRecord = localAttendance[key];
    const payload: Record<string, any> = {
      hearing_id: hearingId,
      party_id: partyId,
      [field]: value,
    };
    if (field !== "attorney_id" && currentRecord?.attorney_id) {
      payload.attorney_id = currentRecord.attorney_id;
    }

    try {
      const res = await fetch(`/api/expediente/${caseId}/asistencia`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Error al actualizar asistencia");
        // Revert
        setLocalAttendance((prev) => {
          const copy = { ...prev };
          const existing = attendance.find(
            (a: any) =>
              a.hearing_id === hearingId && a.party_id === partyId
          );
          if (existing) {
            copy[key] = existing;
          } else {
            delete copy[key];
          }
          return copy;
        });
        return;
      }

      const data = await res.json();
      if (data.attendance) {
        setLocalAttendance((prev) => ({
          ...prev,
          [key]: data.attendance,
        }));
      }
    } catch {
      alert("Error de conexión");
    } finally {
      setSaving(null);
    }
  }

  // POST registrar asistencia (crear registros iniciales)
  async function handleRegisterAttendance(hearingId: string) {
    setSaving(`register-${hearingId}`);
    try {
      const res = await fetch(`/api/expediente/${caseId}/asistencia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hearing_id: hearingId }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Error al registrar asistencia");
        return;
      }

      window.location.reload();
    } catch {
      alert("Error de conexión");
    } finally {
      setSaving(null);
    }
  }

  if (hearings.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
        <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500 font-medium">
          No hay audiencias registradas
        </p>
        <p className="text-xs text-gray-400 mt-1 mb-3">
          Las audiencias deben programarse primero desde la gestión del caso.
        </p>
        <a
          href={`/casos/${caseId}/audiencia`}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1B4F9B] text-white rounded-lg text-sm font-medium hover:bg-[#1B4F9B]/90 transition-colors"
        >
          Programar audiencia
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {hearings.map((hearing: any, hIdx: number) => {
        const hearingParties = parties;
        const hasAttendanceRecords = hearingParties.some(
          (cp: any) => localAttendance[`${hearing.id}-${cp.party_id}`]
        );
        const canRegister =
          hearing.estado === "programada" || hearing.estado === "en_curso";

        return (
          <section
            key={hearing.id}
            className="bg-white rounded-xl shadow-sm border border-gray-100"
          >
            {/* Header de audiencia */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-[#0D2340] text-base">
                  Audiencia #{hIdx + 1}
                </h3>
                <span className="text-sm text-gray-500 capitalize">
                  {hearing.tipo?.replace(/_/g, " ")}
                </span>
                <span className="text-sm text-gray-400">
                  {new Date(hearing.fecha_hora).toLocaleString("es-CO", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "America/Bogota",
                  })}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <StatusChip value={hearing.estado} type="hearing" />
                {hearing.estado === "finalizada" && (
                  <a
                    href={`/expediente/${caseId}?tab=documentos`}
                    className="inline-flex items-center gap-1 text-xs text-[#1B4F9B] hover:underline font-medium"
                  >
                    Ver acta/documentos
                  </a>
                )}
                {canRegister && !hasAttendanceRecords && (
                  <button
                    onClick={() => handleRegisterAttendance(hearing.id)}
                    disabled={saving === `register-${hearing.id}`}
                    className="inline-flex items-center gap-1.5 bg-[#1B4F9B] text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-[#a07509] transition-colors disabled:opacity-50"
                  >
                    {saving === `register-${hearing.id}` ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    Registrar asistencia
                  </button>
                )}
              </div>
            </div>

            {/* Tabla de asistencia */}
            {hasAttendanceRecords ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left">
                      <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                        Parte
                      </th>
                      <th className="px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider text-center w-24">
                        Asistió
                      </th>
                      <th className="px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                        Representado por
                      </th>
                      <th className="px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider text-center w-28">
                        Poder verificado
                      </th>
                      <th className="px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                        Notas
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {hearingParties.map((cp: any) => {
                      const party = cp.party;
                      if (!party) return null;
                      const key = `${hearing.id}-${cp.party_id}`;
                      const record = localAttendance[key];
                      if (!record) return null;

                      const switched = hasSwitchedAttorney(hIdx, cp.party_id);
                      const isSaving = saving === key;

                      // Apoderados de esta parte
                      const partyAttorneys =
                        activeAttorneysByParty.get(cp.party_id) ?? [];

                      return (
                        <tr
                          key={key}
                          className={`transition-colors ${
                            switched
                              ? "bg-yellow-50"
                              : "hover:bg-gray-50/50"
                          }`}
                        >
                          {/* Parte */}
                          <td className="px-5 py-3">
                            <div>
                              <p className="font-medium text-gray-900">
                                {partyDisplayName(party)}
                              </p>
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                                  cp.rol === "convocante"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-orange-100 text-orange-700"
                                }`}
                              >
                                {cp.rol === "convocante"
                                  ? "Convocante"
                                  : "Convocado"}
                              </span>
                              {switched && (
                                <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">
                                  <AlertTriangle className="w-3 h-3" />
                                  Nuevo apoderado
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Asistió */}
                          <td className="px-3 py-3 text-center">
                            <button
                              onClick={() =>
                                handleUpdate(
                                  hearing.id,
                                  cp.party_id,
                                  "asistio",
                                  !record.asistio
                                )
                              }
                              disabled={isSaving}
                              className="mx-auto flex items-center justify-center disabled:opacity-50"
                            >
                              {isSaving ? (
                                <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                              ) : record.asistio ? (
                                <UserCheck className="w-5 h-5 text-green-500" />
                              ) : (
                                <UserX className="w-5 h-5 text-gray-300 hover:text-red-400" />
                              )}
                            </button>
                          </td>

                          {/* Representado por */}
                          <td className="px-3 py-3">
                            <select
                              value={record.attorney_id ?? ""}
                              onChange={(e) =>
                                handleUpdate(
                                  hearing.id,
                                  cp.party_id,
                                  "attorney_id",
                                  e.target.value || null
                                )
                              }
                              disabled={isSaving}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 w-full max-w-[200px] focus:outline-none focus:ring-1 focus:ring-[#1B4F9B] disabled:opacity-50"
                            >
                              <option value="">Sin representación</option>
                              {partyAttorneys.map((ca: any) => (
                                <option
                                  key={ca.attorney_id}
                                  value={ca.attorney_id}
                                >
                                  {ca.attorney?.nombre ?? ca.attorney_id}
                                  {!ca.activo ? " (inactivo)" : ""}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Poder verificado */}
                          <td className="px-3 py-3 text-center">
                            <button
                              onClick={() =>
                                handleUpdate(
                                  hearing.id,
                                  cp.party_id,
                                  "poder_verificado",
                                  !record.poder_verificado
                                )
                              }
                              disabled={isSaving}
                              className="mx-auto flex items-center justify-center disabled:opacity-50"
                            >
                              {isSaving ? (
                                <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                              ) : record.poder_verificado ? (
                                <ShieldCheck className="w-5 h-5 text-green-500" />
                              ) : (
                                <ShieldAlert className="w-5 h-5 text-gray-300 hover:text-amber-400" />
                              )}
                            </button>
                          </td>

                          {/* Notas */}
                          <td className="px-3 py-3">
                            <NotasInline
                              value={record.notas ?? ""}
                              isSaving={isSaving}
                              onSave={(text) =>
                                handleUpdate(
                                  hearing.id,
                                  cp.party_id,
                                  "notas",
                                  text
                                )
                              }
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-6 py-6 text-center text-sm text-gray-400">
                {canRegister
                  ? "Haz clic en \"Registrar asistencia\" para iniciar el control de asistencia."
                  : "No se registró asistencia para esta audiencia."}
              </div>
            )}

            {/* Sección finalizar */}
            {(hearing.estado === "programada" || hearing.estado === "en_curso") && hasAttendanceRecords && (
              <FinalizarAudiencia
                caseId={caseId}
                hearing={hearing}
              />
            )}
          </section>
        );
      })}
    </div>
  );
}

/* ─── Componente auxiliar: Finalizar audiencia ─────────────────────────── */

function FinalizarAudiencia({ caseId, hearing }: { caseId: string; hearing: any }) {
  const [resultado, setResultado] = useState("");
  const [fechaCont, setFechaCont] = useState("");
  const [maxFecha, setMaxFecha] = useState("");
  const [sugerida, setSugerida] = useState("");
  const [savingFin, setSavingFin] = useState(false);
  const [errorFin, setErrorFin] = useState("");

  function handleResultadoChange(val: string) {
    setResultado(val);
    if (val === "suspendida") {
      const audienciaDate = new Date(hearing.fecha_hora);
      const diaSiguiente = new Date(audienciaDate);
      diaSiguiente.setDate(diaSiguiente.getDate() + 1);

      const sug = siguienteDiaHabil(diaSiguiente);
      const max = sumarDiasHabiles(diaSiguiente, 10);

      setSugerida(sug.toISOString().split("T")[0]);
      setFechaCont(sug.toISOString().split("T")[0]);
      setMaxFecha(max.toISOString().split("T")[0]);
    } else {
      setFechaCont("");
      setMaxFecha("");
      setSugerida("");
    }
  }

  async function handleFinalizar() {
    if (!resultado) return;

    if (resultado === "suspendida" && fechaCont) {
      const audienciaDate = new Date(hearing.fecha_hora);
      const diaSiguiente = new Date(audienciaDate);
      diaSiguiente.setDate(diaSiguiente.getDate() + 1);
      const selected = new Date(fechaCont);
      const max = sumarDiasHabiles(diaSiguiente, 10);

      if (selected > max) {
        setErrorFin("La fecha de continuación no puede superar los 10 días hábiles desde el día siguiente de la audiencia");
        return;
      }
    }

    setSavingFin(true);
    setErrorFin("");

    try {
      const res = await fetch(`/api/casos/${caseId}/audiencias`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hearing_id: hearing.id,
          estado: resultado === "suspendida" ? "suspendida" : "finalizada",
          resultado,
          fecha_continuacion: resultado === "suspendida" ? fechaCont : null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setErrorFin(err.error ?? "Error al finalizar");
        return;
      }

      window.location.reload();
    } catch {
      setErrorFin("Error de conexión");
    } finally {
      setSavingFin(false);
    }
  }

  return (
    <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">Finalizar audiencia</h4>

      {errorFin && (
        <div className="bg-red-50 text-red-700 text-xs px-3 py-2 rounded-lg mb-3 border border-red-200">
          {errorFin}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 max-w-xl">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Resultado</label>
          <select
            value={resultado}
            onChange={(e) => handleResultadoChange(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F9B]"
          >
            <option value="">Seleccionar...</option>
            <option value="acuerdo_total">Acuerdo total</option>
            <option value="acuerdo_parcial">Acuerdo parcial</option>
            <option value="no_acuerdo">No acuerdo</option>
            <option value="suspendida">Suspendida - continuar</option>
          </select>
        </div>

        {resultado === "suspendida" && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Fecha de continuación
              {sugerida && <span className="text-gray-400 font-normal"> (sugerida: {new Date(sugerida + "T12:00:00").toLocaleDateString("es-CO")})</span>}
            </label>
            <input
              type="date"
              value={fechaCont}
              onChange={(e) => setFechaCont(e.target.value)}
              min={sugerida}
              max={maxFecha}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F9B]"
            />
            {maxFecha && (
              <p className="text-[10px] text-gray-400 mt-1">
                Máximo: {new Date(maxFecha + "T12:00:00").toLocaleDateString("es-CO")} (10 días hábiles)
              </p>
            )}
          </div>
        )}
      </div>

      <button
        onClick={handleFinalizar}
        disabled={!resultado || savingFin}
        className="mt-4 bg-[#0D2340] text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-[#0d2340dd] transition-colors disabled:opacity-50"
      >
        {savingFin ? "Finalizando..." : "Finalizar audiencia"}
      </button>
    </div>
  );
}

/* ─── Componente auxiliar: Notas inline ─────────────────────────────────── */

function NotasInline({
  value,
  isSaving,
  onSave,
}: {
  value: string;
  isSaving: boolean;
  onSave: (text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="text-xs border border-gray-200 rounded px-2 py-1 w-36 focus:outline-none focus:ring-1 focus:ring-[#1B4F9B]"
          placeholder="Nota..."
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onSave(text);
              setEditing(false);
            }
            if (e.key === "Escape") {
              setText(value);
              setEditing(false);
            }
          }}
        />
        <button
          onClick={() => {
            onSave(text);
            setEditing(false);
          }}
          disabled={isSaving}
          className="text-xs text-[#1B4F9B] hover:underline"
        >
          {isSaving ? "..." : "OK"}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        setText(value);
        setEditing(true);
      }}
      className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
    >
      <StickyNote className="w-3 h-3" />
      {value
        ? value.length > 25
          ? value.slice(0, 25) + "..."
          : value
        : "Agregar nota"}
    </button>
  );
}
