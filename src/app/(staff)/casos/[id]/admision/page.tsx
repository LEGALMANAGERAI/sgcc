export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import Link from "next/link";
import { AdmisionForm } from "@/components/modules/casos/AdmisionForm";
export const dynamic = "force-dynamic";

interface Props {
export const dynamic = "force-dynamic";
  params: Promise<{ id: string }>;
}
export const dynamic = "force-dynamic";

export default async function AdmisionPage({ params }: Props) {
export const dynamic = "force-dynamic";
  const { id } = await params;
  const session = await auth();
export const dynamic = "force-dynamic";
  const centerId = (session!.user as any).centerId;

export const dynamic = "force-dynamic";
  const { data: caso } = await supabaseAdmin
    .from("sgcc_cases")
export const dynamic = "force-dynamic";
    .select("id, numero_radicado, materia, estado, descripcion")
    .eq("id", id)
export const dynamic = "force-dynamic";
    .eq("center_id", centerId)
    .single();
export const dynamic = "force-dynamic";

  if (!caso) notFound();
export const dynamic = "force-dynamic";
  if (caso.estado !== "solicitud") redirect(`/casos/${id}`);

export const dynamic = "force-dynamic";
  const { data: conciliadores } = await supabaseAdmin
    .from("sgcc_staff")
export const dynamic = "force-dynamic";
    .select("id, nombre, tarjeta_profesional")
    .eq("center_id", centerId)
export const dynamic = "force-dynamic";
    .eq("rol", "conciliador")
    .eq("activo", true)
export const dynamic = "force-dynamic";
    .order("nombre");

export const dynamic = "force-dynamic";
  const { data: secretarios } = await supabaseAdmin
    .from("sgcc_staff")
export const dynamic = "force-dynamic";
    .select("id, nombre")
    .eq("center_id", centerId)
export const dynamic = "force-dynamic";
    .in("rol", ["secretario", "admin"])
    .eq("activo", true)
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
        title="Procesar admisión"
        subtitle={`Caso ${caso.numero_radicado} — ${caso.materia}`}
export const dynamic = "force-dynamic";
      />
      <AdmisionForm
export const dynamic = "force-dynamic";
        caseId={id}
        conciliadores={conciliadores ?? []}
export const dynamic = "force-dynamic";
        secretarios={secretarios ?? []}
      />
export const dynamic = "force-dynamic";
    </div>
  );
export const dynamic = "force-dynamic";
}
