import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { StatusChip } from "@/components/ui/StatusChip";
import Link from "next/link";
import {
export const dynamic = "force-dynamic";
  FolderOpen,
  Calendar,
export const dynamic = "force-dynamic";
  AlertTriangle,
  Gavel,
export const dynamic = "force-dynamic";
  CheckCircle2,
  Users,
export const dynamic = "force-dynamic";
  Clock,
  Shield,
export const dynamic = "force-dynamic";
  ShieldAlert,
  Bell,
export const dynamic = "force-dynamic";
  Eye,
  ArrowRight,
export const dynamic = "force-dynamic";
  Mail,
  Filter,
export const dynamic = "force-dynamic";
  UserCheck,
} from "lucide-react";
import type {
export const dynamic = "force-dynamic";
  SgccCase,
  SgccSession,
export const dynamic = "force-dynamic";
  TipoTramite,
  CaseEstado,
export const dynamic = "force-dynamic";
  SgccCaseAttorney,
  SgccCorrespondence,
export const dynamic = "force-dynamic";
  SgccProcessUpdate,
  SgccStaff,
export const dynamic = "force-dynamic";
  SgccHearing,
  SgccCaseParty,
export const dynamic = "force-dynamic";
  SgccParty,
} from "@/types";
import { partyDisplayName } from "@/types";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";

/* ─── Tipos auxiliares ──────────────────────────────────────────────────── */
export const dynamic = "force-dynamic";

type CaseWithJoins = SgccCase & {
export const dynamic = "force-dynamic";
  conciliador: { nombre: string } | null;
  secretario: { nombre: string } | null;
export const dynamic = "force-dynamic";
};

export const dynamic = "force-dynamic";
type HearingWithJoins = Omit<SgccHearing, 'sala' | 'conciliador'> & {
  caso: { id: string; numero_radicado: string } | null;
export const dynamic = "force-dynamic";
  sala: { nombre: string } | null;
  conciliador: { nombre: string } | null;
export const dynamic = "force-dynamic";
};

export const dynamic = "force-dynamic";
type CasePartyWithJoins = SgccCaseParty & {
  party: SgccParty;
export const dynamic = "force-dynamic";
};

export const dynamic = "force-dynamic";
type CaseAttorneyWithJoins = SgccCaseAttorney & {
  attorney: {
export const dynamic = "force-dynamic";
    id: string;
    nombre: string;
export const dynamic = "force-dynamic";
    verificado: boolean;
  };
export const dynamic = "force-dynamic";
};

export const dynamic = "force-dynamic";
type AlertType = {
  id: string;
export const dynamic = "force-dynamic";
  icon: "red" | "yellow" | "blue";
  text: string;
export const dynamic = "force-dynamic";
  link: string;
};
export const dynamic = "force-dynamic";

/* ─── Constantes ────────────────────────────────────────────────────────── */
export const dynamic = "force-dynamic";

const TIPO_BADGE: Record<TipoTramite, { label: string; color: string }> = {
export const dynamic = "force-dynamic";
  conciliacion: { label: "Conc", color: "bg-blue-100 text-blue-800" },
  insolvencia: { label: "Ins", color: "bg-purple-100 text-purple-800" },
export const dynamic = "force-dynamic";
  acuerdo_apoyo: { label: "AA", color: "bg-amber-100 text-amber-800" },
};
export const dynamic = "force-dynamic";

/* ─── Page ──────────────────────────────────────────────────────────────── */
export const dynamic = "force-dynamic";

