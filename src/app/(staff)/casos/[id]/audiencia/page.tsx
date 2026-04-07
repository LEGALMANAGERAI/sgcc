export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import Link from "next/link";
import { AudienciaForm } from "@/components/modules/casos/AudienciaForm";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AudienciaPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  const centerId = (session!.user as any).centerId;

  const { data: caso } = await supabaseAdmin
    .from("sgcc_cases")
    .select("id, numero_radicado, materia, estado, fecha_audiencia, conciliador_id, sala_id")
    .eq("id", id)
    .eq("center_id", centerId)
    .single();

  if (!caso) notFound();

  const { data: conciliadores } = await supabaseAdmin
    .from("sgcc_staff")
    .select("id, nombre")
    .eq("center_id", centerId)
    .eq("rol", "conciliador")
    .eq("activo", true)
    .order("nombre");

  const { data: salas } = await supabaseAdmin
    .from("sgcc_rooms")
    .select("id, nombre, tipo, link_virtual")
    .eq("center_id", centerId)
    .eq("activa", true)
    .order("nombre");

  return (
    <div>
      <div className="mb-2">
        <Link href={`/casos/${id}`} className="text-xs text-gray-400 hover:text-gray-600">
          ← {caso.numero_radicado}
        </Link>
      </div>
      <PageHeader
        title="Programar audiencia"
        subtitle={`Caso ${caso.numero_radicado} — ${caso.materia}`}
      />
      <AudienciaForm
        caseId={id}
        conciliadores={conciliadores ?? []}
        salas={salas ?? []}
        defaultConciliadorId={caso.conciliador_id}
        defaultSalaId={caso.sala_id}
        defaultFechaHora={caso.fecha_audiencia}
      />
    </div>
  );
}
