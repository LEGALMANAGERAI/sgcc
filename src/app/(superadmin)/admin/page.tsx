"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Users,
  FileText,
  CalendarClock,
  HardDrive,
  Inbox,
  Activity,
} from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";

interface Centro {
  id: string;
  nombre: string;
  ciudad: string | null;
  departamento: string | null;
  tipo: string | null;
  activo: boolean;
  created_at: string;
  staff_activo: number;
  casos_total: number;
  casos_activos: number;
  audiencias_programadas: number;
  documentos: number;
  storage_mb: number;
  tickets_abiertos: number;
  ultima_actividad: string | null;
}

interface Kpis {
  centros_total: number;
  centros_activos: number;
  staff_activo: number;
  casos_total: number;
  casos_activos: number;
  audiencias_hoy: number;
  documentos_total: number;
  storage_total_mb: number;
  tickets_abiertos: number;
}

const TIPOS_LABEL: Record<string, string> = {
  privado: "Privado",
  camara_comercio: "Cámara de Comercio",
  universidad: "Universidad",
  notaria: "Notaría",
  otro: "Otro",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO", { dateStyle: "medium" });
}

function formatStorage(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(1)} MB`;
}

export default function SuperAdminDashboardPage() {
  const [data, setData] = useState<{ kpis: Kpis; centros: Centro[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState("");
  const [orden, setOrden] = useState<"recientes" | "casos" | "nombre">("recientes");

  useEffect(() => {
    let cancel = false;
    fetch("/api/admin/dashboard")
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      })
      .then((d) => {
        if (!cancel) setData(d);
      })
      .catch((e) => {
        if (!cancel) setError(e.message ?? "Error cargando datos");
      });
    return () => {
      cancel = true;
    };
  }, []);

  const centrosFiltrados = useMemo(() => {
    if (!data) return [];
    const q = filtro.trim().toLowerCase();
    let arr = q
      ? data.centros.filter(
          (c) =>
            c.nombre.toLowerCase().includes(q) ||
            (c.ciudad ?? "").toLowerCase().includes(q),
        )
      : [...data.centros];
    if (orden === "casos") arr.sort((a, b) => b.casos_activos - a.casos_activos);
    else if (orden === "nombre") arr.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    else arr.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return arr;
  }, [data, filtro, orden]);

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
        {error.includes("403") || error.includes("No autorizado")
          ? "No tienes permiso para ver el panel del SaaS."
          : `Error cargando datos: ${error}`}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-sm text-gray-500">Cargando métricas del SaaS…</div>
    );
  }

  const { kpis } = data;

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs uppercase tracking-wider text-gray-500">Visión global</p>
        <h2 className="text-xl font-semibold text-[#0D2340]">Centros suscritos y consumo</h2>
      </section>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Centros activos"
          value={`${kpis.centros_activos} / ${kpis.centros_total}`}
          icon={Building2}
          color="navy"
        />
        <StatCard label="Staff activo" value={kpis.staff_activo} icon={Users} color="blue" />
        <StatCard
          label="Casos activos"
          value={kpis.casos_activos}
          trend={`${kpis.casos_total} totales`}
          icon={FileText}
          color="green"
        />
        <StatCard
          label="Audiencias hoy"
          value={kpis.audiencias_hoy}
          icon={CalendarClock}
          color="gold"
        />
        <StatCard
          label="Documentos"
          value={kpis.documentos_total}
          icon={Inbox}
          color="blue"
        />
        <StatCard
          label="Storage total"
          value={formatStorage(kpis.storage_total_mb)}
          icon={HardDrive}
          color="purple"
        />
        <StatCard
          label="Tickets abiertos"
          value={kpis.tickets_abiertos}
          icon={Activity}
          color={kpis.tickets_abiertos > 0 ? "red" : "navy"}
        />
      </div>

      {/* Tabla de centros */}
      <section className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-[#0D2340]">
            Centros suscritos ({centrosFiltrados.length})
          </h3>
          <div className="flex items-center gap-2">
            <input
              type="search"
              placeholder="Buscar por nombre o ciudad…"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-64"
            />
            <select
              value={orden}
              onChange={(e) => setOrden(e.target.value as typeof orden)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="recientes">Más recientes</option>
              <option value="casos">Más casos activos</option>
              <option value="nombre">Nombre A-Z</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-gray-500 border-b border-gray-200">
              <tr>
                <th className="py-2 pr-3">Centro</th>
                <th className="py-2 pr-3">Tipo</th>
                <th className="py-2 pr-3">Registro</th>
                <th className="py-2 pr-3 text-right">Staff</th>
                <th className="py-2 pr-3 text-right">Casos</th>
                <th className="py-2 pr-3 text-right">Audiencias</th>
                <th className="py-2 pr-3 text-right">Documentos</th>
                <th className="py-2 pr-3 text-right">Storage</th>
                <th className="py-2 pr-3 text-right">Tickets</th>
                <th className="py-2 pr-3">Última actividad</th>
              </tr>
            </thead>
            <tbody>
              {centrosFiltrados.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50/60">
                  <td className="py-2 pr-3">
                    <div className="font-medium text-[#0D2340]">
                      {c.nombre}
                      {!c.activo && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                          inactivo
                        </span>
                      )}
                    </div>
                    <div className="text-gray-500">
                      {[c.ciudad, c.departamento].filter(Boolean).join(", ") || "—"}
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-gray-600">
                    {TIPOS_LABEL[c.tipo ?? ""] ?? c.tipo ?? "—"}
                  </td>
                  <td className="py-2 pr-3 text-gray-600">{formatDate(c.created_at)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{c.staff_activo}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    <span className="font-medium">{c.casos_activos}</span>
                    <span className="text-gray-400"> / {c.casos_total}</span>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{c.audiencias_programadas}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{c.documentos}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatStorage(c.storage_mb)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {c.tickets_abiertos > 0 ? (
                      <span className="text-red-600 font-medium">{c.tickets_abiertos}</span>
                    ) : (
                      <span className="text-gray-400">0</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-gray-600">{formatDate(c.ultima_actividad)}</td>
                </tr>
              ))}
              {centrosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-6 text-center text-gray-400">
                    Sin centros que coincidan con el filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-[11px] text-gray-400">
        Solo SuperAdmin · datos en tiempo real desde Supabase. Casos activos =
        no archivados/cerrados/anulados. Audiencias programadas =
        programadas/reprogramadas. Tickets abiertos = no resueltos/cerrados.
      </p>
    </div>
  );
}
