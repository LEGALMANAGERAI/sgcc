export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Mail, Clock, AlertTriangle, XCircle } from "lucide-react";
import { CorrespondenciaClient } from "./CorrespondenciaClient";
import type { CorrespondenciaTipo, CorrespondenciaEstado } from "@/types";

interface Props {
  searchParams: Promise<{ tipo?: string; estado?: string }>;
}

export default async function CorrespondenciaPage({ searchParams }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  const centerId = resolveCenterId(session);
  if (!centerId) redirect("/login");

  const sp = await searchParams;
  const tipoFiltro = sp.tipo || "todos";
  const estadoFiltro = sp.estado || "todos";

  // ── Query principal con filtros ──
  let query = supabaseAdmin
    .from("sgcc_correspondence")
    .select(`
      *,
      responsable:sgcc_staff!sgcc_correspondence_responsable_staff_id_fkey(id, nombre),
      caso:sgcc_cases!sgcc_correspondence_case_id_fkey(id, numero_radicado),
      documentos:sgcc_correspondence_docs(id)
    `)
    .eq("center_id", centerId)
    .order("created_at", { ascending: false });

  if (tipoFiltro !== "todos") {
    query = query.eq("tipo", tipoFiltro);
  }
  if (estadoFiltro !== "todos") {
    query = query.eq("estado", estadoFiltro);
  }

  const { data: correspondencia } = await query;

  // ── Stats sobre TODOS (sin filtros) ──
  const { data: allCorr } = await supabaseAdmin
    .from("sgcc_correspondence")
    .select("id, tipo, estado, fecha_limite_respuesta")
    .eq("center_id", centerId);

  const total = allCorr?.length ?? 0;
  const pendientes = allCorr?.filter(
    (c: any) => c.estado === "recibido" || c.estado === "en_tramite"
  ).length ?? 0;
  const tutelasActivas = allCorr?.filter(
    (c: any) => c.tipo === "tutela" && c.estado !== "respondido"
  ).length ?? 0;
  const vencidas = allCorr?.filter(
    (c: any) => c.estado === "vencido"
  ).length ?? 0;

  // ── Alertas de vencimiento ──
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in5d = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

  const tutelasUrgentes = allCorr?.filter((c: any) => {
    if (c.tipo !== "tutela" || c.estado === "respondido" || c.estado === "vencido") return false;
    if (!c.fecha_limite_respuesta) return false;
    const limite = new Date(c.fecha_limite_respuesta);
    return limite <= in24h && limite >= now;
  }).length ?? 0;

  const dpUrgentes = allCorr?.filter((c: any) => {
    if (c.tipo !== "derecho_peticion" || c.estado === "respondido" || c.estado === "vencido") return false;
    if (!c.fecha_limite_respuesta) return false;
    const limite = new Date(c.fecha_limite_respuesta);
    return limite <= in5d && limite >= now;
  }).length ?? 0;

  // ── Datos auxiliares para el formulario ──
  const { data: casosDelCentro } = await supabaseAdmin
    .from("sgcc_cases")
    .select("id, numero_radicado, materia, estado")
    .eq("center_id", centerId)
    .order("created_at", { ascending: false });

  const { data: staffDelCentro } = await supabaseAdmin
    .from("sgcc_staff")
    .select("id, nombre, rol")
    .eq("center_id", centerId)
    .eq("activo", true)
    .order("nombre");

  // ── Preparar datos para el client ──
  const corrItems = (correspondencia ?? []).map((c: any) => {
    const docsCount = c.documentos?.length ?? 0;
    const { documentos, ...rest } = c;
    return { ...rest, docs_count: docsCount };
  });

  return (
    <div>
      <PageHeader
        title="Correspondencia Juridica"
        subtitle="Gestion de tutelas, derechos de peticion, requerimientos y oficios"
      />

      {/* Alertas de vencimiento */}
      {tutelasUrgentes > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-800 font-medium">
            {tutelasUrgentes} tutela{tutelasUrgentes > 1 ? "s" : ""} vence{tutelasUrgentes > 1 ? "n" : ""} en menos de 24 horas.
            Requiere{tutelasUrgentes > 1 ? "n" : ""} atencion inmediata.
          </p>
        </div>
      )}

      {dpUrgentes > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
          <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800 font-medium">
            {dpUrgentes} derecho{dpUrgentes > 1 ? "s" : ""} de peticion vence{dpUrgentes > 1 ? "n" : ""} en menos de 5 dias.
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total correspondencia"
          value={total}
          icon={Mail}
          color="navy"
        />
        <StatCard
          label="Pendientes"
          value={pendientes}
          icon={Clock}
          color="gold"
        />
        <StatCard
          label="Tutelas activas"
          value={tutelasActivas}
          icon={AlertTriangle}
          color="red"
        />
        <StatCard
          label="Vencidas"
          value={vencidas}
          icon={XCircle}
          color="purple"
        />
      </div>

      {/* Client component */}
      <CorrespondenciaClient
        correspondencia={corrItems}
        casos={casosDelCentro ?? []}
        staff={staffDelCentro ?? []}
        tipoFiltro={tipoFiltro}
        estadoFiltro={estadoFiltro}
      />
    </div>
  );
}
