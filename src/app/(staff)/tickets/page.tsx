export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { PageHeader } from "@/components/ui/PageHeader";
import TicketsClient from "./TicketsClient";

export default async function TicketsPage() {
  const session = await auth();
  const centerId = (session!.user as any).centerId as string;
  const staffId = (session!.user as any).id as string;
  const rol = (session!.user as any).sgccRol as string;

  const [ticketsRes, staffRes] = await Promise.all([
    supabaseAdmin
      .from("sgcc_tickets")
      .select(`
        *,
        solicitante:sgcc_staff!sgcc_tickets_solicitante_staff_id_fkey(id, nombre, email),
        asignado:sgcc_staff!sgcc_tickets_asignado_staff_id_fkey(id, nombre, email),
        respondedor:sgcc_staff!sgcc_tickets_respondido_por_fkey(id, nombre, email),
        caso:sgcc_cases(id, numero_radicado)
      `)
      .eq("center_id", centerId)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("sgcc_staff")
      .select("id, nombre, email, rol")
      .eq("center_id", centerId)
      .eq("activo", true)
      .order("nombre"),
  ]);

  const tickets = ticketsRes.data ?? [];
  const staff = staffRes.data ?? [];

  const total = tickets.length;
  const pendientes = tickets.filter((t: any) => t.estado === "Pendiente").length;
  const enRevision = tickets.filter((t: any) => t.estado === "EnRevision").length;
  const altaPrioridad = tickets.filter(
    (t: any) => t.prioridad === "Alta" && t.estado !== "Cerrado"
  ).length;

  return (
    <div>
      <PageHeader
        title="Tickets y solicitudes"
        subtitle="Centro de atención interna del centro de conciliación"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-5">
        <KpiCard label="Total" value={total} hint="Tickets registrados" borderColor="#0D2340" valueClass="text-[#0D2340]" />
        <KpiCard label="Pendientes" value={pendientes} hint="Sin atender" borderColor="#d97706" valueClass="text-amber-600" />
        <KpiCard label="En revisión" value={enRevision} hint="En proceso" borderColor="#2563eb" valueClass="text-blue-600" />
        <KpiCard label="Alta prioridad" value={altaPrioridad} hint="Sin cerrar" borderColor="#dc2626" valueClass="text-red-600" />
      </div>

      <TicketsClient
        initialTickets={tickets as any}
        staff={staff as any}
        currentStaffId={staffId}
        isAdmin={rol === "admin"}
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  borderColor,
  valueClass,
}: {
  label: string;
  value: number;
  hint: string;
  borderColor: string;
  valueClass: string;
}) {
  return (
    <div
      className="bg-white border border-[#DDE4ED] rounded-lg p-5 shadow-[0_1px_4px_rgba(13,35,64,0.06)]"
      style={{ borderLeft: `4px solid ${borderColor}` }}
    >
      <div className="text-[11px] font-bold text-[#7A8FA6] uppercase tracking-widest mb-1.5">{label}</div>
      <div className={`text-3xl font-black ${valueClass}`}>{value}</div>
      <div className="text-[11px] text-[#7A8FA6]">{hint}</div>
    </div>
  );
}
