export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import { TabInfo } from "@/components/modules/expediente/TabInfo";
import { TabDocumentos } from "@/components/modules/expediente/TabDocumentos";
import { TabChecklistAdmision } from "@/components/modules/expediente/TabChecklistAdmision";
import { TabChecklistPoderes } from "@/components/modules/expediente/TabChecklistPoderes";
import { TabAsistencia } from "@/components/modules/expediente/TabAsistencia";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { TipoTramite } from "@/types";
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

const TABS = [
export const dynamic = "force-dynamic";
  { key: "info", label: "Info General" },
  { key: "documentos", label: "Documentos" },
export const dynamic = "force-dynamic";
  { key: "admision", label: "Admisión" },
  { key: "poderes", label: "Poderes" },
export const dynamic = "force-dynamic";
  { key: "asistencia", label: "Asistencia" },
] as const;
export const dynamic = "force-dynamic";

type TabKey = (typeof TABS)[number]["key"];
export const dynamic = "force-dynamic";

/* ─── Page ──────────────────────────────────────────────────────────────── */
export const dynamic = "force-dynamic";

interface Props {
export const dynamic = "force-dynamic";
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
export const dynamic = "force-dynamic";
}

export const dynamic = "force-dynamic";
export default async function ExpedientePage({ params, searchParams }: Props) {
  const { id } = await params;
export const dynamic = "force-dynamic";
  const sp = await searchParams;
  const activeTab = (TABS.find((t) => t.key === sp.tab)?.key ?? "info") as TabKey;
export const dynamic = "force-dynamic";

  const session = await auth();
export const dynamic = "force-dynamic";
  if (!session?.user) redirect("/login");
  const centerId = (session.user as any).centerId;
export const dynamic = "force-dynamic";

  /* ─── Data loading ─────────────────────────────────────────────────── */
export const dynamic = "force-dynamic";

  // 1. Caso con joins a conciliador y secretario
export const dynamic = "force-dynamic";
  const { data: caso } = await supabaseAdmin
    .from("sgcc_cases")
export const dynamic = "force-dynamic";
    .select(`
      *,
export const dynamic = "force-dynamic";
      conciliador:sgcc_staff!sgcc_cases_conciliador_id_fkey(id, nombre),
      secretario:sgcc_staff!sgcc_cases_secretario_id_fkey(id, nombre),
export const dynamic = "force-dynamic";
      sala:sgcc_rooms(id, nombre)
    `)
export const dynamic = "force-dynamic";
    .eq("id", id)
    .eq("center_id", centerId)
export const dynamic = "force-dynamic";
    .single();

export const dynamic = "force-dynamic";
  if (!caso) notFound();

export const dynamic = "force-dynamic";
  // Queries paralelas para el resto de datos
  const [
export const dynamic = "force-dynamic";
    { data: rawParties },
    { data: rawAttorneys },
export const dynamic = "force-dynamic";
    { data: rawHearings },
    { data: rawDocumentos },
export const dynamic = "force-dynamic";
    { data: rawActas },
    { data: rawTimeline },
export const dynamic = "force-dynamic";
    { data: rawCorrespondencia },
  ] = await Promise.all([
export const dynamic = "force-dynamic";
    // 2. Partes del caso
    supabaseAdmin
export const dynamic = "force-dynamic";
      .from("sgcc_case_parties")
      .select("*, party:sgcc_parties(*)")
export const dynamic = "force-dynamic";
      .eq("case_id", id),

export const dynamic = "force-dynamic";
    // 3. Apoderados (todos, activos e inactivos)
    supabaseAdmin
export const dynamic = "force-dynamic";
      .from("sgcc_case_attorneys")
      .select("*, attorney:sgcc_attorneys(*), party:sgcc_parties(id, nombres, apellidos, razon_social, tipo_persona, email)")
export const dynamic = "force-dynamic";
      .eq("case_id", id)
      .order("created_at", { ascending: false }),
export const dynamic = "force-dynamic";

    // 4. Audiencias
export const dynamic = "force-dynamic";
    supabaseAdmin
      .from("sgcc_hearings")
export const dynamic = "force-dynamic";
      .select("*, sala:sgcc_rooms(nombre), conciliador:sgcc_staff(nombre)")
      .eq("case_id", id)
export const dynamic = "force-dynamic";
      .order("fecha_hora", { ascending: true }),

export const dynamic = "force-dynamic";
    // 5. Documentos
    supabaseAdmin
export const dynamic = "force-dynamic";
      .from("sgcc_documents")
      .select("*")
export const dynamic = "force-dynamic";
      .eq("case_id", id)
      .order("created_at", { ascending: false }),
export const dynamic = "force-dynamic";

    // 6. Actas
export const dynamic = "force-dynamic";
    supabaseAdmin
      .from("sgcc_actas")
export const dynamic = "force-dynamic";
      .select("*")
      .eq("case_id", id)
export const dynamic = "force-dynamic";
      .order("fecha_acta", { ascending: false }),

export const dynamic = "force-dynamic";
    // 7. Timeline
    supabaseAdmin
export const dynamic = "force-dynamic";
      .from("sgcc_case_timeline")
      .select("*")
export const dynamic = "force-dynamic";
      .eq("case_id", id)
      .order("created_at", { ascending: true }),
export const dynamic = "force-dynamic";

    // 10. Correspondencia vinculada
export const dynamic = "force-dynamic";
    supabaseAdmin
      .from("sgcc_correspondence")
export const dynamic = "force-dynamic";
      .select("*, responsable:sgcc_staff(nombre)")
      .eq("case_id", id)
export const dynamic = "force-dynamic";
      .order("fecha_radicacion", { ascending: false }),
  ]);
export const dynamic = "force-dynamic";

  const parties = rawParties ?? [];
export const dynamic = "force-dynamic";
  const attorneys = rawAttorneys ?? [];
  const hearings = rawHearings ?? [];
export const dynamic = "force-dynamic";
  const documentos = rawDocumentos ?? [];
  const timeline = rawTimeline ?? [];
export const dynamic = "force-dynamic";
  const correspondencia = rawCorrespondencia ?? [];

export const dynamic = "force-dynamic";
  // 8. Checklists del centro para el tipo_tramite del caso
  const { data: rawChecklists } = await supabaseAdmin
export const dynamic = "force-dynamic";
    .from("sgcc_checklists")
    .select("*")
export const dynamic = "force-dynamic";
    .eq("center_id", centerId)
    .eq("tipo_tramite", caso.tipo_tramite)
export const dynamic = "force-dynamic";
    .eq("activo", true);

export const dynamic = "force-dynamic";
  const checklists = rawChecklists ?? [];
  const checklistAdmision = checklists.find((c: any) => c.tipo_checklist === "admision") ?? null;
export const dynamic = "force-dynamic";
  const checklistPoderes = checklists.find((c: any) => c.tipo_checklist === "poderes") ?? null;

export const dynamic = "force-dynamic";
  // Checklist responses para este caso
  const checklistIds = checklists.map((c: any) => c.id);
export const dynamic = "force-dynamic";
  const { data: rawResponses } = checklistIds.length > 0
    ? await supabaseAdmin
export const dynamic = "force-dynamic";
        .from("sgcc_checklist_responses")
        .select("*")
export const dynamic = "force-dynamic";
        .eq("case_id", id)
        .in("checklist_id", checklistIds)
export const dynamic = "force-dynamic";
    : { data: [] as any[] };

export const dynamic = "force-dynamic";
  const allResponses = rawResponses ?? [];
  const admisionResponses = checklistAdmision
export const dynamic = "force-dynamic";
    ? allResponses.filter((r: any) => r.checklist_id === checklistAdmision.id)
    : [];
export const dynamic = "force-dynamic";
  const poderesResponses = checklistPoderes
    ? allResponses.filter((r: any) => r.checklist_id === checklistPoderes.id)
export const dynamic = "force-dynamic";
    : [];

export const dynamic = "force-dynamic";
  // 9. Asistencia a audiencias
  const hearingIds = hearings.map((h: any) => h.id);
export const dynamic = "force-dynamic";
  const { data: rawAttendance } = hearingIds.length > 0
    ? await supabaseAdmin
export const dynamic = "force-dynamic";
        .from("sgcc_hearing_attendance")
        .select("*, party:sgcc_parties(id, nombres, apellidos, razon_social, tipo_persona, email), attorney:sgcc_attorneys(id, nombre, tarjeta_profesional)")
export const dynamic = "force-dynamic";
        .in("hearing_id", hearingIds)
    : { data: [] as any[] };
export const dynamic = "force-dynamic";

  const attendance = rawAttendance ?? [];
export const dynamic = "force-dynamic";

  /* ─── Badge tipo trámite ───────────────────────────────────────────── */
export const dynamic = "force-dynamic";

  const tipoBadge = TIPO_BADGE[caso.tipo_tramite as TipoTramite];
export const dynamic = "force-dynamic";

  /* ─── Render ───────────────────────────────────────────────────────── */
export const dynamic = "force-dynamic";

  return (
export const dynamic = "force-dynamic";
    <div>
      {/* Volver */}
export const dynamic = "force-dynamic";
      <div className="mb-3">
        <Link
export const dynamic = "force-dynamic";
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
export const dynamic = "force-dynamic";
        >
          <ArrowLeft className="w-3.5 h-3.5" />
export const dynamic = "force-dynamic";
          Volver al Dashboard
        </Link>
export const dynamic = "force-dynamic";
      </div>

export const dynamic = "force-dynamic";
      {/* Header */}
      <PageHeader
export const dynamic = "force-dynamic";
        title={caso.numero_radicado}
        subtitle={`${caso.materia} · ${new Date(caso.fecha_solicitud).toLocaleDateString("es-CO")}`}
export const dynamic = "force-dynamic";
      >
        <span
export const dynamic = "force-dynamic";
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${tipoBadge.color}`}
        >
export const dynamic = "force-dynamic";
          {tipoBadge.label}
        </span>
export const dynamic = "force-dynamic";
        <StatusChip value={caso.estado} type="case" size="md" />
      </PageHeader>
export const dynamic = "force-dynamic";

      {/* Tabs bar */}
export const dynamic = "force-dynamic";
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-0 -mb-px">
export const dynamic = "force-dynamic";
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
export const dynamic = "force-dynamic";
            return (
              <Link
export const dynamic = "force-dynamic";
                key={tab.key}
                href={`/expediente/${id}${tab.key === "info" ? "" : `?tab=${tab.key}`}`}
export const dynamic = "force-dynamic";
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
export const dynamic = "force-dynamic";
                    ? "border-[#B8860B] text-[#0D2340] font-bold"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
export const dynamic = "force-dynamic";
                }`}
              >
export const dynamic = "force-dynamic";
                {tab.label}
              </Link>
export const dynamic = "force-dynamic";
            );
          })}
