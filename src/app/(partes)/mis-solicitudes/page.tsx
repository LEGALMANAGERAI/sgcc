export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { MisSolicitudesClient } from "./MisSolicitudesClient";

export default async function MisSolicitudesPage() {
  if (process.env.ENABLE_PORTAL_PARTES_SOLICITUDES !== "true") {
    redirect("/mis-casos");
  }

  const session = await auth();
  if (!session) redirect("/login");
  const userId = (session.user as { id: string }).id;

  const { data: drafts } = await supabaseAdmin
    .from("sgcc_solicitudes_draft")
    .select("id, tipo_tramite, step_actual, completado_pct, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  const { data: caseParties } = await supabaseAdmin
    .from("sgcc_case_parties")
    .select(
      "caso:sgcc_cases(id, numero_radicado, tipo_tramite, estado, fecha_solicitud)"
    )
    .eq("party_id", userId)
    .eq("rol", "convocante")
    .order("created_at", { ascending: false });

  const casos = (caseParties ?? [])
    .map((cp: { caso: unknown }) => cp.caso)
    .filter(Boolean) as Array<{
      id: string;
      numero_radicado: string;
      tipo_tramite: string;
      estado: string;
      fecha_solicitud: string;
    }>;

  return <MisSolicitudesClient drafts={drafts ?? []} casos={casos} />;
}
