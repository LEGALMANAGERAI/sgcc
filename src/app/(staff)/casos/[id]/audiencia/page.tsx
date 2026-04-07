export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import Link from "next/link";
import { AudienciaForm } from "@/components/modules/casos/AudienciaForm";
export const dynamic = "force-dynamic";

interface Props {
export const dynamic = "force-dynamic";
  params: Promise<{ id: string }>;
}
export const dynamic = "force-dynamic";

export default async function AudienciaPage({ params }: Props) {
export const dynamic = "force-dynamic";
  const { id } = await params;
  const session = await auth();
export const dynamic = "force-dynamic";
  const centerId = (session!.user as any).centerId;

export const dynamic = "force-dynamic";
  const { data: caso } = await supabaseAdmin
    .from("sgcc_cases")
export const dynamic = "force-dynamic";
    .select("id, numero_radicado, materia, estado, fecha_audiencia, conciliador_id, sala_id")
    .eq("id", id)
export const dynamic = "force-dynamic";
    .eq("center_id", centerId)
    .single();
export const dynamic = "force-dynamic";

  if (!caso) notFound();
export const dynamic = "force-dynamic";

  const { data: conciliadores } = await supabaseAdmin
export const dynamic = "force-dynamic";
    .from("sgcc_staff")
    .select("id, nombre")
export const dynamic = "force-dynamic";
    .eq("center_id", centerId)
    .eq("rol", "conciliador")
export const dynamic = "force-dynamic";
    .eq("activo", true)
    .order("nombre");
export const dynamic = "force-dynamic";

  const { data: salas } = await supabaseAdmin
export const dynamic = "force-dynamic";
    .from("sgcc_rooms")
    .select("id, nombre, tipo, link_virtual")
export const dynamic = "force-dynamic";
    .eq("center_id", centerId)
    .eq("activa", true)
export const dynamic = "force-dynamic";
    .order("nombre");

export const dynamic = "force-dynamic";
  return (
    <div>
export const dynamic = "force-dynamic";
      <div className="mb-2">
        <Link href={`/casos/${id}`} className="text-xs text-gray-400 hover:text-gray-600">
export const dynamic = "force-dynamic";
          ← {caso.numero_radicado}
        </Link>
export const dynamic = "force-dynamic";
      </div>
      <PageHeader
export const dynamic = "force-dynamic";
        title="Programar audiencia"
        subtitle={`Caso ${caso.numero_radicado} — ${caso.materia}`}
export const dynamic = "force-dynamic";
      />
      <AudienciaForm
export const dynamic = "force-dynamic";
        caseId={id}
        conciliadores={conciliadores ?? []}
export const dynamic = "force-dynamic";
        salas={salas ?? []}
        defaultConciliadorId={caso.conciliador_id}
export const dynamic = "force-dynamic";
        defaultSalaId={caso.sala_id}
        defaultFechaHora={caso.fecha_audiencia}
export const dynamic = "force-dynamic";
      />
    </div>
export const dynamic = "force-dynamic";
  );
}
