export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { StatusChip } from "@/components/ui/StatusChip";
import Link from "next/link";
import {
  FolderOpen,
  Calendar,
  AlertTriangle,
  Gavel,
  CheckCircle2,
  Users,
  Clock,
  Shield,
  ShieldAlert,
  Bell,
  Eye,
  ArrowRight,
  Mail,
  Filter,
  UserCheck,
} from "lucide-react";
import type {
  SgccCase,
  SgccSession,
  TipoTramite,
  CaseEstado,
  SgccCaseAttorney,
  SgccCorrespondence,
  SgccProcessUpdate,
  SgccStaff,
  SgccHearing,
  SgccCaseParty,
  SgccParty,
} from "@/types";
import { partyDisplayName } from "@/types";
import { redirect } from "next/navigation";

/* ─── Tipos auxiliares ──────────────────────────────────────────────────── */

type CaseWithJoins = SgccCase & {
  conciliador: { nombre: string } | null;
  secretario: { nombre: string } | null;
};

type HearingWithJoins = Omit<SgccHearing, 'sala' | 'conciliador'> & {
  caso: { id: string; numero_radicado: string } | null;
  sala: { nombre: string } | null;
  conciliador: { nombre: string } | null;
};

type CasePartyWithJoins = SgccCaseParty & {
  party: SgccParty;
};

type CaseAttorneyWithJoins = SgccCaseAttorney & {
  attorney: {
    id: string;
    nombre: string;
    verificado: boolean;
  };
};

type AlertType = {
  id: string;
  icon: "red" | "yellow" | "blue";
  text: string;
  link: string;
};

/* ─── Constantes ────────────────────────────────────────────────────────── */

const TIPO_BADGE: Record<TipoTramite, { label: string; color: string }> = {
  conciliacion: { label: "Conc", color: "bg-blue-100 text-blue-800" },
  insolvencia: { label: "Ins", color: "bg-purple-100 text-purple-800" },
  acuerdo_apoyo: { label: "AA", color: "bg-amber-100 text-amber-800" },
  arbitraje_ejecutivo: { label: "AE", color: "bg-teal-100 text-teal-800" },
};

/* ─── Page ──────────────────────────────────────────────────────────────── */

interface PageProps {
  searchParams: Promise<{ tipo?: string; alertas?: string }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as SgccSession["user"];
  const centerId = user.centerId;
  const userId = user.id;
  const userRol = user.sgccRol;
  const isConciliador = userRol === "conciliador";

  /* ─── Fecha de hoy ─────────────────────────────────────────────────── */
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  /* ─── Query 1: Todos los casos del centro/conciliador ──────────────── */
  let casesQuery = supabaseAdmin
    .from("sgcc_cases")
    .select(
      "*, conciliador:sgcc_staff!conciliador_id(nombre), secretario:sgcc_staff!secretario_id(nombre)"
    )
    .eq("center_id", centerId)
    .order("created_at", { ascending: false });

  if (isConciliador) {
    casesQuery = casesQuery.eq("conciliador_id", userId);
  }

  const { data: rawCases } = await casesQuery;
  const cases = (rawCases ?? []) as CaseWithJoins[];

  /* ─── Query 2: Case parties con apoderados ─────────────────────────── */
  const caseIds = cases.map((c) => c.id);

  const [
    { data: rawParties },
    { data: rawAttorneys },
    { data: rawHearingsToday },
    { data: rawTeam },
    { data: rawCorrespondence },
    { data: rawProcessUpdates },
  ] = await Promise.all([
    // Partes de los casos
    caseIds.length > 0
      ? supabaseAdmin
          .from("sgcc_case_parties")
          .select("*, party:sgcc_parties(*)")
          .in("case_id", caseIds)
      : Promise.resolve({ data: [] }),

    // Apoderados activos
    caseIds.length > 0
      ? supabaseAdmin
          .from("sgcc_case_attorneys")
          .select("*, attorney:sgcc_attorneys(*)")
          .in("case_id", caseIds)
          .eq("activo", true)
      : Promise.resolve({ data: [] }),

    // Audiencias de hoy
    supabaseAdmin
      .from("sgcc_hearings")
      .select(
        "*, caso:sgcc_cases(id, numero_radicado), sala:sgcc_rooms(nombre), conciliador:sgcc_staff(nombre)"
      )
      .eq("estado", "programada")
      .gte("fecha_hora", todayStart)
      .lt("fecha_hora", todayEnd)
      .order("fecha_hora", { ascending: true }),

    // Equipo (secretarios/asistentes)
    supabaseAdmin
      .from("sgcc_staff")
      .select("*")
      .eq("supervisor_id", userId)
      .eq("activo", true),

    // Correspondencia próxima a vencer
    supabaseAdmin
      .from("sgcc_correspondence")
      .select("*, responsable:sgcc_staff(nombre)")
      .eq("center_id", centerId)
      .neq("estado", "respondido")
      .not("fecha_limite_respuesta", "is", null)
      .order("fecha_limite_respuesta", { ascending: true })
      .limit(20),

    // Actuaciones judiciales no leídas
    supabaseAdmin
      .from("sgcc_process_updates")
      .select("*, watched:sgcc_watched_processes(case_id, numero_proceso)")
      .eq("leida", false)
      .limit(20),
  ]);

