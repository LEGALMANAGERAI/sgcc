// src/app/api/partes/tickets/[id]/adjuntos/[adjuntoId]/route.ts
// DELETE: elimina un adjunto del ticket. Solo si el uploader es la parte
// autenticada y el ticket no está cerrado.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, deleteFile } from "@/lib/supabase";
import { requireParte } from "@/lib/partes/auth-guard";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; adjuntoId: string }> }
) {
  const guard = await requireParte();
  if ("error" in guard) return guard.error;
  const { id: ticketId, adjuntoId } = await params;

  // Verificar que el ticket es de la parte y no está cerrado
  const { data: ticket } = await supabaseAdmin
    .from("sgcc_tickets")
    .select("id, estado")
    .eq("id", ticketId)
    .eq("solicitante_party_id", guard.userId)
    .maybeSingle();
  if (!ticket) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }
  if (ticket.estado === "Cerrado") {
    return NextResponse.json(
      { error: "No puede borrar adjuntos de un ticket cerrado" },
      { status: 400 }
    );
  }

  // Verificar ownership del adjunto
  const { data: adjunto } = await supabaseAdmin
    .from("sgcc_ticket_adjuntos")
    .select("id, ticket_id, storage_path, subido_por_party")
    .eq("id", adjuntoId)
    .eq("ticket_id", ticketId)
    .maybeSingle();
  if (!adjunto || adjunto.subido_por_party !== guard.userId) {
    return NextResponse.json({ error: "Adjunto no encontrado" }, { status: 404 });
  }

  // Borrar de storage (mejor effort) y luego de BD
  try {
    await deleteFile("sgcc-documents", adjunto.storage_path);
  } catch (e) {
    console.error("[adjuntos DELETE] storage:", e);
  }

  await supabaseAdmin.from("sgcc_ticket_adjuntos").delete().eq("id", adjuntoId);
  return NextResponse.json({ ok: true });
}
