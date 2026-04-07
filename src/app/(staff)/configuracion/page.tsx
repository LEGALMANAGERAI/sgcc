export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConfiguracionClient } from "./ConfiguracionClient";
import type { SgccCenter, SgccChecklist } from "@/types";

export default async function ConfiguracionPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const user = session.user as any;
  if (user.sgccRol !== "admin") redirect("/dashboard");

  const centerId = user.centerId as string;

  // Cargar datos del centro y checklists en paralelo
  const [centerRes, checklistsRes] = await Promise.all([
    supabaseAdmin
      .from("sgcc_centers")
      .select("*")
      .eq("id", centerId)
      .single(),
    supabaseAdmin
      .from("sgcc_checklists")
      .select("*")
      .eq("center_id", centerId)
      .eq("activo", true)
      .order("tipo_tramite")
      .order("tipo_checklist"),
  ]);

  const center: SgccCenter | null = centerRes.data;
  const checklists: SgccChecklist[] = checklistsRes.data ?? [];

  if (!center) redirect("/dashboard");

  return (
    <>
      <PageHeader
        title="Configuración del Centro"
        subtitle="Administra los datos, horarios y checklists de tu centro de conciliación"
      />
      <ConfiguracionClient center={center} checklists={checklists} />
    </>
  );
}