  const caseParties = (rawParties ?? []) as CasePartyWithJoins[];
  const caseAttorneys = (rawAttorneys ?? []) as CaseAttorneyWithJoins[];
  const hearingsToday = (rawHearingsToday ?? []) as HearingWithJoins[];
  const team = (rawTeam ?? []) as SgccStaff[];
  const correspondence = (rawCorrespondence ?? []) as SgccCorrespondence[];
  const processUpdates = (rawProcessUpdates ?? []) as (SgccProcessUpdate & {
    watched: { case_id: string | null; numero_proceso: string } | null;
  })[];

  /* ─── Mapas auxiliares ─────────────────────────────────────────────── */

  // Partes por caso
  const partiesByCase = new Map<string, CasePartyWithJoins[]>();
  for (const cp of caseParties) {
    const arr = partiesByCase.get(cp.case_id) ?? [];
    arr.push(cp);
    partiesByCase.set(cp.case_id, arr);
  }

  // Apoderados activos del convocante por caso
  const attorneyByCase = new Map<string, CaseAttorneyWithJoins>();
  for (const ca of caseAttorneys) {
    // Buscar si este apoderado es del convocante
    const cp = caseParties.find(
      (p) => p.case_id === ca.case_id && p.party_id === ca.party_id && p.rol === "convocante"
    );
    if (cp && ca.attorney) {
      attorneyByCase.set(ca.case_id, ca);
    }
  }

  // Próxima audiencia por caso
  const { data: rawNextHearings } = caseIds.length > 0
    ? await supabaseAdmin
        .from("sgcc_hearings")
        .select("case_id, fecha_hora")
        .in("case_id", caseIds)
        .eq("estado", "programada")
        .gte("fecha_hora", now.toISOString())
        .order("fecha_hora", { ascending: true })
    : { data: [] };

  const nextHearingByCase = new Map<string, string>();
  for (const h of rawNextHearings ?? []) {
    if (!nextHearingByCase.has(h.case_id)) {
      nextHearingByCase.set(h.case_id, h.fecha_hora);
    }
  }

  // Asistencia confirmada por audiencia hoy
  const hearingIds = hearingsToday.map((h) => h.id);
  const { data: rawAttendance } = hearingIds.length > 0
    ? await supabaseAdmin
        .from("sgcc_hearing_attendance")
        .select("hearing_id, party:sgcc_parties(nombres, apellidos)")
        .in("hearing_id", hearingIds)
        .eq("asistio", true)
    : { data: [] };

  const attendanceByHearing = new Map<string, number>();
  for (const a of rawAttendance ?? []) {
    attendanceByHearing.set(a.hearing_id, (attendanceByHearing.get(a.hearing_id) ?? 0) + 1);
  }

  /* ─── Stats ────────────────────────────────────────────────────────── */

  const activeCases = cases.filter((c) => !["cerrado", "rechazado"].includes(c.estado));
  const concCount = activeCases.filter((c) => c.tipo_tramite === "conciliacion").length;
  const insCount = activeCases.filter((c) => c.tipo_tramite === "insolvencia").length;
  const aaCount = activeCases.filter((c) => c.tipo_tramite === "acuerdo_apoyo").length;

  const casesInAudiencia = cases.filter((c) => c.estado === "audiencia").length;

  const closedThisMonth = cases.filter(
    (c) => c.estado === "cerrado" && c.fecha_cierre && c.fecha_cierre >= monthStart
  ).length;

  /* ─── Alertas ──────────────────────────────────────────────────────── */

  const alerts: AlertType[] = [];

