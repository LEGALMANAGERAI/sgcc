// src/app/(partes)/mis-tickets/page.tsx
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { MisTicketsClient } from "./MisTicketsClient";

export default async function MisTicketsPage() {
  const session = await auth();
  if (!session || (session.user as any)?.userType !== "party") redirect("/login");

  const userId = (session.user as any).id as string;

  const { data: tickets } = await supabaseAdmin
    .from("sgcc_tickets")
    .select(`
      id, titulo, estado, prioridad, created_at, updated_at, case_id,
      caso:sgcc_cases(numero_radicado)
    `)
    .eq("solicitante_party_id", userId)
    .order("created_at", { ascending: false });

  return <MisTicketsClient ticketsIniciales={(tickets ?? []) as any[]} />;
}
