export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlantillasClient } from "./PlantillasClient";

export default async function PlantillasPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const centerId = resolveCenterId(session);
  if (!centerId) redirect("/login");

  const isAdmin = (session.user as any).sgccRol === "admin";

  // Plantillas del centro + globales
  const { data: plantillas } = await supabaseAdmin
    .from("sgcc_templates")
    .select("*")
    .or(`center_id.eq.${centerId},center_id.is.null`)
    .eq("activo", true)
    .order("tipo")
    .order("nombre");

  return (
    <div>
      <PageHeader
        title="Plantillas de Documentos"
        subtitle="Gestione las plantillas para citaciones, actas, constancias y más"
      />
      <PlantillasClient
        plantillas={plantillas ?? []}
        isAdmin={isAdmin}
        centerId={centerId}
      />
    </div>
  );
}
