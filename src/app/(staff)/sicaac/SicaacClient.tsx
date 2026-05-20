"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Loader2, CheckCircle2, Clock, Search, Download, X, Plus, Trash2,
} from "lucide-react";

export interface SicaacRegistro {
  id: string;
  origen: "expediente" | "manual";
  tipo: "expediente" | "acta" | "constancia";
  referencia: string;
  tramite: string | null;
  fecha: string | null;
  estado: "pendiente" | "registrado";
  numero_registro: string | null;
  fecha_registro: string | null;
  observaciones: string | null;
}

type Filtro = "todos" | "pendiente" | "registrado";

const TIPO_LABEL: Record<string, string> = {
  expediente: "Expediente",
  acta: "Acta",
  constancia: "Constancia",
};

export function SicaacClient({ registrosIniciales }: { registrosIniciales: SicaacRegistro[] }) {
  const router = useRouter();
  const [registros, setRegistros] = useState<SicaacRegistro[]>(registrosIniciales);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState<SicaacRegistro | null>(null);
  const [creando, setCreando] = useState(false);

  const filtrados = useMemo(() => {
    return registros.filter((r) => {
      if (filtro !== "todos" && r.estado !== filtro) return false;
      if (busqueda) {
        const q = busqueda.toLowerCase();
        const text = `${r.referencia} ${r.numero_registro ?? ""}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [registros, filtro, busqueda]);

  const conteo = useMemo(() => {
    let pendiente = 0, registrado = 0;
    for (const r of registros) {
      if (r.estado === "pendiente") pendiente++;
      else registrado++;
    }
    return { total: registros.length, pendiente, registrado };
  }, [registros]);

  function exportarCSV() {
    const headers = ["Origen", "Tipo", "Referencia", "Trámite", "Fecha", "Estado SICAAC", "N° registro", "Fecha registro"];
    const rows = filtrados.map((r) => [
      r.origen === "expediente" ? "SIGECC" : "Manual",
      TIPO_LABEL[r.tipo] ?? r.tipo,
      r.referencia,
      r.tramite ?? "",
      r.fecha ?? "",
      r.estado === "registrado" ? "Registrado" : "Pendiente",
      r.numero_registro ?? "",
      r.fecha_registro ?? "",
    ]);
    const csv = headers.join(",") + "\n" +
      rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sicaac-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function eliminarManual(id: string, referencia: string) {
    if (!confirm(`¿Eliminar el registro manual "${referencia}"?`)) return;
    const res = await fetch(`/api/sicaac/manual/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "Error al eliminar");
      return;
    }
    setRegistros((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Kpi label="Total" value={conteo.total} color="navy" />
        <Kpi label="Pendientes" value={conteo.pendiente} color="amber" />
        <Kpi label="Registrados" value={conteo.registrado} color="green" />
      </div>

      <div className="flex flex-wrap gap-2 items-center bg-white border border-gray-200 rounded-xl p-3">
        <div className="flex gap-1">
          {(["todos", "pendiente", "registrado"] as Filtro[]).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize ${
                filtro === f ? "bg-[#0D2340] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por radicado, número de acta o registro SICAAC..."
            className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]/30"
          />
        </div>
        <button
          onClick={() => setCreando(true)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-[#0D2340] text-white hover:bg-[#0d2340dd]"
        >
          <Plus className="w-3.5 h-3.5" /> Registro manual
        </button>
        <button
          onClick={exportarCSV}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-[#1B4F9B]/10 text-[#1B4F9B] hover:bg-[#1B4F9B]/20"
        >
          <Download className="w-3.5 h-3.5" /> Exportar CSV
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-left text-xs text-gray-600">
              <th className="px-4 py-2.5 font-semibold">Origen</th>
              <th className="px-4 py-2.5 font-semibold">Tipo</th>
              <th className="px-4 py-2.5 font-semibold">Referencia</th>
              <th className="px-4 py-2.5 font-semibold">Fecha</th>
              <th className="px-4 py-2.5 font-semibold">Estado SICAAC</th>
              <th className="px-4 py-2.5 font-semibold">N° registro</th>
              <th className="px-4 py-2.5 font-semibold">Fecha registro</th>
              <th className="px-4 py-2.5 font-semibold text-center">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtrados.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">Sin registros con los filtros aplicados.</td></tr>
            ) : (
              filtrados.map((r) => (
                <tr key={`${r.origen}-${r.id}`} className="hover:bg-gray-50/50">
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                      r.origen === "expediente" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"
                    }`}>
                      {r.origen === "expediente" ? "SIGECC" : "Manual"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">{TIPO_LABEL[r.tipo] ?? r.tipo}</td>
                  <td className="px-4 py-2.5">
                    {r.origen === "expediente" ? (
                      <Link href={`/expediente/${r.id}`} className="text-[#1B4F9B] hover:underline font-mono text-xs">
                        {r.referencia}
                      </Link>
                    ) : (
                      <span className="text-gray-800">{r.referencia}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 text-xs">
                    {r.fecha ? new Date(r.fecha + "T00:00:00").toLocaleDateString("es-CO") : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    {r.estado === "registrado" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
                        <CheckCircle2 className="w-3 h-3" /> Registrado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">
                        <Clock className="w-3 h-3" /> Pendiente
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{r.numero_registro ?? "—"}</td>
                  <td className="px-4 py-2.5 text-gray-600 text-xs">
                    {r.fecha_registro ? new Date(r.fecha_registro + "T00:00:00").toLocaleDateString("es-CO") : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => setEditando(r)}
                        className="px-2 py-1 rounded-md text-[11px] font-medium bg-[#1B4F9B]/10 text-[#1B4F9B] hover:bg-[#1B4F9B]/20"
                      >
                        {r.estado === "registrado" ? "Editar" : "Marcar"}
                      </button>
                      {r.origen === "manual" && (
                        <button
                          onClick={() => eliminarManual(r.id, r.referencia)}
                          className="px-1.5 py-1 rounded-md text-red-600 hover:bg-red-50"
                          title="Eliminar registro manual"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editando && (
        <ModalEstado
          registro={editando}
          onClose={() => setEditando(null)}
          onSaved={(upd) => {
            setRegistros((prev) => prev.map((r) => (r.origen === upd.origen && r.id === upd.id ? upd : r)));
            setEditando(null);
            router.refresh();
          }}
        />
      )}

      {creando && (
        <ModalManual
          onClose={() => setCreando(false)}
          onCreated={(nuevo) => {
            setRegistros((prev) => [nuevo, ...prev]);
            setCreando(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: number; color: "navy" | "amber" | "green" }) {
  const c = color === "navy" ? "text-[#0D2340]" : color === "amber" ? "text-amber-600" : "text-green-600";
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-bold ${c}`}>{value}</p>
    </div>
  );
}

function ModalEstado({
  registro, onClose, onSaved,
}: {
  registro: SicaacRegistro;
  onClose: () => void;
  onSaved: (r: SicaacRegistro) => void;
}) {
  const [estado, setEstado] = useState(registro.estado);
  const [numero, setNumero] = useState(registro.numero_registro ?? "");
  const [fecha, setFecha] = useState(registro.fecha_registro ?? "");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setError("");
    if (estado === "registrado" && (!numero.trim() || !fecha)) {
      setError("Para marcar como registrado se requieren número y fecha");
      return;
    }
    setGuardando(true);
    try {
      const endpoint = registro.origen === "expediente"
        ? `/api/sicaac/expediente/${registro.id}`
        : `/api/sicaac/manual/${registro.id}`;
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado,
          numero_registro: estado === "registrado" ? numero.trim() : null,
          fecha_registro: estado === "registrado" ? fecha : null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Error al guardar");
        return;
      }
      onSaved({
        ...registro,
        estado,
        numero_registro: estado === "registrado" ? numero.trim() : null,
        fecha_registro: estado === "registrado" ? fecha : null,
      });
    } catch {
      setError("Error de conexión");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg text-[#0D2340]">Estado SICAAC</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-gray-500">
          {TIPO_LABEL[registro.tipo] ?? registro.tipo}: <span className="font-mono">{registro.referencia}</span>
        </p>
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-600">Estado</label>
          <div className="flex gap-2">
            {(["pendiente", "registrado"] as const).map((e) => (
              <button key={e} onClick={() => setEstado(e)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize ${
                  estado === e ? "bg-[#0D2340] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}>{e}</button>
            ))}
          </div>
        </div>
        {estado === "registrado" && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Número de registro SICAAC</label>
              <input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Ej: 12345-2026"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de registro</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]/30" />
            </div>
          </>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md">Cancelar</button>
          <button onClick={guardar} disabled={guardando}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#0D2340] text-white rounded-md text-sm font-medium hover:bg-[#0D2340]/90 disabled:opacity-50">
            {guardando && <Loader2 className="w-4 h-4 animate-spin" />} Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalManual({
  onClose, onCreated,
}: {
  onClose: () => void;
  onCreated: (r: SicaacRegistro) => void;
}) {
  const [tipo, setTipo] = useState<"acta" | "constancia" | "expediente">("acta");
  const [referencia, setReferencia] = useState("");
  const [fecha, setFecha] = useState("");
  const [estado, setEstado] = useState<"pendiente" | "registrado">("pendiente");
  const [numero, setNumero] = useState("");
  const [fechaReg, setFechaReg] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setError("");
    if (!referencia.trim()) { setError("La referencia es requerida"); return; }
    if (estado === "registrado" && (!numero.trim() || !fechaReg)) {
      setError("Para marcar como registrado se requieren número y fecha de registro");
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch("/api/sicaac", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo, referencia: referencia.trim(), fecha: fecha || null, estado,
          numero_registro: estado === "registrado" ? numero.trim() : null,
          fecha_registro: estado === "registrado" ? fechaReg : null,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error ?? "Error al crear"); return; }
      onCreated({
        id: d.id, origen: "manual", tipo, referencia: referencia.trim(), tramite: null,
        fecha: fecha || null, estado,
        numero_registro: estado === "registrado" ? numero.trim() : null,
        fecha_registro: estado === "registrado" ? fechaReg : null,
        observaciones: null,
      });
    } catch {
      setError("Error de conexión");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg text-[#0D2340]">Registro manual SICAAC</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-gray-500">Para actas/constancias gestionadas por fuera de SIGECC.</p>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
          <div className="flex gap-2">
            {(["acta", "constancia", "expediente"] as const).map((t) => (
              <button key={t} onClick={() => setTipo(t)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize ${
                  tipo === t ? "bg-[#0D2340] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}>{t}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Referencia (n° de acta / radicado / descripción) *</label>
          <input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Ej: Acta 045-2026"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]/30" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Fecha del documento</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]/30" />
        </div>
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-600">Estado</label>
          <div className="flex gap-2">
            {(["pendiente", "registrado"] as const).map((e) => (
              <button key={e} onClick={() => setEstado(e)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize ${
                  estado === e ? "bg-[#0D2340] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}>{e}</button>
            ))}
          </div>
        </div>
        {estado === "registrado" && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Número de registro SICAAC</label>
              <input value={numero} onChange={(e) => setNumero(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de registro</label>
              <input type="date" value={fechaReg} onChange={(e) => setFechaReg(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]/30" />
            </div>
          </>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md">Cancelar</button>
          <button onClick={guardar} disabled={guardando}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#0D2340] text-white rounded-md text-sm font-medium hover:bg-[#0D2340]/90 disabled:opacity-50">
            {guardando && <Loader2 className="w-4 h-4 animate-spin" />} Crear
          </button>
        </div>
      </div>
    </div>
  );
}
