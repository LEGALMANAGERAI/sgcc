"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { StaffRol } from "@/types";

export interface VinculoRow {
  id: string;
  estado: "solicitado" | "activo" | "rechazado" | "revocado";
  case_id: string | null;
  created_at: string;
  resuelto_at: string | null;
  asistente_id: string;
  asistente_nombre: string;
  asistente_email: string;
  conciliador_id: string;
  conciliador_nombre: string;
  caso_radicado: string | null;
}

export interface OpcionPersona {
  id: string;
  nombre: string;
}

export interface OpcionCaso {
  id: string;
  numero_radicado: string;
}

interface Props {
  rol: StaffRol;
  staffId: string;
  vinculos: VinculoRow[];
  asistentes?: OpcionPersona[];
  conciliadores?: OpcionPersona[];
  misCasos?: OpcionCaso[];
}

const ESTADO_BADGE: Record<VinculoRow["estado"], string> = {
  solicitado: "bg-yellow-100 text-yellow-800",
  activo: "bg-green-100 text-green-800",
  rechazado: "bg-red-100 text-red-800",
  revocado: "bg-gray-100 text-gray-600",
};

function alcanceLabel(v: VinculoRow): string {
  return v.caso_radicado ? `Expediente ${v.caso_radicado}` : `Todos los casos de ${v.conciliador_nombre}`;
}

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" });
}

export function AsistentesClient({ rol, staffId, vinculos, asistentes, conciliadores, misCasos }: Props) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [showHistorial, setShowHistorial] = useState(false);

  const puedeAprobar = rol === "admin" || rol === "conciliador";

  const solicitudes = vinculos.filter((v) => v.estado === "solicitado");
  const activos = vinculos.filter((v) => v.estado === "activo");
  const historial = vinculos.filter((v) => v.estado === "rechazado" || v.estado === "revocado");

  async function patchVinculo(id: string, accion: "aprobar" | "rechazar" | "revocar") {
    setLoadingId(id);
    setError("");
    try {
      const res = await fetch(`/api/asistentes/vinculos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Error actualizando el vínculo");
      }
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div role="status" className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
        La asistente solo ve los expedientes a los que está vinculada. Toda acta que redacte pasa primero por la
        revisión del conciliador antes de enviarse a las partes.
      </div>

      {error && (
        <div role="status" className="rounded-lg bg-red-50 text-red-700 text-sm p-3">
          {error}
        </div>
      )}

      {/* Solicitudes pendientes */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-700 mb-3">Solicitudes pendientes</h3>
        {!solicitudes.length ? (
          <p className="text-sm text-gray-400">No hay solicitudes pendientes.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {solicitudes.map((v) => (
              <li key={v.id} className="flex items-center justify-between py-3 gap-3">
                <div className="text-sm">
                  <p className="font-medium text-[#0D2340]">
                    {v.asistente_nombre} <span className="text-gray-400 font-normal">→</span> {v.conciliador_nombre}
                  </p>
                  <p className="text-gray-500">{alcanceLabel(v)} · solicitado el {fmtFecha(v.created_at)}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {puedeAprobar ? (
                    <>
                      <button
                        onClick={() => patchVinculo(v.id, "aprobar")}
                        disabled={loadingId === v.id}
                        className="bg-[#0D2340] text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-[#0d2340dd] disabled:opacity-50"
                      >
                        Aprobar
                      </button>
                      <button
                        onClick={() => patchVinculo(v.id, "rechazar")}
                        disabled={loadingId === v.id}
                        className="text-red-500 hover:underline text-xs font-medium disabled:opacity-50"
                      >
                        Rechazar
                      </button>
                    </>
                  ) : (
                    v.asistente_id === staffId && (
                      <button
                        onClick={() => patchVinculo(v.id, "revocar")}
                        disabled={loadingId === v.id}
                        className="text-red-500 hover:underline text-xs font-medium disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                    )
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Vínculos activos */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <h3 className="font-semibold text-gray-700 px-5 pt-5">Vínculos activos</h3>
        <table className="w-full min-w-[700px] text-sm mt-3">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Asistente</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Conciliador</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Alcance</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Desde</th>
              <th className="text-right px-5 py-3 font-semibold text-gray-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {!activos.length ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-gray-400">
                  Todavía no hay vínculos activos
                </td>
              </tr>
            ) : (
              activos.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3 font-medium text-[#0D2340]">{v.asistente_nombre}</td>
                  <td className="px-5 py-3 text-gray-600">{v.conciliador_nombre}</td>
                  <td className="px-5 py-3 text-gray-600">{alcanceLabel(v)}</td>
                  <td className="px-5 py-3 text-gray-500">{fmtFecha(v.resuelto_at ?? v.created_at)}</td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => {
                        const msg = rol === "asistente" ? "¿Dejar de colaborar con este conciliador?" : "¿Quitar el acceso de esta asistente?";
                        if (!confirm(msg)) return;
                        patchVinculo(v.id, "revocar");
                      }}
                      disabled={loadingId === v.id}
                      className="text-red-500 hover:underline text-xs font-medium disabled:opacity-50"
                    >
                      {rol === "asistente" ? "Dejar de colaborar" : "Quitar acceso"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="h-2" />
      </section>

      {/* Historial */}
      {historial.length > 0 && (
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <button
            type="button"
            onClick={() => setShowHistorial((s) => !s)}
            className="text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            {showHistorial ? "Ocultar historial" : `Ver historial (${historial.length})`}
          </button>
          {showHistorial && (
            <ul className="divide-y divide-gray-50 mt-3">
              {historial.map((v) => (
                <li key={v.id} className="flex items-center justify-between py-2.5 gap-3 text-sm">
                  <div>
                    <p className="text-gray-600">
                      {v.asistente_nombre} → {v.conciliador_nombre}{" "}
                      <span className="text-gray-400">· {alcanceLabel(v)}</span>
                    </p>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_BADGE[v.estado]}`}>
                    {v.estado}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Formulario */}
      <VinculoForm
        rol={rol}
        asistentes={asistentes ?? []}
        conciliadores={conciliadores ?? []}
        misCasos={misCasos ?? []}
        onError={setError}
      />
    </div>
  );
}