  // Apoderados no verificados
  for (const ca of caseAttorneys) {
    if (ca.attorney && !ca.attorney.verificado) {
      alerts.push({
        id: `att-${ca.id}`,
        icon: "yellow",
        text: `Apoderado ${ca.attorney.nombre} sin verificar`,
        link: `/expediente/${ca.case_id}`,
      });
    }
  }

  // Poderes próximos a vencer (7 días)
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  for (const ca of caseAttorneys) {
    if (ca.poder_vigente_hasta && ca.poder_vigente_hasta <= in7Days && ca.poder_vigente_hasta > now.toISOString()) {
      alerts.push({
        id: `poder-${ca.id}`,
        icon: "yellow",
        text: `Poder de ${ca.attorney?.nombre ?? "apoderado"} vence el ${formatDate(ca.poder_vigente_hasta)}`,
        link: `/expediente/${ca.case_id}`,
      });
    }
  }

  // Correspondencia tipo tutela próxima a vencer
  for (const c of correspondence) {
    if (c.tipo === "tutela" && c.fecha_limite_respuesta) {
      const daysLeft = Math.ceil(
        (new Date(c.fecha_limite_respuesta).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysLeft <= 5 && daysLeft >= 0) {
        alerts.push({
          id: `corr-${c.id}`,
          icon: "red",
          text: `Tutela "${c.asunto}" vence en ${daysLeft} día${daysLeft !== 1 ? "s" : ""}`,
          link: c.case_id ? `/expediente/${c.case_id}` : "/correspondencia",
        });
      }
    }
  }

  // Correspondencia general próxima a vencer
  for (const c of correspondence) {
    if (c.tipo !== "tutela" && c.fecha_limite_respuesta) {
      const daysLeft = Math.ceil(
        (new Date(c.fecha_limite_respuesta).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysLeft <= 3 && daysLeft >= 0) {
        alerts.push({
          id: `corr-${c.id}`,
          icon: "yellow",
          text: `${c.tipo} "${c.asunto}" vence en ${daysLeft} día${daysLeft !== 1 ? "s" : ""}`,
          link: c.case_id ? `/expediente/${c.case_id}` : "/correspondencia",
        });
      }
    }
  }

  // Actuaciones judiciales nuevas
  for (const pu of processUpdates) {
    alerts.push({
      id: `pu-${pu.id}`,
      icon: "blue",
      text: `Nueva actuación: ${pu.tipo_actuacion ?? "Actualización"} en proceso ${pu.watched?.numero_proceso ?? ""}`,
      link: pu.watched?.case_id ? `/expediente/${pu.watched.case_id}` : "/vigilancia",
    });
  }

  const totalAlerts = alerts.length;

  /* ─── Filtros de tabla ─────────────────────────────────────────────── */

  const filterTipo = params.tipo as TipoTramite | "todos" | undefined;
  const filterAlertas = params.alertas === "con_alertas";

  // Set de case_ids con alertas
  const caseIdsWithAlerts = new Set<string>();
  for (const ca of caseAttorneys) {
    if (ca.attorney && !ca.attorney.verificado) caseIdsWithAlerts.add(ca.case_id);
    if (ca.poder_vigente_hasta && ca.poder_vigente_hasta <= in7Days && ca.poder_vigente_hasta > now.toISOString()) {
      caseIdsWithAlerts.add(ca.case_id);
    }
  }
  for (const c of correspondence) {
    if (c.case_id && c.fecha_limite_respuesta) {
      const daysLeft = Math.ceil(
        (new Date(c.fecha_limite_respuesta).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysLeft <= 5 && daysLeft >= 0) caseIdsWithAlerts.add(c.case_id);
    }
  }

  let filteredCases = activeCases;
  if (filterTipo && filterTipo !== "todos") {
    filteredCases = filteredCases.filter((c) => c.tipo_tramite === filterTipo);
  }
  if (filterAlertas) {
    filteredCases = filteredCases.filter((c) => caseIdsWithAlerts.has(c.id));
  }

  /* ─── Render ───────────────────────────────────────────────────────── */

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={now.toLocaleDateString("es-CO", { dateStyle: "full" })}
      >
        <Link
          href="/casos/nuevo"
          className="bg-[#0D2340] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0d2340dd] transition-colors"
        >
          + Nueva solicitud
        </Link>
      </PageHeader>

      {/* ── Sección 1: Stats Cards ────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <StatCard
          label="Casos activos"
          value={activeCases.length}
          icon={FolderOpen}
          color="navy"
          trend={`Conc: ${concCount} · Ins: ${insCount} · AA: ${aaCount}`}
        />
        <StatCard
          label="Audiencias hoy"
          value={hearingsToday.length}
          icon={Calendar}
          color="blue"
        />
        <StatCard
          label="Alertas pendientes"
          value={totalAlerts}
          icon={AlertTriangle}
          color={totalAlerts > 0 ? "red" : "green"}
        />
        <StatCard
          label="En audiencia"
          value={casesInAudiencia}
          icon={Gavel}
          color="purple"
        />
        <StatCard
          label="Cerrados este mes"
          value={closedThisMonth}
          icon={CheckCircle2}
          color="green"
        />
        <StatCard
          label="Mi equipo"
          value={team.length}
          icon={Users}
          color="gold"
          trend={team.length > 0 ? team.map((t) => t.nombre.split(" ")[0]).join(", ") : "Sin equipo"}
        />
      </div>

      {/* ── Sección 2: Layout 2 columnas ─────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[65%_35%] gap-6 mb-8">
        {/* ── Columna izquierda: Tabla Mis Casos ──────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-[#0D2340]" />
                {isConciliador ? "Mis Casos" : "Todos los Casos"}
              </h2>
              <Link
                href="/casos"
                className="text-xs text-[#1B4F9B] hover:underline flex items-center gap-1"
              >
                Ver todos <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <FilterLink
                href="/dashboard"
                label="Todos"
                active={!filterTipo || filterTipo === "todos"}
              />
              <FilterLink
                href="/dashboard?tipo=conciliacion"
                label="Conciliación"
                active={filterTipo === "conciliacion"}
              />
              <FilterLink
                href="/dashboard?tipo=insolvencia"
                label="Insolvencia"
                active={filterTipo === "insolvencia"}
              />
              <FilterLink
                href="/dashboard?tipo=acuerdo_apoyo"
                label="Acuerdo de Apoyo"
                active={filterTipo === "acuerdo_apoyo"}
              />
              <span className="mx-1 text-gray-300">|</span>
              <FilterLink
                href={filterAlertas ? `/dashboard${filterTipo && filterTipo !== "todos" ? `?tipo=${filterTipo}` : ""}` : `/dashboard?${filterTipo && filterTipo !== "todos" ? `tipo=${filterTipo}&` : ""}alertas=con_alertas`}
                label="Con alertas"
                active={filterAlertas}
                icon={<AlertTriangle className="w-3 h-3" />}
              />
            </div>
          </div>

          {/* Tabla */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                    Radicado
                  </th>
                  <th className="px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                    Partes
                  </th>
                  <th className="px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                    Apoderado
                  </th>
                  <th className="px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                    Próx. Audiencia
                  </th>
                  <th className="px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                    Secretario
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredCases.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-gray-400">
                      No se encontraron casos con los filtros seleccionados
                    </td>
                  </tr>
                ) : (
                  filteredCases.slice(0, 20).map((c) => {
                    const parties = partiesByCase.get(c.id) ?? [];
                    const convocante = parties.find((p) => p.rol === "convocante");
                    const convocados = parties.filter((p) => p.rol === "convocado");
                    const attorney = attorneyByCase.get(c.id);
                    const nextHearing = nextHearingByCase.get(c.id);
                    const tipoBadge = TIPO_BADGE[c.tipo_tramite];
                    const hasAlert = caseIdsWithAlerts.has(c.id);

                    return (
                      <tr
                        key={c.id}
                        className="hover:bg-gray-50/50 transition-colors"
                      >
                        {/* Radicado */}
                        <td className="px-5 py-3">
                          <Link
                            href={`/expediente/${c.id}`}
                            className="text-[#0D2340] font-medium hover:underline"
                          >
                            {c.numero_radicado}
                          </Link>
                        </td>

                        {/* Tipo */}
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${tipoBadge.color}`}
                          >
                            {tipoBadge.label}
                          </span>
                        </td>

                        {/* Partes */}
                        <td className="px-3 py-3">
                          <div className="max-w-[180px]">
                            <p className="text-gray-900 truncate text-xs">
                              {convocante?.party
                                ? partyDisplayName(convocante.party)
                                : "—"}
                            </p>
                            {convocados.length > 0 && (
                              <p className="text-gray-400 text-xs">
                                +{convocados.length} convocado{convocados.length > 1 ? "s" : ""}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Apoderado */}
                        <td className="px-3 py-3">
                          {attorney ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-gray-700 truncate max-w-[120px]">
                                {attorney.attorney.nombre}
                              </span>
                              {!attorney.attorney.verificado && (
                                <span title="Apoderado sin verificar">
                                  <ShieldAlert className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>

                        {/* Estado */}
                        <td className="px-3 py-3">
                          <StatusChip value={c.estado} type="case" />
                        </td>

                        {/* Próxima audiencia */}
                        <td className="px-3 py-3 text-xs text-gray-600">
                          {nextHearing ? formatDate(nextHearing) : "—"}
                        </td>

                        {/* Secretario */}
                        <td className="px-3 py-3 text-xs text-gray-600">
                          {c.secretario?.nombre ?? "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {filteredCases.length > 20 && (
            <div className="px-5 py-3 border-t border-gray-100 text-center">
              <Link
                href="/casos"
                className="text-sm text-[#1B4F9B] hover:underline"
              >
                Ver los {filteredCases.length} casos →
              </Link>
            </div>
          )}
        </div>

        {/* ── Columna derecha: Panel lateral ──────────────────────────── */}
        <div className="space-y-6">
          {/* Audiencias de hoy */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                Audiencias de hoy
              </h2>
              <Link
                href="/agenda"
                className="text-xs text-[#1B4F9B] hover:underline flex items-center gap-1"
              >
                Agenda <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {hearingsToday.length === 0 ? (
                <p className="px-5 py-6 text-sm text-gray-400 text-center">
                  No hay audiencias programadas hoy
                </p>
              ) : (
                hearingsToday.map((h) => {
                  const time = new Date(h.fecha_hora).toLocaleTimeString("es-CO", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const confirmed = attendanceByHearing.get(h.id) ?? 0;

                  return (
                    <div key={h.id} className="px-5 py-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-blue-500" />
                            <span className="text-sm font-semibold text-gray-900">
                              {time}
                            </span>
                          </div>
                          <Link
                            href={`/expediente/${h.caso?.id ?? h.case_id}`}
                            className="text-xs text-[#0D2340] hover:underline mt-0.5 block"
                          >
                            {h.caso?.numero_radicado ?? "—"}
                          </Link>
                        </div>
                        <div className="text-right">
                          {h.sala && (
                            <p className="text-xs text-gray-500">{h.sala.nombre}</p>
                          )}
                          <p className="text-xs text-gray-400 flex items-center gap-1 justify-end mt-0.5">
                            <UserCheck className="w-3 h-3" />
                            {confirmed} confirmado{confirmed !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Alertas recientes */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Bell className="w-4 h-4 text-red-500" />
                Alertas recientes
              </h2>
              {totalAlerts > 0 && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                  {totalAlerts}
                </span>
              )}
            </div>
            <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
              {alerts.length === 0 ? (
                <p className="px-5 py-6 text-sm text-gray-400 text-center">
                  Sin alertas pendientes
                </p>
              ) : (
                alerts.slice(0, 10).map((alert) => (
                  <Link
                    key={alert.id}
                    href={alert.link}
                    className="px-5 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {alert.icon === "red" && (
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      )}
                      {alert.icon === "yellow" && (
                        <ShieldAlert className="w-4 h-4 text-amber-500" />
                      )}
                      {alert.icon === "blue" && (
                        <Eye className="w-4 h-4 text-blue-500" />
                      )}
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed">
                      {alert.text}
                    </p>
                  </Link>
                ))
              )}
            </div>
            {alerts.length > 10 && (
              <div className="px-5 py-2 border-t border-gray-100 text-center">
                <span className="text-xs text-gray-400">
                  +{alerts.length - 10} alertas más
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Sección 3: Equipo ────────────────────────────────────────── */}
      {team.length > 0 && (
        <div className="mb-8">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Users className="w-5 h-5 text-[#1B4F9B]" />
            Mi Equipo
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {team.map((member) => (
              <div
                key={member.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 px-5 py-4 flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-full bg-[#0D2340] flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                  {member.nombre
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {member.nombre}
                  </p>
                  <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {member.email}
                  </p>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 mt-1 capitalize">
                    {member.rol}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Componentes auxiliares ──────────────────────────────────────────── */

function FilterLink({
  href,
  label,
  active,
  icon,
}: {
  href: string;
  label: string;
  active: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
        active
          ? "bg-[#0D2340] text-white"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}

/* ─── Utilidades ─────────────────────────────────────────────────────── */

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: undefined,
  });
}
