// src/app/api/tickets/[id]/adjuntos/route.ts
// POST: el staff sube un adjunto a un ticket (típicamente al responder).
// Mismo patrón que el endpoint de partes pero con auth de staff.
// Validación, bucket privado y límite de 5: ver lib/tickets/adjuntos-storage.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { guardarAdjuntoTicket } from "@/lib/tickets/adjuntos-storage";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const staffId = (session.user as any)?.id as string | undefined;
  if (!staffId) return NextResponse.json({ error: "Sin staff id" }, { status: 400 });

  const { id: ticketId } = await params;

  const { data: ticket } = await supabaseAdmin
    .from("sgcc_tickets")
    .select("id, center_id, estado")
    .eq("id", ticketId)
    .eq("center_id", centerId)
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
    centerId,
    file,
    subidoPor: { staff: staffId },
  });
  if (r.error) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(r.data, { status: 201 });
}
