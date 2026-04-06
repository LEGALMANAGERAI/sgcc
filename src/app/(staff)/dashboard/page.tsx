import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { StatusChip } from "@/components/ui/StatusChip";
import Link from "next/link";
import {
  FolderOpen,
  Clock,
  CheckCircle,
  Calendar,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import type { SgccCase, SgccHearing, CaseEstado } from "@/types";

export default async function DashboardPage() {
  const session = await auth();
  const centerId = (session!.user as any).centerId;

  // Stats por estado
  const { data: cases } = await supabaseAdmin
    .from("sgcc_cases")
    .select("id, estado, numero_radicado, materia, fecha_solicitud, fecha_audiencia")
    .eq("center_id", centerId)
    .order("created_at", { ascending: false });

  const all = (cases ?? []) as (SgccCase & { estado: CaseEstado })[];
  const counts = {
    total: all.length,
    activos: all.filter((c) => !["cerrado", "rechazado"].includes(c.estado)).length,
    enAudiencia: all.filter((c) => c.estado === "audiencia").length,
    cerrados: all.filter((c) => c.estado === "cerrado").length,
  };

  // Próximas audiencias (hoy + 7 días)
  const now = new Date();
  const inWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const { data: hearings } = await supabaseAdmin
    .from("sgcc_hearings")
    .select("*, caso:sgcc_cases(numero_radicado, materia), sala:sgcc_rooms(nombre), conciliador:sgcc_staff(nombre)")
    .eq("sgcc_cases.center_id", centerId)
    .gte("fecha_hora", now.toISOString())
    .lte("fecha_hora", inWeek.toISOString())
    .eq("estado", "programada")
    .order("fecha_hora", { ascending: true })
    .limit(5);

  // Casos recientes
  const recent = all.slice(0, 5);

  // Casos sin conciliador asignado
  const sinConciliador = all.filter(
    (c) => c.estado === "admitido" && !(c as any).conciliador_id
  ).length;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`${new Date().toLocaleDateString("es-CO", { dateStyle: "full" })}`}
      >
        <Link
          href="/casos/nuevo"
          className="bg-[#0D2340] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0d2340dd] transition-colors"
        >
          + Nueva solicitud
        </Link>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total casos" value={counts.total} icon={FolderOpen} color="navy" />
        <StatCard label="Casos activos" value={counts.activos} icon={Clock} color="blue" />
        <StatCard label="En audiencia" value={counts.enAudiencia} icon={Calendar} color="purple" />
        <StatCard label="Cerrados" value={counts.cerrados} icon={CheckCircle} color="green" />
      </div>

      {/* Alertas */}
      {sinConciliador > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center gap-3 mb-6">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            <strong>{sinConciliador} caso{sinConciliador > 1 ? "s" : ""}</strong> admitido{sinConciliador > 1 ? "s" : ""} sin conciliador asignado.{" "}
            <Link href="/casos?estado=admitido" className="underline font-medium">
              Ver casos
            </Link>
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Próximas audiencias */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Próximas audiencias</h2>
            <Link href="/agenda" className="text-xs text-[#B8860B] hover:underline flex items-center gap-1">
              Ver agenda <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {!hearings?.length ? (
              <p className="px-5 py-6 text-sm text-gray-400 text-center">
                No hay audiencias programadas esta semana
              </p>
            ) : (
              hearings.map((h: any) => (
                <div key={h.id} className="px-5 py-3 flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {h.caso?.numero_radicado ?? "—"}
                      <span className="text-gray-400 font-normal ml-2 capitalize">
                        {h.caso?.materia}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {new Date(h.fecha_hora).toLocaleString("es-CO", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                      {h.sala && ` · ${h.sala.nombre}`}
                    </p>
                  </div>
                  {h.conciliador && (
                    <span className="text-xs text-gray-400">{h.conciliador.nombre}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Casos recientes */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Casos recientes</h2>
            <Link href="/casos" className="text-xs text-[#B8860B] hover:underline flex items-center gap-1">
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {!recent.length ? (
              <p className="px-5 py-6 text-sm text-gray-400 text-center">Sin casos aún</p>
            ) : (
              recent.map((c) => (
                <Link
                  key={c.id}
                  href={`/casos/${c.id}`}
                  className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{c.numero_radicado}</p>
                    <p className="text-xs text-gray-500 mt-0.5 capitalize">{c.materia}</p>
                  </div>
                  <StatusChip value={c.estado} type="case" />
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
