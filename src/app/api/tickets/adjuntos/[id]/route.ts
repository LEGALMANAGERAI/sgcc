// src/app/api/tickets/adjuntos/[id]/route.ts
// GET: único acceso a un adjunto de ticket. Verifica que quien pide sea staff
// del centro del ticket o la parte que lo abrió, y redirige a una URL firmada
// de 60 s del bucket privado "sgcc-tickets".

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { TICKETS_BUCKET } from "@/lib/tickets/adjuntos-storage";

const TTL_SEGUNDOS = 60;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const user = session?.user as { id?: string; userType?: string } | undefined;
  if (!user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await params;
  const noEncontrado = NextResponse.json({ error: "Adjunto no encontrado" }, { status: 404 });

  const { data: adjunto } = await supabaseAdmin
    .from("sgcc_ticket_adjuntos")
    .select("storage_path, sgcc_tickets!inner(center_id, solicitante_party_id)")
    .eq("id", id)
    .maybeSingle();
  if (!adjunto) return noEncontrado;

  const ticket = adjunto.sgcc_tickets as unknown as {
    center_id: string;
    solicitante_party_id: string | null;
  };
  const permitido =
    user.userType === "party"
      ? ticket.solicitante_party_id === user.id
      : resolveCenterId(session) === ticket.center_id;
  // 404 y no 403: no confirmar que el adjunto existe a quien no tiene acceso.
  if (!permitido) return noEncontrado;

  const { data: firmada, error } = await supabaseAdmin.storage
    .from(TICKETS_BUCKET)
    .createSignedUrl(adjunto.storage_path, TTL_SEGUNDOS);
  if (error || !firmada) return noEncontrado;

  const res = NextResponse.redirect(firmada.signedUrl, 302);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
