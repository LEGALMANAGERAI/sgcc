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
import { ContadorTermino } from "@/components/modules/expediente/ContadorTermino";
import { CrearActaInsolvencia } from "@/components/modules/expediente/CrearActaInsolvencia";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { HerramientaAcreencias } from "@/components/modules/insolvencia/HerramientaAcreencias";
import { CasoTimeline } from "@/components/modules/casos/CasoTimeline";
import { CollaborationBar } from "@/components/ui/CollaborationBar";
import type { TipoTramite } from "@/types";
import { partyDisplayName } from "@/types";
import { sumarDiasHabiles, diasHabilesEntre } from "@/lib/dias-habiles-colombia";

/* ─── Constantes ────────────────────────────────────────────────────────── */

const TIPO_BADGE: Record<TipoTramite, { label: string; color: string }> = {
  conciliacion: { label: "Conc", color: "bg-blue-100 text-blue-800" },
  insolvencia: { label: "Ins", color: "bg-purple-100 text-purple-800" },
  acuerdo_apoyo: { label: "AA", color: "bg-amber-100 text-amber-800" },
  arbitraje_ejecutivo: { label: "AE", color: "bg-teal-100 text-teal-800" },
};

const BASE_TABS = [
  { key: "info", label: "Info General" },
  { key: "documentos", label: "Documentos" },
  { key: "admision", label: "Admisión" },
  { key: "poderes", label: "Poderes" },
  { key: "asistencia", label: "Asistencia" },
];

type TabKey = "info" | "documentos" | "admision" | "poderes" | "asistencia" | "acreencias";