export const dynamic = "force-dynamic";
        </nav>
      </div>
export const dynamic = "force-dynamic";

      {/* Tab content */}
export const dynamic = "force-dynamic";
      {activeTab === "info" && (
        <TabInfo
export const dynamic = "force-dynamic";
          caso={caso}
          parties={parties}
export const dynamic = "force-dynamic";
          attorneys={attorneys.filter((a: any) => a.activo)}
          timeline={timeline}
export const dynamic = "force-dynamic";
        />
      )}
export const dynamic = "force-dynamic";

      {activeTab === "documentos" && (
export const dynamic = "force-dynamic";
        <TabDocumentos
          caseId={id}
export const dynamic = "force-dynamic";
          documentos={documentos}
          correspondencia={correspondencia}
export const dynamic = "force-dynamic";
        />
      )}
export const dynamic = "force-dynamic";

      {activeTab === "admision" && (
export const dynamic = "force-dynamic";
        <TabChecklistAdmision
          caseId={id}
export const dynamic = "force-dynamic";
          checklist={checklistAdmision}
          responses={admisionResponses}
export const dynamic = "force-dynamic";
        />
      )}
export const dynamic = "force-dynamic";

      {activeTab === "poderes" && (
export const dynamic = "force-dynamic";
        <TabChecklistPoderes
          caseId={id}
export const dynamic = "force-dynamic";
          parties={parties}
          attorneys={attorneys}
export const dynamic = "force-dynamic";
          checklist={checklistPoderes}
          responses={poderesResponses}
export const dynamic = "force-dynamic";
        />
      )}
export const dynamic = "force-dynamic";

      {activeTab === "asistencia" && (
export const dynamic = "force-dynamic";
        <TabAsistencia
          caseId={id}
export const dynamic = "force-dynamic";
          hearings={hearings}
          parties={parties}
export const dynamic = "force-dynamic";
          attorneys={attorneys}
          attendance={attendance}
export const dynamic = "force-dynamic";
        />
      )}
export const dynamic = "force-dynamic";
    </div>
  );
export const dynamic = "force-dynamic";
}
