// src/app/(partes)/mis-tickets/nuevo/page.tsx
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { NuevoTicketForm } from "./NuevoTicketForm";

export default async function NuevoTicketPage() {
  const session = await auth();
  if (!session || (session.user as any)?.userType !== "party") redirect("/login");

  const userId = (session.user as any).id as string;

  // Casos donde la parte está vinculada
  const { data: caseParties } = await supabaseAdmin
    .from("sgcc_case_parties")
    .select("case_id, caso:sgcc_cases(id, numero_radicado, tipo_tramite)")
    .eq("party_id", userId);

  const casos = (caseParties ?? [])
    .map((cp: any) => cp.caso)
    .filter(Boolean) as Array<{ id: string; numero_radicado: string; tipo_tramite: string }>;

  return <NuevoTicketForm casos={casos} />;
}
