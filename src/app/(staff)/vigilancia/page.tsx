export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Eye, Activity, BellRing } from "lucide-react";
import { VigilanciaClient } from "./VigilanciaClient";

interface Props {
  searchParams: Promise<{ estado?: string }>;
}

export default async function VigilanciaPage({ searchParams }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  const centerId = resolveCenterId(session);
  if (!centerId) redirect("/login");

  const sp = await searchParams;
  const estadoFiltro = sp.estado || "todos";

  // Obtener procesos vigilados con actualizaciones
  let query = supabaseAdmin
    .from("sgcc_watched_processes")
    .select(`
      *,
      caso:sgcc_cases!sgcc_watched_processes_case_id_fkey(id, numero_radicado),
      updates:sgcc_process_updates(id, leida)
    `)
    .eq("center_id", centerId)
    .order("created_at", { ascending: false });

  if (estadoFiltro !== "todos") {
    query = query.eq("estado", estadoFiltro);
  }

  const { data: procesos } = await query;

  // Obtener todos los casos del centro para el select del formulario
  const { data: casosDelCentro } = await supabaseAdmin
    .from("sgcc_cases")
    .select("id, numero_radicado, materia, estado")
    .eq("center_id", centerId)
    .order("created_at", { ascending: false });

  // Calcular stats sobre TODOS los procesos (sin filtro)
  const { data: allProcesos } = await supabaseAdmin
    .from("sgcc_watched_processes")
    .select("id, estado, updates:sgcc_process_updates(id, leida)")
    .eq("center_id", centerId);

  const total = allProcesos?.length ?? 0;
  const activos = allProcesos?.filter((p: any) => p.estado === "activo").length ?? 0;
  const conNuevas = allProcesos?.filter(
    (p: any) => (p.updates ?? []).some((u: any) => !u.leida)
  ).length ?? 0;

  // Preparar datos para el client
  const procesosConConteo = (procesos ?? []).map((p: any) => {
    const unreadCount = (p.updates ?? []).filter((u: any) => !u.leida).length;
    const { updates, ...rest } = p;
    return { ...rest, actuaciones_no_leidas: unreadCount };
  });

  return (
    <div>
      <PageHeader
        title="Vigilancia Judicial"
        subtitle="Monitoreo de procesos judiciales"
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Total procesos"
          value={total}
          icon={Eye}
          color="navy"
        />
        <StatCard
          label="Activos"
          value={activos}
          icon={Activity}
          color="green"
        />
        <StatCard
          label="Con actuaciones nuevas"
          value={conNuevas}
          icon={BellRing}
          color="red"
        />
      </div>

      {/* Client component con toda la interactividad */}
      <VigilanciaClient
        procesos={procesosConConteo}
        casos={casosDelCentro ?? []}
        estadoFiltro={estadoFiltro}
      />
    </div>
  );
}
