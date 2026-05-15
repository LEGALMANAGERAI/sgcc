"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, Clock, Search, Download, X } from "lucide-react";
import type { SicaacActaRow } from "./page";

type Filtro = "todas" | "pendiente" | "registrada";

const TIPO_LABEL: Record<string, string> = {
  acuerdo_total: "Acuerdo total",
  acuerdo_parcial: "Acuerdo parcial",
  no_acuerdo: "No acuerdo",
  inasistencia: "Inasistencia",
  desistimiento: "Desistimiento",
  improcedente: "Improcedente",
};

export function SicaacClient({ actasIniciales }: { actasIniciales: SicaacActaRow[] }) {
  const router = useRouter();
  const [actas, setActas] = useState<SicaacActaRow[]>(actasIniciales);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState<SicaacActaRow | null>(null);

  const filtradas = useMemo(() => {
    return actas.filter((a) => {
      if (filtro !== "todas" && a.sicaac_estado !== filtro) return false;
      if (busqueda) {
        const q = busqueda.toLowerCase();
        const text = `${a.numero_acta} ${a.caso?.numero_radicado ?? ""} ${a.sicaac_numero_registro ?? ""}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [actas, filtro, busqueda]);

  const conteo = useMemo(() => {
    let pendiente = 0;
    let registrada = 0;
    for (const a of actas) {
      if (a.sicaac_estado === "pendiente") pendiente++;
      else if (a.sicaac_estado === "registrada") registrada++;
    }
    return { total: actas.length, pendiente, registrada };
  }, [actas]);

  function exportarExcel() {
    const headers = [
      "Tipo",
      "Número",
      "Caso",
      "Fecha del acta",
      "Resultado",
      "Estado SICAAC",
      "Número registro",
      "Fecha registro",
    ];
    const rows = filtradas.map((a) => [
      a.es_constancia ? "Constancia" : "Acta",
      a.numero_acta,
      a.caso?.numero_radicado ?? "",
      a.fecha_acta,
      TIPO_LABEL[a.tipo] ?? a.tipo,
      a.sicaac_estado === "registrada" ? "Registrada" : "Pendiente",
      a.sicaac_numero_registro ?? "",
      a.sicaac_fecha_registro ?? "",
    ]);
    const csv =
      headers.join(",") +
      "\n" +
      rows
        .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
        .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sicaac-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label="Total" value={conteo.total} color="navy" />
        <KpiCard label="Pendientes" value={conteo.pendiente} color="amber" />
        <KpiCard label="Registradas" value={conteo.registrada} color="green" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center bg-white border border-gray-200 rounded-xl p-3">
        <div className="flex gap-1">
          {(["todas", "pendiente", "registrada"] as Filtro[]).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize ${
                filtro === f
                  ? "bg-[#0D2340] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
            placeholder="Buscar por número de acta, radicado o registro SICAAC..."
            className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]/30"
          />
        </div>
        <button
          onClick={exportarExcel}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-[#1B4F9B]/10 text-[#1B4F9B] hover:bg-[#1B4F9B]/20"
        >
          <Download className="w-3.5 h-3.5" /> Exportar CSV
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-left text-xs text-gray-600">
              <th className="px-4 py-2.5 font-semibold">Tipo</th>
              <th className="px-4 py-2.5 font-semibold">N° acta</th>
              <th className="px-4 py-2.5 font-semibold">Caso</th>
              <th className="px-4 py-2.5 font-semibold">Fecha acta</th>
              <th className="px-4 py-2.5 font-semibold">Resultado</th>
              <th className="px-4 py-2.5 font-semibold">Estado SICAAC</th>
              <th className="px-4 py-2.5 font-semibold">N° registro</th>
              <th className="px-4 py-2.5 font-semibold">Fecha registro</th>
              <th className="px-4 py-2.5 font-semibold text-center">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtradas.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-gray-400">
                  No hay actas o constancias con los filtros aplicados.
                </td>
              </tr>
            ) : (
              filtradas.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                        a.es_constancia
                          ? "bg-amber-50 text-amber-700"
                          : "bg-blue-50 text-blue-700"
                      }`}
                    >
                      {a.es_constancia ? "Constancia" : "Acta"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">{a.numero_acta}</td>
                  <td className="px-4 py-2.5">
                    {a.caso ? (
                      <Link
                        href={`/expediente/${a.caso.id}`}
                        className="text-[#1B4F9B] hover:underline"
                      >
                        {a.caso.numero_radicado}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {new Date(a.fecha_acta + "T00:00:00").toLocaleDateString("es-CO")}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {TIPO_LABEL[a.tipo] ?? a.tipo}
                  </td>
                  <td className="px-4 py-2.5">
                    {a.sicaac_estado === "registrada" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
                        <CheckCircle2 className="w-3 h-3" /> Registrada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">
                        <Clock className="w-3 h-3" /> Pendiente
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-700">
                    {a.sicaac_numero_registro ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {a.sicaac_fecha_registro
                      ? new Date(a.sicaac_fecha_registro + "T00:00:00").toLocaleDateString("es-CO")
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <button
                      onClick={() => setEditando(a)}
                      className="px-2 py-1 rounded-md text-[11px] font-medium bg-[#1B4F9B]/10 text-[#1B4F9B] hover:bg-[#1B4F9B]/20"
                    >
                      {a.sicaac_estado === "registrada" ? "Editar" : "Marcar"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editando && (
        <ModalRegistro
          acta={editando}
          onClose={() => setEditando(null)}
          onSaved={(actualizada) => {
            setActas((prev) => prev.map((a) => (a.id === actualizada.id ? actualizada : a)));
            setEditando(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "navy" | "amber" | "green";
}) {
  const colorClass =
    color === "navy"
      ? "text-[#0D2340]"
      : color === "amber"
      ? "text-amber-600"
      : "text-green-600";
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
    </div>
  );
}

function ModalRegistro({
  acta,
  onClose,
  onSaved,
}: {
  acta: SicaacActaRow;
  onClose: () => void;
  onSaved: (a: SicaacActaRow) => void;
}) {
  const [estado, setEstado] = useState<"pendiente" | "registrada">(acta.sicaac_estado);
  const [numero, setNumero] = useState(acta.sicaac_numero_registro ?? "");
  const [fecha, setFecha] = useState(acta.sicaac_fecha_registro ?? "");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setError("");
    if (estado === "registrada" && (!numero.trim() || !fecha)) {
      setError("Al marcar como registrada se requieren número y fecha");
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch(`/api/sicaac/${acta.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado,
          numero_registro: estado === "registrada" ? numero.trim() : null,
          fecha_registro: estado === "registrada" ? fecha : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Error al guardar");
        return;
      }
      onSaved({
        ...acta,
        sicaac_estado: estado,
        sicaac_numero_registro: estado === "registrada" ? numero.trim() : null,
        sicaac_fecha_registro: estado === "registrada" ? fecha : null,
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
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="text-xs text-gray-500 space-y-0.5">
          <p>
            {acta.es_constancia ? "Constancia" : "Acta"} N°{" "}
            <span className="font-mono">{acta.numero_acta}</span>
          </p>
          <p>Caso: {acta.caso?.numero_radicado ?? "—"}</p>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-600">Estado</label>
          <div className="flex gap-2">
            {(["pendiente", "registrada"] as const).map((e) => (
              <button
                key={e}
                onClick={() => setEstado(e)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize ${
                  estado === e
                    ? "bg-[#0D2340] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        {estado === "registrada" && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Número de registro SICAAC
              </label>
              <input
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="Ej: 12345-2026"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Fecha de registro
              </label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]/30"
              />
            </div>
          </>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={guardando}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#0D2340] text-white rounded-md text-sm font-medium hover:bg-[#0D2340]/90 disabled:opacity-50"
          >
            {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