interface PageProps {
export const dynamic = "force-dynamic";
  searchParams: Promise<{ tipo?: string; alertas?: string }>;
}
export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: PageProps) {
export const dynamic = "force-dynamic";
  const params = await searchParams;
  const session = await auth();
export const dynamic = "force-dynamic";
  if (!session?.user) redirect("/login");

export const dynamic = "force-dynamic";
  const user = session.user as SgccSession["user"];
  const centerId = user.centerId;
export const dynamic = "force-dynamic";
  const userId = user.id;
  const userRol = user.sgccRol;
export const dynamic = "force-dynamic";
  const isConciliador = userRol === "conciliador";

export const dynamic = "force-dynamic";
  /* ─── Fecha de hoy ─────────────────────────────────────────────────── */
  const now = new Date();
export const dynamic = "force-dynamic";
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
export const dynamic = "force-dynamic";
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

export const dynamic = "force-dynamic";
  /* ─── Query 1: Todos los casos del centro/conciliador ──────────────── */
  let casesQuery = supabaseAdmin
export const dynamic = "force-dynamic";
    .from("sgcc_cases")
    .select(
export const dynamic = "force-dynamic";
      "*, conciliador:sgcc_staff!conciliador_id(nombre), secretario:sgcc_staff!secretario_id(nombre)"
    )
export const dynamic = "force-dynamic";
    .eq("center_id", centerId)
    .order("created_at", { ascending: false });
export const dynamic = "force-dynamic";

  if (isConciliador) {
export const dynamic = "force-dynamic";
    casesQuery = casesQuery.eq("conciliador_id", userId);
  }
export const dynamic = "force-dynamic";

  const { data: rawCases } = await casesQuery;
export const dynamic = "force-dynamic";
  const cases = (rawCases ?? []) as CaseWithJoins[];

export const dynamic = "force-dynamic";
  /* ─── Query 2: Case parties con apoderados ─────────────────────────── */
  const caseIds = cases.map((c) => c.id);
export const dynamic = "force-dynamic";

  const [
export const dynamic = "force-dynamic";
    { data: rawParties },
    { data: rawAttorneys },
export const dynamic = "force-dynamic";
    { data: rawHearingsToday },
    { data: rawTeam },
export const dynamic = "force-dynamic";
    { data: rawCorrespondence },
    { data: rawProcessUpdates },
export const dynamic = "force-dynamic";
  ] = await Promise.all([
    // Partes de los casos
export const dynamic = "force-dynamic";
    caseIds.length > 0
      ? supabaseAdmin
export const dynamic = "force-dynamic";
          .from("sgcc_case_parties")
          .select("*, party:sgcc_parties(*)")
export const dynamic = "force-dynamic";
          .in("case_id", caseIds)
      : Promise.resolve({ data: [] }),
export const dynamic = "force-dynamic";

    // Apoderados activos
export const dynamic = "force-dynamic";
    caseIds.length > 0
      ? supabaseAdmin
export const dynamic = "force-dynamic";
          .from("sgcc_case_attorneys")
          .select("*, attorney:sgcc_attorneys(*)")
export const dynamic = "force-dynamic";
          .in("case_id", caseIds)
          .eq("activo", true)
export const dynamic = "force-dynamic";
      : Promise.resolve({ data: [] }),

export const dynamic = "force-dynamic";
    // Audiencias de hoy
    supabaseAdmin
export const dynamic = "force-dynamic";
      .from("sgcc_hearings")
      .select(
export const dynamic = "force-dynamic";
        "*, caso:sgcc_cases(id, numero_radicado), sala:sgcc_rooms(nombre), conciliador:sgcc_staff(nombre)"
      )
export const dynamic = "force-dynamic";
      .eq("estado", "programada")
      .gte("fecha_hora", todayStart)
export const dynamic = "force-dynamic";
      .lt("fecha_hora", todayEnd)
      .order("fecha_hora", { ascending: true }),
export const dynamic = "force-dynamic";

    // Equipo (secretarios/asistentes)
export const dynamic = "force-dynamic";
    supabaseAdmin
      .from("sgcc_staff")
export const dynamic = "force-dynamic";
      .select("*")
      .eq("supervisor_id", userId)
export const dynamic = "force-dynamic";
      .eq("activo", true),

export const dynamic = "force-dynamic";
    // Correspondencia próxima a vencer
    supabaseAdmin
export const dynamic = "force-dynamic";
      .from("sgcc_correspondence")
      .select("*, responsable:sgcc_staff(nombre)")
export const dynamic = "force-dynamic";
      .eq("center_id", centerId)
      .neq("estado", "respondido")
export const dynamic = "force-dynamic";
      .not("fecha_limite_respuesta", "is", null)
      .order("fecha_limite_respuesta", { ascending: true })
export const dynamic = "force-dynamic";
      .limit(20),

export const dynamic = "force-dynamic";
    // Actuaciones judiciales no leídas
    supabaseAdmin
export const dynamic = "force-dynamic";
      .from("sgcc_process_updates")
      .select("*, watched:sgcc_watched_processes(case_id, numero_proceso)")
export const dynamic = "force-dynamic";
      .eq("leida", false)
      .limit(20),
export const dynamic = "force-dynamic";
  ]);

export const dynamic = "force-dynamic";
  const caseParties = (rawParties ?? []) as CasePartyWithJoins[];
  const caseAttorneys = (rawAttorneys ?? []) as CaseAttorneyWithJoins[];
export const dynamic = "force-dynamic";
  const hearingsToday = (rawHearingsToday ?? []) as HearingWithJoins[];
  const team = (rawTeam ?? []) as SgccStaff[];
export const dynamic = "force-dynamic";
  const correspondence = (rawCorrespondence ?? []) as SgccCorrespondence[];
  const processUpdates = (rawProcessUpdates ?? []) as (SgccProcessUpdate & {
export const dynamic = "force-dynamic";
    watched: { case_id: string | null; numero_proceso: string } | null;
  })[];
export const dynamic = "force-dynamic";

  /* ─── Mapas auxiliares ─────────────────────────────────────────────── */
export const dynamic = "force-dynamic";

  // Partes por caso
export const dynamic = "force-dynamic";
  const partiesByCase = new Map<string, CasePartyWithJoins[]>();
  for (const cp of caseParties) {
export const dynamic = "force-dynamic";
    const arr = partiesByCase.get(cp.case_id) ?? [];
    arr.push(cp);
export const dynamic = "force-dynamic";
    partiesByCase.set(cp.case_id, arr);
  }
export const dynamic = "force-dynamic";

  // Apoderados activos del convocante por caso
export const dynamic = "force-dynamic";
  const attorneyByCase = new Map<string, CaseAttorneyWithJoins>();
  for (const ca of caseAttorneys) {
export const dynamic = "force-dynamic";
    // Buscar si este apoderado es del convocante
    const cp = caseParties.find(
export const dynamic = "force-dynamic";
      (p) => p.case_id === ca.case_id && p.party_id === ca.party_id && p.rol === "convocante"
    );
export const dynamic = "force-dynamic";
    if (cp && ca.attorney) {
      attorneyByCase.set(ca.case_id, ca);
export const dynamic = "force-dynamic";
    }
  }
export const dynamic = "force-dynamic";

  // Próxima audiencia por caso
export const dynamic = "force-dynamic";
  const { data: rawNextHearings } = caseIds.length > 0
    ? await supabaseAdmin
export const dynamic = "force-dynamic";
        .from("sgcc_hearings")
        .select("case_id, fecha_hora")
export const dynamic = "force-dynamic";
        .in("case_id", caseIds)
        .eq("estado", "programada")
export const dynamic = "force-dynamic";
        .gte("fecha_hora", now.toISOString())
        .order("fecha_hora", { ascending: true })
export const dynamic = "force-dynamic";
    : { data: [] };

export const dynamic = "force-dynamic";
  const nextHearingByCase = new Map<string, string>();
  for (const h of rawNextHearings ?? []) {
export const dynamic = "force-dynamic";
    if (!nextHearingByCase.has(h.case_id)) {
      nextHearingByCase.set(h.case_id, h.fecha_hora);
export const dynamic = "force-dynamic";
    }
  }
export const dynamic = "force-dynamic";

  // Asistencia confirmada por audiencia hoy
export const dynamic = "force-dynamic";
  const hearingIds = hearingsToday.map((h) => h.id);
  const { data: rawAttendance } = hearingIds.length > 0
export const dynamic = "force-dynamic";
    ? await supabaseAdmin
        .from("sgcc_hearing_attendance")
export const dynamic = "force-dynamic";
        .select("hearing_id, party:sgcc_parties(nombres, apellidos)")
        .in("hearing_id", hearingIds)
export const dynamic = "force-dynamic";
        .eq("asistio", true)
    : { data: [] };
export const dynamic = "force-dynamic";

  const attendanceByHearing = new Map<string, number>();
export const dynamic = "force-dynamic";
  for (const a of rawAttendance ?? []) {
    attendanceByHearing.set(a.hearing_id, (attendanceByHearing.get(a.hearing_id) ?? 0) + 1);
export const dynamic = "force-dynamic";
  }

export const dynamic = "force-dynamic";
  /* ─── Stats ────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";
  const activeCases = cases.filter((c) => !["cerrado", "rechazado"].includes(c.estado));
  const concCount = activeCases.filter((c) => c.tipo_tramite === "conciliacion").length;
export const dynamic = "force-dynamic";
  const insCount = activeCases.filter((c) => c.tipo_tramite === "insolvencia").length;
  const aaCount = activeCases.filter((c) => c.tipo_tramite === "acuerdo_apoyo").length;
export const dynamic = "force-dynamic";

  const casesInAudiencia = cases.filter((c) => c.estado === "audiencia").length;
export const dynamic = "force-dynamic";

  const closedThisMonth = cases.filter(
export const dynamic = "force-dynamic";
    (c) => c.estado === "cerrado" && c.fecha_cierre && c.fecha_cierre >= monthStart
  ).length;
export const dynamic = "force-dynamic";

  /* ─── Alertas ──────────────────────────────────────────────────────── */
export const dynamic = "force-dynamic";

  const alerts: AlertType[] = [];
export const dynamic = "force-dynamic";

  // Apoderados no verificados
export const dynamic = "force-dynamic";
  for (const ca of caseAttorneys) {
    if (ca.attorney && !ca.attorney.verificado) {
export const dynamic = "force-dynamic";
      alerts.push({
        id: `att-${ca.id}`,
export const dynamic = "force-dynamic";
        icon: "yellow",
        text: `Apoderado ${ca.attorney.nombre} sin verificar`,
export const dynamic = "force-dynamic";
        link: `/expediente/${ca.case_id}`,
      });
export const dynamic = "force-dynamic";
    }
  }
export const dynamic = "force-dynamic";

  // Poderes próximos a vencer (7 días)
export const dynamic = "force-dynamic";
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  for (const ca of caseAttorneys) {
export const dynamic = "force-dynamic";
    if (ca.poder_vigente_hasta && ca.poder_vigente_hasta <= in7Days && ca.poder_vigente_hasta > now.toISOString()) {
      alerts.push({
export const dynamic = "force-dynamic";
        id: `poder-${ca.id}`,
        icon: "yellow",
export const dynamic = "force-dynamic";
        text: `Poder de ${ca.attorney?.nombre ?? "apoderado"} vence el ${formatDate(ca.poder_vigente_hasta)}`,
        link: `/expediente/${ca.case_id}`,
export const dynamic = "force-dynamic";
      });
    }
export const dynamic = "force-dynamic";
  }

export const dynamic = "force-dynamic";
  // Correspondencia tipo tutela próxima a vencer
  for (const c of correspondence) {
export const dynamic = "force-dynamic";
    if (c.tipo === "tutela" && c.fecha_limite_respuesta) {
      const daysLeft = Math.ceil(
export const dynamic = "force-dynamic";
        (new Date(c.fecha_limite_respuesta).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
export const dynamic = "force-dynamic";
      if (daysLeft <= 5 && daysLeft >= 0) {
        alerts.push({
export const dynamic = "force-dynamic";
          id: `corr-${c.id}`,
          icon: "red",
export const dynamic = "force-dynamic";
          text: `Tutela "${c.asunto}" vence en ${daysLeft} día${daysLeft !== 1 ? "s" : ""}`,
          link: c.case_id ? `/expediente/${c.case_id}` : "/correspondencia",
export const dynamic = "force-dynamic";
        });
      }
export const dynamic = "force-dynamic";
    }
  }
export const dynamic = "force-dynamic";

  // Correspondencia general próxima a vencer
export const dynamic = "force-dynamic";
  for (const c of correspondence) {
    if (c.tipo !== "tutela" && c.fecha_limite_respuesta) {
export const dynamic = "force-dynamic";
      const daysLeft = Math.ceil(
        (new Date(c.fecha_limite_respuesta).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
export const dynamic = "force-dynamic";
      );
      if (daysLeft <= 3 && daysLeft >= 0) {
export const dynamic = "force-dynamic";
        alerts.push({
          id: `corr-${c.id}`,
export const dynamic = "force-dynamic";
          icon: "yellow",
          text: `${c.tipo} "${c.asunto}" vence en ${daysLeft} día${daysLeft !== 1 ? "s" : ""}`,
export const dynamic = "force-dynamic";
          link: c.case_id ? `/expediente/${c.case_id}` : "/correspondencia",
        });
export const dynamic = "force-dynamic";
      }
    }
export const dynamic = "force-dynamic";
  }

export const dynamic = "force-dynamic";
  // Actuaciones judiciales nuevas
  for (const pu of processUpdates) {
export const dynamic = "force-dynamic";
    alerts.push({
      id: `pu-${pu.id}`,
export const dynamic = "force-dynamic";
      icon: "blue",
      text: `Nueva actuación: ${pu.tipo_actuacion ?? "Actualización"} en proceso ${pu.watched?.numero_proceso ?? ""}`,
export const dynamic = "force-dynamic";
      link: pu.watched?.case_id ? `/expediente/${pu.watched.case_id}` : "/vigilancia",
    });
export const dynamic = "force-dynamic";
  }

export const dynamic = "force-dynamic";
  const totalAlerts = alerts.length;

export const dynamic = "force-dynamic";
  /* ─── Filtros de tabla ─────────────────────────────────────────────── */

export const dynamic = "force-dynamic";
  const filterTipo = params.tipo as TipoTramite | "todos" | undefined;
  const filterAlertas = params.alertas === "con_alertas";
export const dynamic = "force-dynamic";

  // Set de case_ids con alertas
export const dynamic = "force-dynamic";
  const caseIdsWithAlerts = new Set<string>();
  for (const ca of caseAttorneys) {
export const dynamic = "force-dynamic";
    if (ca.attorney && !ca.attorney.verificado) caseIdsWithAlerts.add(ca.case_id);
    if (ca.poder_vigente_hasta && ca.poder_vigente_hasta <= in7Days && ca.poder_vigente_hasta > now.toISOString()) {
export const dynamic = "force-dynamic";
      caseIdsWithAlerts.add(ca.case_id);
    }
export const dynamic = "force-dynamic";
  }
  for (const c of correspondence) {
export const dynamic = "force-dynamic";
    if (c.case_id && c.fecha_limite_respuesta) {
      const daysLeft = Math.ceil(
export const dynamic = "force-dynamic";
        (new Date(c.fecha_limite_respuesta).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
export const dynamic = "force-dynamic";
      if (daysLeft <= 5 && daysLeft >= 0) caseIdsWithAlerts.add(c.case_id);
    }
export const dynamic = "force-dynamic";
  }

export const dynamic = "force-dynamic";
  let filteredCases = activeCases;
  if (filterTipo && filterTipo !== "todos") {
export const dynamic = "force-dynamic";
    filteredCases = filteredCases.filter((c) => c.tipo_tramite === filterTipo);
  }
export const dynamic = "force-dynamic";
  if (filterAlertas) {
    filteredCases = filteredCases.filter((c) => caseIdsWithAlerts.has(c.id));
export const dynamic = "force-dynamic";
  }

export const dynamic = "force-dynamic";
  /* ─── Render ───────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";
  return (
    <div>
export const dynamic = "force-dynamic";
      <PageHeader
        title="Dashboard"
export const dynamic = "force-dynamic";
        subtitle={now.toLocaleDateString("es-CO", { dateStyle: "full" })}
      >
export const dynamic = "force-dynamic";
        <Link
          href="/casos/nuevo"
export const dynamic = "force-dynamic";
          className="bg-[#0D2340] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0d2340dd] transition-colors"
        >
export const dynamic = "force-dynamic";
          + Nueva solicitud
        </Link>
export const dynamic = "force-dynamic";
      </PageHeader>

export const dynamic = "force-dynamic";
      {/* ── Sección 1: Stats Cards ────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
export const dynamic = "force-dynamic";
        <StatCard
          label="Casos activos"
export const dynamic = "force-dynamic";
          value={activeCases.length}
          icon={FolderOpen}
export const dynamic = "force-dynamic";
          color="navy"
          trend={`Conc: ${concCount} · Ins: ${insCount} · AA: ${aaCount}`}
export const dynamic = "force-dynamic";
        />
        <StatCard
export const dynamic = "force-dynamic";
          label="Audiencias hoy"
          value={hearingsToday.length}
export const dynamic = "force-dynamic";
          icon={Calendar}
          color="blue"
export const dynamic = "force-dynamic";
        />
        <StatCard
export const dynamic = "force-dynamic";
          label="Alertas pendientes"
          value={totalAlerts}
export const dynamic = "force-dynamic";
          icon={AlertTriangle}
          color={totalAlerts > 0 ? "red" : "green"}
export const dynamic = "force-dynamic";
        />
        <StatCard
export const dynamic = "force-dynamic";
          label="En audiencia"
          value={casesInAudiencia}
export const dynamic = "force-dynamic";
          icon={Gavel}
          color="purple"
export const dynamic = "force-dynamic";
        />
        <StatCard
export const dynamic = "force-dynamic";
          label="Cerrados este mes"
          value={closedThisMonth}
export const dynamic = "force-dynamic";
          icon={CheckCircle2}
          color="green"
export const dynamic = "force-dynamic";
        />
        <StatCard
export const dynamic = "force-dynamic";
          label="Mi equipo"
          value={team.length}
export const dynamic = "force-dynamic";
          icon={Users}
          color="gold"
export const dynamic = "force-dynamic";
          trend={team.length > 0 ? team.map((t) => t.nombre.split(" ")[0]).join(", ") : "Sin equipo"}
        />
export const dynamic = "force-dynamic";
      </div>

export const dynamic = "force-dynamic";
      {/* ── Sección 2: Layout 2 columnas ─────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[65%_35%] gap-6 mb-8">
export const dynamic = "force-dynamic";
        {/* ── Columna izquierda: Tabla Mis Casos ──────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
export const dynamic = "force-dynamic";
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
export const dynamic = "force-dynamic";
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-[#0D2340]" />
export const dynamic = "force-dynamic";
                {isConciliador ? "Mis Casos" : "Todos los Casos"}
              </h2>
export const dynamic = "force-dynamic";
              <Link
                href="/casos"
export const dynamic = "force-dynamic";
                className="text-xs text-[#B8860B] hover:underline flex items-center gap-1"
              >
export const dynamic = "force-dynamic";
                Ver todos <ArrowRight className="w-3 h-3" />
              </Link>
export const dynamic = "force-dynamic";
            </div>

export const dynamic = "force-dynamic";
            {/* Filtros */}
            <div className="flex flex-wrap items-center gap-2">
export const dynamic = "force-dynamic";
              <Filter className="w-4 h-4 text-gray-400" />
              <FilterLink
export const dynamic = "force-dynamic";
                href="/dashboard"
                label="Todos"
export const dynamic = "force-dynamic";
                active={!filterTipo || filterTipo === "todos"}
              />
export const dynamic = "force-dynamic";
              <FilterLink
                href="/dashboard?tipo=conciliacion"
export const dynamic = "force-dynamic";
                label="Conciliación"
                active={filterTipo === "conciliacion"}
export const dynamic = "force-dynamic";
              />
              <FilterLink
export const dynamic = "force-dynamic";
                href="/dashboard?tipo=insolvencia"
                label="Insolvencia"
export const dynamic = "force-dynamic";
                active={filterTipo === "insolvencia"}
              />
export const dynamic = "force-dynamic";
              <FilterLink
                href="/dashboard?tipo=acuerdo_apoyo"
export const dynamic = "force-dynamic";
                label="Acuerdo de Apoyo"
                active={filterTipo === "acuerdo_apoyo"}
export const dynamic = "force-dynamic";
              />
              <span className="mx-1 text-gray-300">|</span>
export const dynamic = "force-dynamic";
              <FilterLink
                href={filterAlertas ? `/dashboard${filterTipo && filterTipo !== "todos" ? `?tipo=${filterTipo}` : ""}` : `/dashboard?${filterTipo && filterTipo !== "todos" ? `tipo=${filterTipo}&` : ""}alertas=con_alertas`}
export const dynamic = "force-dynamic";
                label="Con alertas"
                active={filterAlertas}
export const dynamic = "force-dynamic";
                icon={<AlertTriangle className="w-3 h-3" />}
              />
export const dynamic = "force-dynamic";
            </div>
          </div>
export const dynamic = "force-dynamic";

          {/* Tabla */}
export const dynamic = "force-dynamic";
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
export const dynamic = "force-dynamic";
              <thead>
                <tr className="border-b border-gray-100 text-left">
export const dynamic = "force-dynamic";
                  <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                    Radicado
export const dynamic = "force-dynamic";
                  </th>
                  <th className="px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
export const dynamic = "force-dynamic";
                    Tipo
                  </th>
export const dynamic = "force-dynamic";
                  <th className="px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                    Partes
export const dynamic = "force-dynamic";
                  </th>
                  <th className="px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
export const dynamic = "force-dynamic";
                    Apoderado
                  </th>
export const dynamic = "force-dynamic";
                  <th className="px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                    Estado
export const dynamic = "force-dynamic";
                  </th>
                  <th className="px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
export const dynamic = "force-dynamic";
                    Próx. Audiencia
                  </th>
export const dynamic = "force-dynamic";
                  <th className="px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                    Secretario
export const dynamic = "force-dynamic";
                  </th>
                </tr>
export const dynamic = "force-dynamic";
              </thead>
              <tbody className="divide-y divide-gray-50">
export const dynamic = "force-dynamic";
                {filteredCases.length === 0 ? (
                  <tr>
export const dynamic = "force-dynamic";
                    <td colSpan={7} className="px-5 py-8 text-center text-gray-400">
                      No se encontraron casos con los filtros seleccionados
export const dynamic = "force-dynamic";
                    </td>
                  </tr>
export const dynamic = "force-dynamic";
                ) : (
                  filteredCases.slice(0, 20).map((c) => {
export const dynamic = "force-dynamic";
                    const parties = partiesByCase.get(c.id) ?? [];
                    const convocante = parties.find((p) => p.rol === "convocante");
export const dynamic = "force-dynamic";
                    const convocados = parties.filter((p) => p.rol === "convocado");
                    const attorney = attorneyByCase.get(c.id);
export const dynamic = "force-dynamic";
                    const nextHearing = nextHearingByCase.get(c.id);
                    const tipoBadge = TIPO_BADGE[c.tipo_tramite];
export const dynamic = "force-dynamic";
                    const hasAlert = caseIdsWithAlerts.has(c.id);

export const dynamic = "force-dynamic";
                    return (
                      <tr
export const dynamic = "force-dynamic";
                        key={c.id}
                        className="hover:bg-gray-50/50 transition-colors"
export const dynamic = "force-dynamic";
                      >
                        {/* Radicado */}
export const dynamic = "force-dynamic";
                        <td className="px-5 py-3">
                          <Link
export const dynamic = "force-dynamic";
                            href={`/expediente/${c.id}`}
                            className="text-[#0D2340] font-medium hover:underline"
export const dynamic = "force-dynamic";
                          >
                            {c.numero_radicado}
export const dynamic = "force-dynamic";
                          </Link>
                        </td>
export const dynamic = "force-dynamic";

                        {/* Tipo */}
export const dynamic = "force-dynamic";
                        <td className="px-3 py-3">
                          <span
export const dynamic = "force-dynamic";
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${tipoBadge.color}`}
                          >
export const dynamic = "force-dynamic";
                            {tipoBadge.label}
                          </span>
export const dynamic = "force-dynamic";
                        </td>

export const dynamic = "force-dynamic";
                        {/* Partes */}
                        <td className="px-3 py-3">
export const dynamic = "force-dynamic";
                          <div className="max-w-[180px]">
                            <p className="text-gray-900 truncate text-xs">
export const dynamic = "force-dynamic";
                              {convocante?.party
                                ? partyDisplayName(convocante.party)
export const dynamic = "force-dynamic";
                                : "—"}
                            </p>
export const dynamic = "force-dynamic";
                            {convocados.length > 0 && (
                              <p className="text-gray-400 text-xs">
export const dynamic = "force-dynamic";
                                +{convocados.length} convocado{convocados.length > 1 ? "s" : ""}
                              </p>
export const dynamic = "force-dynamic";
                            )}
                          </div>
export const dynamic = "force-dynamic";
                        </td>

export const dynamic = "force-dynamic";
                        {/* Apoderado */}
                        <td className="px-3 py-3">
export const dynamic = "force-dynamic";
                          {attorney ? (
                            <div className="flex items-center gap-1.5">
export const dynamic = "force-dynamic";
                              <span className="text-xs text-gray-700 truncate max-w-[120px]">
                                {attorney.attorney.nombre}
export const dynamic = "force-dynamic";
                              </span>
                              {!attorney.attorney.verificado && (
export const dynamic = "force-dynamic";
                                <span title="Apoderado sin verificar">
                                  <ShieldAlert className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
export const dynamic = "force-dynamic";
                                </span>
                              )}
export const dynamic = "force-dynamic";
                            </div>
                          ) : (
export const dynamic = "force-dynamic";
                            <span className="text-gray-300">—</span>
                          )}
export const dynamic = "force-dynamic";
                        </td>

export const dynamic = "force-dynamic";
                        {/* Estado */}
                        <td className="px-3 py-3">
export const dynamic = "force-dynamic";
                          <StatusChip value={c.estado} type="case" />
                        </td>
export const dynamic = "force-dynamic";

                        {/* Próxima audiencia */}
export const dynamic = "force-dynamic";
                        <td className="px-3 py-3 text-xs text-gray-600">
                          {nextHearing ? formatDate(nextHearing) : "—"}
export const dynamic = "force-dynamic";
                        </td>

export const dynamic = "force-dynamic";
                        {/* Secretario */}
                        <td className="px-3 py-3 text-xs text-gray-600">
export const dynamic = "force-dynamic";
                          {c.secretario?.nombre ?? "—"}
                        </td>
export const dynamic = "force-dynamic";
                      </tr>
                    );
export const dynamic = "force-dynamic";
                  })
                )}
export const dynamic = "force-dynamic";
              </tbody>
            </table>
export const dynamic = "force-dynamic";
          </div>

export const dynamic = "force-dynamic";
          {filteredCases.length > 20 && (
            <div className="px-5 py-3 border-t border-gray-100 text-center">
export const dynamic = "force-dynamic";
              <Link
                href="/casos"
export const dynamic = "force-dynamic";
                className="text-sm text-[#B8860B] hover:underline"
              >
export const dynamic = "force-dynamic";
                Ver los {filteredCases.length} casos →
              </Link>
export const dynamic = "force-dynamic";
            </div>
          )}
export const dynamic = "force-dynamic";
        </div>

export const dynamic = "force-dynamic";
        {/* ── Columna derecha: Panel lateral ──────────────────────────── */}
        <div className="space-y-6">
export const dynamic = "force-dynamic";
          {/* Audiencias de hoy */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
export const dynamic = "force-dynamic";
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
export const dynamic = "force-dynamic";
                <Calendar className="w-4 h-4 text-blue-600" />
                Audiencias de hoy
export const dynamic = "force-dynamic";
              </h2>
              <Link
export const dynamic = "force-dynamic";
                href="/agenda"
                className="text-xs text-[#B8860B] hover:underline flex items-center gap-1"
export const dynamic = "force-dynamic";
              >
                Agenda <ArrowRight className="w-3 h-3" />
export const dynamic = "force-dynamic";
              </Link>
            </div>
export const dynamic = "force-dynamic";
            <div className="divide-y divide-gray-50">
              {hearingsToday.length === 0 ? (
export const dynamic = "force-dynamic";
                <p className="px-5 py-6 text-sm text-gray-400 text-center">
                  No hay audiencias programadas hoy
export const dynamic = "force-dynamic";
                </p>
              ) : (
export const dynamic = "force-dynamic";
                hearingsToday.map((h) => {
                  const time = new Date(h.fecha_hora).toLocaleTimeString("es-CO", {
export const dynamic = "force-dynamic";
                    hour: "2-digit",
                    minute: "2-digit",
export const dynamic = "force-dynamic";
                  });
                  const confirmed = attendanceByHearing.get(h.id) ?? 0;
export const dynamic = "force-dynamic";

                  return (
export const dynamic = "force-dynamic";
                    <div key={h.id} className="px-5 py-3">
                      <div className="flex items-start justify-between">
export const dynamic = "force-dynamic";
                        <div>
                          <div className="flex items-center gap-2">
export const dynamic = "force-dynamic";
                            <Clock className="w-3.5 h-3.5 text-blue-500" />
                            <span className="text-sm font-semibold text-gray-900">
export const dynamic = "force-dynamic";
                              {time}
                            </span>
export const dynamic = "force-dynamic";
                          </div>
                          <Link
export const dynamic = "force-dynamic";
                            href={`/expediente/${h.caso?.id ?? h.case_id}`}
                            className="text-xs text-[#0D2340] hover:underline mt-0.5 block"
export const dynamic = "force-dynamic";
                          >
                            {h.caso?.numero_radicado ?? "—"}
export const dynamic = "force-dynamic";
                          </Link>
                        </div>
export const dynamic = "force-dynamic";
                        <div className="text-right">
                          {h.sala && (
export const dynamic = "force-dynamic";
                            <p className="text-xs text-gray-500">{h.sala.nombre}</p>
                          )}
export const dynamic = "force-dynamic";
                          <p className="text-xs text-gray-400 flex items-center gap-1 justify-end mt-0.5">
                            <UserCheck className="w-3 h-3" />
export const dynamic = "force-dynamic";
                            {confirmed} confirmado{confirmed !== 1 ? "s" : ""}
                          </p>
export const dynamic = "force-dynamic";
                        </div>
                      </div>
export const dynamic = "force-dynamic";
                    </div>
                  );
export const dynamic = "force-dynamic";
                })
              )}
export const dynamic = "force-dynamic";
            </div>
          </div>
export const dynamic = "force-dynamic";

          {/* Alertas recientes */}
export const dynamic = "force-dynamic";
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
export const dynamic = "force-dynamic";
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Bell className="w-4 h-4 text-red-500" />
export const dynamic = "force-dynamic";
                Alertas recientes
              </h2>
export const dynamic = "force-dynamic";
              {totalAlerts > 0 && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
export const dynamic = "force-dynamic";
                  {totalAlerts}
                </span>
export const dynamic = "force-dynamic";
              )}
            </div>
export const dynamic = "force-dynamic";
            <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
              {alerts.length === 0 ? (
export const dynamic = "force-dynamic";
                <p className="px-5 py-6 text-sm text-gray-400 text-center">
                  Sin alertas pendientes
export const dynamic = "force-dynamic";
                </p>
              ) : (
export const dynamic = "force-dynamic";
                alerts.slice(0, 10).map((alert) => (
                  <Link
export const dynamic = "force-dynamic";
                    key={alert.id}
                    href={alert.link}
export const dynamic = "force-dynamic";
                    className="px-5 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors"
                  >
export const dynamic = "force-dynamic";
                    <div className="flex-shrink-0 mt-0.5">
                      {alert.icon === "red" && (
export const dynamic = "force-dynamic";
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      )}
export const dynamic = "force-dynamic";
                      {alert.icon === "yellow" && (
                        <ShieldAlert className="w-4 h-4 text-amber-500" />
export const dynamic = "force-dynamic";
                      )}
                      {alert.icon === "blue" && (
export const dynamic = "force-dynamic";
                        <Eye className="w-4 h-4 text-blue-500" />
                      )}
export const dynamic = "force-dynamic";
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed">
export const dynamic = "force-dynamic";
                      {alert.text}
                    </p>
export const dynamic = "force-dynamic";
                  </Link>
                ))
export const dynamic = "force-dynamic";
              )}
            </div>
export const dynamic = "force-dynamic";
            {alerts.length > 10 && (
              <div className="px-5 py-2 border-t border-gray-100 text-center">
export const dynamic = "force-dynamic";
                <span className="text-xs text-gray-400">
                  +{alerts.length - 10} alertas más
export const dynamic = "force-dynamic";
                </span>
              </div>
export const dynamic = "force-dynamic";
            )}
          </div>
export const dynamic = "force-dynamic";
        </div>
      </div>
export const dynamic = "force-dynamic";

      {/* ── Sección 3: Equipo ────────────────────────────────────────── */}
export const dynamic = "force-dynamic";
      {team.length > 0 && (
        <div className="mb-8">
export const dynamic = "force-dynamic";
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Users className="w-5 h-5 text-[#B8860B]" />
export const dynamic = "force-dynamic";
            Mi Equipo
          </h2>
export const dynamic = "force-dynamic";
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {team.map((member) => (
export const dynamic = "force-dynamic";
              <div
                key={member.id}
export const dynamic = "force-dynamic";
                className="bg-white rounded-xl shadow-sm border border-gray-100 px-5 py-4 flex items-center gap-4"
              >
export const dynamic = "force-dynamic";
                <div className="w-10 h-10 rounded-full bg-[#0D2340] flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                  {member.nombre
export const dynamic = "force-dynamic";
                    .split(" ")
                    .map((n) => n[0])
export const dynamic = "force-dynamic";
                    .slice(0, 2)
                    .join("")
export const dynamic = "force-dynamic";
                    .toUpperCase()}
                </div>
export const dynamic = "force-dynamic";
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
export const dynamic = "force-dynamic";
                    {member.nombre}
                  </p>
export const dynamic = "force-dynamic";
                  <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                    <Mail className="w-3 h-3" />
export const dynamic = "force-dynamic";
                    {member.email}
                  </p>
export const dynamic = "force-dynamic";
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 mt-1 capitalize">
                    {member.rol}
export const dynamic = "force-dynamic";
                  </span>
                </div>
export const dynamic = "force-dynamic";
              </div>
            ))}
export const dynamic = "force-dynamic";
          </div>
        </div>
export const dynamic = "force-dynamic";
      )}
    </div>
export const dynamic = "force-dynamic";
  );
}
export const dynamic = "force-dynamic";

/* ─── Componentes auxiliares ──────────────────────────────────────────── */
export const dynamic = "force-dynamic";

function FilterLink({
export const dynamic = "force-dynamic";
  href,
  label,
export const dynamic = "force-dynamic";
  active,
  icon,
export const dynamic = "force-dynamic";
}: {
  href: string;
export const dynamic = "force-dynamic";
  label: string;
  active: boolean;
export const dynamic = "force-dynamic";
  icon?: React.ReactNode;
}) {
export const dynamic = "force-dynamic";
  return (
    <Link
export const dynamic = "force-dynamic";
      href={href}
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
export const dynamic = "force-dynamic";
        active
          ? "bg-[#0D2340] text-white"
export const dynamic = "force-dynamic";
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
export const dynamic = "force-dynamic";
    >
      {icon}
export const dynamic = "force-dynamic";
      {label}
    </Link>
export const dynamic = "force-dynamic";
  );
}
export const dynamic = "force-dynamic";

/* ─── Utilidades ─────────────────────────────────────────────────────── */
export const dynamic = "force-dynamic";

function formatDate(dateStr: string): string {
export const dynamic = "force-dynamic";
  return new Date(dateStr).toLocaleDateString("es-CO", {
    day: "numeric",
export const dynamic = "force-dynamic";
    month: "short",
    year: undefined,
export const dynamic = "force-dynamic";
  });
}