interface FormProps {
  rol: StaffRol;
  asistentes: OpcionPersona[];
  conciliadores: OpcionPersona[];
  misCasos: OpcionCaso[];
  onError: (msg: string) => void;
}

function VinculoForm({ rol, asistentes, conciliadores, misCasos, onError }: FormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [asistenteId, setAsistenteId] = useState("");
  const [conciliadorId, setConciliadorId] = useState("");
  const [alcance, setAlcance] = useState<"todos" | "puntual">("todos");
  const [caseId, setCaseId] = useState("");
  const [numeroRadicado, setNumeroRadicado] = useState("");

  function resetForm() {
    setAsistenteId("");
    setConciliadorId("");
    setAlcance("todos");
    setCaseId("");
    setNumeroRadicado("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onError("");

    const body: Record<string, string> = {};
    if (rol !== "conciliador") body.conciliador_id = conciliadorId;
    if (rol !== "asistente") body.asistente_id = asistenteId;
    if (alcance === "puntual") {
      if (rol === "conciliador") {
        if (!caseId) return onError("Selecciona un expediente");
        body.case_id = caseId;
      } else {
        if (!numeroRadicado.trim()) return onError("Escribe el número de radicado");
        body.numero_radicado = numeroRadicado.trim();
      }
    }
    if (rol !== "conciliador" && !conciliadorId) return onError("Selecciona un conciliador");
    if (rol !== "asistente" && !asistenteId) return onError("Selecciona una asistente");

    setLoading(true);
    try {
      const res = await fetch("/api/asistentes/vinculos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Error creando el vínculo");
      resetForm();
      router.refresh();
    } catch (err: any) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const titulo = rol === "asistente" ? "Solicitar vínculo" : "Vincular asistente";
  const sinConciliadores = rol !== "conciliador" && conciliadores.length === 0;

  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 className="font-semibold text-gray-700 mb-4">{titulo}</h3>

      {rol === "admin" && asistentes.length === 0 && (
        <p className="text-sm text-gray-400 mb-3">No hay asistentes activas en el centro.</p>
      )}
      {sinConciliadores && (
        <p className="text-sm text-gray-400 mb-3">No hay conciliadores activos en el centro.</p>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rol !== "asistente" && (
          <div>
            <label htmlFor="asistente_id" className="block text-sm font-medium text-gray-700 mb-1">
              Asistente *
            </label>
            <select
              id="asistente_id"
              required
              value={asistenteId}
              onChange={(e) => setAsistenteId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
            >
              <option value="">Selecciona una asistente</option>
              {asistentes.map((a) => (
                <option key={a.id} value={a.id}>{a.nombre}</option>
              ))}
            </select>
          </div>
        )}

        {rol !== "conciliador" && (
          <div>
            <label htmlFor="conciliador_id" className="block text-sm font-medium text-gray-700 mb-1">
              Conciliador *
            </label>
            <select
              id="conciliador_id"
              required
              value={conciliadorId}
              onChange={(e) => setConciliadorId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
            >
              <option value="">Selecciona un conciliador</option>
              {conciliadores.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
        )}

        <fieldset className="md:col-span-2">
          <legend className="block text-sm font-medium text-gray-700 mb-1">Alcance *</legend>
          <div className="flex flex-col sm:flex-row gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                name="alcance"
                checked={alcance === "todos"}
                onChange={() => setAlcance("todos")}
              />
              {rol === "asistente" ? "Todos sus casos" : rol === "conciliador" ? "Todos mis casos" : "Todos los casos del conciliador"}
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                name="alcance"
                checked={alcance === "puntual"}
                onChange={() => setAlcance("puntual")}
              />
              Un expediente
            </label>
          </div>
        </fieldset>

        {alcance === "puntual" && rol === "conciliador" && (
          <div className="md:col-span-2">
            <label htmlFor="case_id" className="block text-sm font-medium text-gray-700 mb-1">
              Expediente *
            </label>
            <select
              id="case_id"
              required
              value={caseId}
              onChange={(e) => setCaseId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
            >
              <option value="">Selecciona un expediente</option>
              {misCasos.map((c) => (
                <option key={c.id} value={c.id}>{c.numero_radicado}</option>
              ))}
            </select>
            {misCasos.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">No tienes expedientes abiertos.</p>
            )}
          </div>
        )}

        {alcance === "puntual" && rol !== "conciliador" && (
          <div className="md:col-span-2">
            <label htmlFor="numero_radicado" className="block text-sm font-medium text-gray-700 mb-1">
              Número de radicado *
            </label>
            <input
              id="numero_radicado"
              required
              value={numeroRadicado}
              onChange={(e) => setNumeroRadicado(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
              placeholder="Ej: 2026-001"
            />
          </div>
        )}

        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={loading}
            className="bg-[#0D2340] text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-[#0d2340dd] transition-colors disabled:opacity-50"
          >
            {loading ? "Enviando..." : rol === "asistente" ? "Solicitar" : "Vincular"}
          </button>
        </div>
      </form>
    </section>
  );
}