/* ─── Page ──────────────────────────────────────────────────────────────── */

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function ExpedientePage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const activeTab = (BASE_TABS.find((t) => t.key === sp.tab)?.key ?? sp.tab ?? "info") as TabKey;

  const session = await auth();
  if (!session?.user) redirect("/login");
  const centerId = (session.user as any).centerId;

  /* ─── Data loading ─────────────────────────────────────────────────── */

  // 1. Caso con joins a conciliador y secretario
  const { data: caso } = await supabaseAdmin
    .from("sgcc_cases")
    .select(`
      *,
      conciliador:sgcc_staff!sgcc_cases_conciliador_id_fkey(id, nombre),
      secretario:sgcc_staff!sgcc_cases_secretario_id_fkey(id, nombre),
      sala:sgcc_rooms(id, nombre)
    `)
    .eq("id", id)
    .eq("center_id", centerId)
    .single();

  if (!caso) notFound();

  // Queries paralelas para el resto de datos
  const [
    { data: rawParties },
    { data: rawAttorneys },
    { data: rawHearings },
    { data: rawDocumentos },
    { data: rawActas },
    { data: rawTimeline },
    { data: rawCorrespondencia },
  ] = await Promise.all([
    // 2. Partes del caso
    supabaseAdmin
      .from("sgcc_case_parties")
      .select("*, party:sgcc_parties(*)")
      .eq("case_id", id),

    // 3. Apoderados (todos, activos e inactivos)
    supabaseAdmin
      .from("sgcc_case_attorneys")
      .select("*, attorney:sgcc_attorneys(*), party:sgcc_parties(id, nombres, apellidos, razon_social, tipo_persona, email)")
      .eq("case_id", id)
      .order("created_at", { ascending: false }),

    // 4. Audiencias
    supabaseAdmin
      .from("sgcc_hearings")
      .select("*, sala:sgcc_rooms(nombre), conciliador:sgcc_staff(nombre)")
      .eq("case_id", id)
      .order("fecha_hora", { ascending: true }),

    // 5. Documentos
    supabaseAdmin
      .from("sgcc_documents")
      .select("*")
      .eq("case_id", id)
      .order("created_at", { ascending: false }),

    // 6. Actas
    supabaseAdmin
      .from("sgcc_actas")
      .select("*")
      .eq("case_id", id)
      .order("fecha_acta", { ascending: false }),

    // 7. Timeline
    supabaseAdmin
      .from("sgcc_case_timeline")
      .select("*")
      .eq("case_id", id)
      .order("created_at", { ascending: true }),

    // 10. Correspondencia vinculada
    supabaseAdmin
      .from("sgcc_correspondence")
      .select("*, responsable:sgcc_staff(nombre)")
      .eq("case_id", id)
      .order("fecha_radicacion", { ascending: false }),
  ]);

  const parties = rawParties ?? [];
  const attorneys = rawAttorneys ?? [];
  const hearings = rawHearings ?? [];
  const documentos = rawDocumentos ?? [];
  const timeline = rawTimeline ?? [];
  const correspondencia = rawCorrespondencia ?? [];

  // 8. Checklists del centro para el tipo_tramite del caso
  const { data: rawChecklists } = await supabaseAdmin
    .from("sgcc_checklists")
    .select("*")
    .eq("center_id", centerId)
    .eq("tipo_tramite", caso.tipo_tramite)
    .eq("activo", true);

  const checklists = rawChecklists ?? [];
  const checklistAdmision = checklists.find((c: any) => c.tipo_checklist === "admision") ?? null;
  const checklistPoderes = checklists.find((c: any) => c.tipo_checklist === "poderes") ?? null;

  // Checklist responses para este caso
  const checklistIds = checklists.map((c: any) => c.id);
  const { data: rawResponses } = checklistIds.length > 0
    ? await supabaseAdmin
        .from("sgcc_checklist_responses")
        .select("*")
        .eq("case_id", id)
        .in("checklist_id", checklistIds)
    : { data: [] as any[] };

  const allResponses = rawResponses ?? [];
  const admisionResponses = checklistAdmision
    ? allResponses.filter((r: any) => r.checklist_id === checklistAdmision.id)
    : [];
  const poderesResponses = checklistPoderes
    ? allResponses.filter((r: any) => r.checklist_id === checklistPoderes.id)
    : [];

  // 9. Asistencia a audiencias
  const hearingIds = hearings.map((h: any) => h.id);
  const { data: rawAttendance } = hearingIds.length > 0
    ? await supabaseAdmin
        .from("sgcc_hearing_attendance")
        .select("*, party:sgcc_parties(id, nombres, apellidos, razon_social, tipo_persona, email), attorney:sgcc_attorneys(id, nombre, tarjeta_profesional)")
        .in("hearing_id", hearingIds)
    : { data: [] as any[] };

  const attendance = rawAttendance ?? [];

  // Acreencias (solo insolvencia)
  let acreencias: any[] = [];
  if (caso.tipo_tramite === "insolvencia") {
    const { data: rawAcreencias } = await supabaseAdmin
      .from("sgcc_acreencias")
      .select("*")
      .eq("case_id", id)
      .eq("center_id", centerId)
      .order("created_at", { ascending: true });
    acreencias = rawAcreencias ?? [];
  }

  // Tabs dinámicos: agregar "Acreencias" solo para insolvencia
  const TABS = [...BASE_TABS];
  if (caso.tipo_tramite === "insolvencia") {
    TABS.push({ key: "acreencias", label: "Acreencias" });
  }

  // Staff y salas para el modal de edición de etapas
  const [{ data: staffAll }, { data: salasAll }] = await Promise.all([
    supabaseAdmin.from("sgcc_staff").select("id, nombre, rol").eq("center_id", centerId).eq("activo", true).order("nombre"),
    supabaseAdmin.from("sgcc_rooms").select("id, nombre, tipo").eq("center_id", centerId).eq("activa", true).order("nombre"),
  ]);
  const conciliadoresList = (staffAll ?? []).filter((s: any) => s.rol === "conciliador");
  const secretariosList = (staffAll ?? []).filter((s: any) => s.rol === "secretario");
  const salasList = salasAll ?? [];

  const partesFlat = (parties ?? []).map((cp: any) => ({
    case_party_id: cp.id,
    party_id: cp.party?.id,
    rol: cp.rol,
    tipo_persona: cp.party?.tipo_persona ?? "natural",
    nombres: cp.party?.nombres ?? null,
    apellidos: cp.party?.apellidos ?? null,
    tipo_doc: cp.party?.tipo_doc ?? null,
    numero_doc: cp.party?.numero_doc ?? null,
    razon_social: cp.party?.razon_social ?? null,
    nit_empresa: cp.party?.nit_empresa ?? null,
    email: cp.party?.email ?? null,
    telefono: cp.party?.telefono ?? null,
    direccion: cp.party?.direccion ?? null,
    ciudad: cp.party?.ciudad ?? null,
    apoderado_nombre: cp.apoderado_nombre ?? null,
    apoderado_doc: cp.apoderado_doc ?? null,
    citacion_enviada_at: cp.citacion_enviada_at ?? null,
    citacion_confirmada_at: cp.citacion_confirmada_at ?? null,
  }));

  // Próxima acción según estado
  const nextAction = {
    solicitud: { label: "Procesar admisión", href: `/casos/${id}/admision` },
    admitido: { label: "Generar citación", href: `/casos/${id}/citacion` },
    citado: { label: "Programar audiencia", href: `/casos/${id}/audiencia` },
    audiencia: { label: "Agendar continuación", href: `/casos/${id}/audiencia` },
    cerrado: null,
    rechazado: null,
  }[caso.estado as string] ?? null;

  /* ─── Badge tipo trámite ───────────────────────────────────────────── */

  const tipoBadge = TIPO_BADGE[caso.tipo_tramite as TipoTramite];

  /* ─── Cálculo de término ───────────────────────────────────────────── */

  let diasTranscurridos = 0;
  let diasRestantes = caso.dias_termino ?? 60;
  let fechaLimite: string | null = null;

  if (caso.fecha_inicio_termino) {
    const inicio = new Date(caso.fecha_inicio_termino + "T12:00:00");
    const hoy = new Date();
    diasTranscurridos = diasHabilesEntre(inicio, hoy);
    diasRestantes = Math.max((caso.dias_termino ?? 60) - diasTranscurridos, 0);
    const limite = sumarDiasHabiles(inicio, caso.dias_termino ?? 60);
    fechaLimite = limite.toISOString().split("T")[0];
  }

  /* ─── Render ───────────────────────────────────────────────────────── */

  return (
    <div>
      {/* Volver */}
      <div className="mb-3">
        <Link
          href="/casos"
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Volver a Expedientes
        </Link>
      </div>

      {/* Colaboración en tiempo real */}
      <CollaborationBar
        resourceType="expediente"
        resourceId={id}
        userId={(session.user as any).id}
        nombre={session.user?.name ?? "Usuario"}
        rol={(session.user as any).sgccRol ?? "staff"}
      />

      {/* Header */}
      <PageHeader
        title={caso.numero_radicado}
        subtitle={`${caso.materia} · ${new Date(caso.fecha_solicitud).toLocaleDateString("es-CO")}`}
      >
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${tipoBadge.color}`}
        >
          {tipoBadge.label}
        </span>
        <StatusChip value={caso.estado} type="case" size="md" />
        {nextAction && (
          <Link
            href={nextAction.href}
            className="bg-[#1B4F9B] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#a07509] transition-colors"
          >
            {nextAction.label} →
          </Link>
        )}
      </PageHeader>

      {/* Flujo del caso (timeline editable) */}
      <CasoTimeline
        caseId={id}
        estado={caso.estado}
        events={timeline as any}
        caso={{
          id: caso.id,
          numero_radicado: caso.numero_radicado,
          materia: caso.materia,
          cuantia: caso.cuantia,
          cuantia_indeterminada: caso.cuantia_indeterminada,
          descripcion: caso.descripcion,
          estado: caso.estado,
          sub_estado: caso.sub_estado,
          conciliador_id: caso.conciliador_id,
          secretario_id: caso.secretario_id,
          motivo_rechazo: caso.motivo_rechazo,
          fecha_solicitud: caso.fecha_solicitud,
          fecha_admision: caso.fecha_admision,
          fecha_limite_citacion: caso.fecha_limite_citacion,
          fecha_cierre: caso.fecha_cierre,
        }}
        partes={partesFlat}
        audiencias={hearings}
        actas={(rawActas ?? []) as any[]}
        conciliadores={conciliadoresList}
        secretarios={secretariosList}
        salas={salasList}
      />

      {/* Contador de término */}
      {caso.estado !== "cerrado" && caso.estado !== "rechazado" && (
        <div className="mb-6">
          <ContadorTermino
            caseId={id}
            fechaInicioTermino={caso.fecha_inicio_termino}
            diasTermino={caso.dias_termino ?? 60}
            diasHabilesTranscurridos={diasTranscurridos}
            diasHabilesRestantes={diasRestantes}
            fechaLimite={fechaLimite}
            prorrogado={caso.prorrogado ?? false}
          />
        </div>
      )}

      {/* Tabs bar */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-0 -mb-px">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Link
                key={tab.key}
                href={`/expediente/${id}${tab.key === "info" ? "" : `?tab=${tab.key}`}`}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? "border-[#1B4F9B] text-[#0D2340] font-bold"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === "info" && (
        <TabInfo
          caso={caso}
          parties={parties}
          attorneys={attorneys.filter((a: any) => a.activo)}
          timeline={timeline}
        />
      )}

      {activeTab === "documentos" && (
        <TabDocumentos
          caseId={id}
          documentos={documentos}
          correspondencia={correspondencia}
        />
      )}

      {activeTab === "admision" && (
        <TabChecklistAdmision
          caseId={id}
          checklist={checklistAdmision}
          responses={admisionResponses}
          documentos={documentos.map((d: any) => ({ id: d.id, nombre: d.nombre, tipo: d.tipo }))}
        />
      )}

      {activeTab === "poderes" && (
        <TabChecklistPoderes
          caseId={id}
          parties={parties}
          attorneys={attorneys}
          checklist={checklistPoderes}
          responses={poderesResponses}
        />
      )}

      {activeTab === "asistencia" && (
        <TabAsistencia
          caseId={id}
          hearings={hearings}
          parties={parties}
          attorneys={attorneys}
          attendance={attendance}
        />
      )}

      {activeTab === "asistencia" && caso.tipo_tramite === "insolvencia" && (
        <div className="mt-6">
          <CrearActaInsolvencia
            caseId={id}
            radicado={caso.numero_radicado}
            insolvente={{
              nombre: (() => {
                const conv = parties.find((p: any) => p.rol === "convocante");
                return conv?.party ? partyDisplayName(conv.party) : "Sin convocante";
              })(),
              documento: parties.find((p: any) => p.rol === "convocante")?.party?.numero_doc ?? "",
              email: parties.find((p: any) => p.rol === "convocante")?.party?.email ?? "",
            }}
            acreedores={parties
              .filter((p: any) => p.rol === "convocado")
              .map((p: any) => ({
                nombre: p.party ? partyDisplayName(p.party) : "",
                documento: p.party?.numero_doc ?? "",
                email: p.party?.email ?? "",
              }))}
            operador={
              caso.conciliador
                ? {
                    id: caso.conciliador.id,
                    nombre: caso.conciliador.nombre,
                    email: (() => {
                      // Buscar email del staff conciliador
                      const staffEntry = attorneys.find(
                        (a: any) => a.attorney?.id === caso.conciliador?.id
                      );
                      return staffEntry?.attorney?.email ?? "";
                    })(),
                    tarjeta: "",
                  }
                : null
            }
            apoderadoInsolvente={(() => {
              const convParty = parties.find((p: any) => p.rol === "convocante")?.party;
              if (!convParty) return null;
              const apoderado = attorneys.find(
                (a: any) => a.party?.id === convParty.id && a.activo
              );
              if (!apoderado?.attorney) return null;
              return {
                nombre: apoderado.attorney.nombre ?? "",
                documento: apoderado.attorney.tarjeta_profesional ?? "",
                email: apoderado.attorney.email ?? apoderado.party?.email ?? "",
              };
            })()}
            hearingId={hearings.length > 0 ? hearings[hearings.length - 1].id : null}
            fechaAudiencia={hearings.length > 0 ? hearings[hearings.length - 1].fecha_hora : null}
            actaExistente={
              (rawActas ?? []).length > 0 ? (rawActas ?? [])[0] : null
            }
            actasPrevias={(rawActas ?? []).sort((a: any, b: any) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )}
          />
        </div>
      )}

      {activeTab === "acreencias" && caso.tipo_tramite === "insolvencia" && (
        <HerramientaAcreencias
          caseId={id}
          acreedoresIniciales={acreencias}
          partesConvocados={parties
            .filter((p: any) => p.rol === "convocado" && p.party)
            .map((p: any) => ({
              id: p.party.id,
              nombre: p.party.razon_social ?? [p.party.nombres, p.party.apellidos].filter(Boolean).join(" "),
              documento: p.party.numero_doc ?? p.party.nit_empresa ?? "",
            }))}
        />
      )}
    </div>
  );
}
