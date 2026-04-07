export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import Link from "next/link";
import { CitacionForm } from "@/components/modules/casos/CitacionForm";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CitacionPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  const centerId = (session!.user as any).centerId;

  const { data: caso } = await supabaseAdmin
    .from("sgcc_cases")
    .select("id, numero_radicado, materia, estado, fecha_limite_citacion, sala_id, conciliador_id")
    .eq("id", id)
    .eq("center_id", centerId)
    .single();

  if (!caso) notFound();
  if (caso.estado !== "admitido") redirect(`/casos/${id}`);

  const { data: templates } = await supabaseAdmin
    .from("sgcc_templates")
    .select("id, nombre, tipo")
    .or(`center_id.eq.${centerId},center_id.is.null`)
    .eq("tipo", "citacion")
    .eq("activo", true)
    .order("es_default", { ascending: false });

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
        title="Generar citación"
        subtitle={`Caso ${caso.numero_radicado} — Límite: ${caso.fecha_limite_citacion ? new Date(caso.fecha_limite_citacion).toLocaleDateString("es-CO") : "Sin definir"}`}
      />
      <CitacionForm
        caseId={id}
        templates={templates ?? []}
        salas={salas ?? []}
        currentSalaId={caso.sala_id}
      />
    </div>
  );
}
