export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlantillasTabs } from "@/components/modules/plantillas/PlantillasTabs";
import { ClausulasClient } from "./ClausulasClient";

export default async function ClausulasPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const centerId = resolveCenterId(session);
  if (!centerId) redirect("/login");

  const isAdmin = (session.user as any).sgccRol === "admin";

  // Cláusulas del centro + globales, solo activas
  const { data: clausulas } = await supabaseAdmin
    .from("sgcc_clausulas")
    .select("*")
    .or(`center_id.eq.${centerId},center_id.is.null`)
    .eq("activo", true)
    .order("categoria")
    .order("titulo");

  return (
    <div>
      <PageHeader
        title="Librería de Cláusulas"
        subtitle="Cláusulas reutilizables para actas, acuerdos y constancias"
      />
      <PlantillasTabs />
      <ClausulasClient
        clausulas={clausulas ?? []}
        isAdmin={isAdmin}
      />
    </div>
  );
}
