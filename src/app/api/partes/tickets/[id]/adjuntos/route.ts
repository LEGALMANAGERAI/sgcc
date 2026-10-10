// src/app/api/partes/tickets/[id]/adjuntos/route.ts
// POST: sube un adjunto al ticket. Verifica ownership y ticket no cerrado.
// Validación, bucket privado y límite de 5: ver lib/tickets/adjuntos-storage.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireParte } from "@/lib/partes/auth-guard";
import { guardarAdjuntoTicket } from "@/lib/tickets/adjuntos-storage";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireParte();
  if ("error" in guard) return guard.error;
  const { id: ticketId } = await params;

  // Ownership + estado
  const { data: ticket } = await supabaseAdmin
    .from("sgcc_tickets")
    .select("id, center_id, estado")
    .eq("id", ticketId)
    .eq("solicitante_party_id", guard.userId)
    .maybeSingle();
  if (!ticket) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }
  if (ticket.estado === "Cerrado") {
    return NextResponse.json(
      { error: "No puede subir adjuntos a un ticket cerrado" },
      { status: 400 }
    );
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  }

  const r = await guardarAdjuntoTicket({
    ticketId,
    centerId: ticket.center_id,
    file,
    subidoPor: { party: guard.userId },
  });
  if (r.error) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(r.data, { status: 201 });
}
