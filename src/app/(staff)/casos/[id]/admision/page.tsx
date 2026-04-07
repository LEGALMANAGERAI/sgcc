export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import Link from "next/link";
import { AdmisionForm } from "@/components/modules/casos/AdmisionForm";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdmisionPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  const centerId = (session!.user as any).centerId;

  const { data: caso } = await supabaseAdmin
    .from("sgcc_cases")
    .select("id, numero_radicado, materia, estado, descripcion")
    .eq("id", id)
    .eq("center_id", centerId)
    .single();

  if (!caso) notFound();
  if (caso.estado !== "solicitud") redirect(`/casos/${id}`);

  const { data: conciliadores } = await supabaseAdmin
    .from("sgcc_staff")
    .select("id, nombre, tarjeta_profesional")
    .eq("center_id", centerId)
    .eq("rol", "conciliador")
    .eq("activo", true)
    .order("nombre");

  const { data: secretarios } = await supabaseAdmin
    .from("sgcc_staff")
    .select("id, nombre")
    .eq("center_id", centerId)
    .in("rol", ["secretario", "admin"])
    .eq("activo", true)
    .order("nombre");

  return (
    <div>
      <div className="mb-2">
        <Link href={`/casos/${id}`} className="text-xs text-gray-400 hover:text-gray-600">
          ← {caso.numero_radicado}
        </Link>
      </div>
      <PageHeader
        title="Procesar admisión"
        subtitle={`Caso ${caso.numero_radicado} — ${caso.materia}`}
      />
      <AdmisionForm
        caseId={id}
        conciliadores={conciliadores ?? []}
        secretarios={secretarios ?? []}
      />
    </div>
  );
}
