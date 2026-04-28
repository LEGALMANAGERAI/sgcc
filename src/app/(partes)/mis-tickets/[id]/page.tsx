// src/app/(partes)/mis-tickets/[id]/page.tsx
export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { TicketDetalleClient } from "./TicketDetalleClient";

export default async function MiTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session || (session.user as any)?.userType !== "party") redirect("/login");

  const userId = (session.user as any).id as string;
  const { id } = await params;

  const { data: ticket } = await supabaseAdmin
    .from("sgcc_tickets")
    .select(`
      *,
      caso:sgcc_cases(id, numero_radicado),
      respondedor:sgcc_staff!sgcc_tickets_respondido_por_fkey(id, nombre)
    `)
    .eq("id", id)
    .eq("solicitante_party_id", userId)
    .maybeSingle();

  if (!ticket) notFound();

  const { data: adjuntos } = await supabaseAdmin
    .from("sgcc_ticket_adjuntos")
    .select("*")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });

  return (
    <TicketDetalleClient
      ticket={ticket as any}
      adjuntosIniciales={(adjuntos ?? []) as any[]}
      userId={userId}
    />
  );
}
