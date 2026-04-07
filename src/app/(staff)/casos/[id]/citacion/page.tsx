export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import Link from "next/link";
import { CitacionForm } from "@/components/modules/casos/CitacionForm";
export const dynamic = "force-dynamic";

interface Props {
export const dynamic = "force-dynamic";
  params: Promise<{ id: string }>;
}
export const dynamic = "force-dynamic";

export default async function CitacionPage({ params }: Props) {
export const dynamic = "force-dynamic";
  const { id } = await params;
  const session = await auth();
export const dynamic = "force-dynamic";
  const centerId = (session!.user as any).centerId;

export const dynamic = "force-dynamic";
  const { data: caso } = await supabaseAdmin
    .from("sgcc_cases")
export const dynamic = "force-dynamic";
    .select("id, numero_radicado, materia, estado, fecha_limite_citacion, sala_id, conciliador_id")
    .eq("id", id)
export const dynamic = "force-dynamic";
    .eq("center_id", centerId)
    .single();
export const dynamic = "force-dynamic";

  if (!caso) notFound();
export const dynamic = "force-dynamic";
  if (caso.estado !== "admitido") redirect(`/casos/${id}`);

export const dynamic = "force-dynamic";
  const { data: templates } = await supabaseAdmin
    .from("sgcc_templates")
export const dynamic = "force-dynamic";
    .select("id, nombre, tipo")
    .or(`center_id.eq.${centerId},center_id.is.null`)
export const dynamic = "force-dynamic";
    .eq("tipo", "citacion")
    .eq("activo", true)
export const dynamic = "force-dynamic";
    .order("es_default", { ascending: false });

export const dynamic = "force-dynamic";
  const { data: salas } = await supabaseAdmin
    .from("sgcc_rooms")
export const dynamic = "force-dynamic";
    .select("id, nombre, tipo, link_virtual")
    .eq("center_id", centerId)
export const dynamic = "force-dynamic";
    .eq("activa", true)
    .order("nombre");
export const dynamic = "force-dynamic";

  return (
export const dynamic = "force-dynamic";
    <div>
      <div className="mb-2">
export const dynamic = "force-dynamic";
        <Link href={`/casos/${id}`} className="text-xs text-gray-400 hover:text-gray-600">
          ← {caso.numero_radicado}
export const dynamic = "force-dynamic";
        </Link>
      </div>
export const dynamic = "force-dynamic";
      <PageHeader
        title="Generar citación"
export const dynamic = "force-dynamic";
        subtitle={`Caso ${caso.numero_radicado} — Límite: ${caso.fecha_limite_citacion ? new Date(caso.fecha_limite_citacion).toLocaleDateString("es-CO") : "Sin definir"}`}
      />
export const dynamic = "force-dynamic";
      <CitacionForm
        caseId={id}
export const dynamic = "force-dynamic";
        templates={templates ?? []}
        salas={salas ?? []}
export const dynamic = "force-dynamic";
        currentSalaId={caso.sala_id}
      />
export const dynamic = "force-dynamic";
    </div>
  );
export const dynamic = "force-dynamic";
}
