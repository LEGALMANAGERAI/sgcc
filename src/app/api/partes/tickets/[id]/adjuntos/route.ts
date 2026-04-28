// src/app/api/partes/tickets/[id]/adjuntos/route.ts
// POST: sube un adjunto al ticket. Verifica ownership, ticket no cerrado y
// límite de 5 adjuntos por ticket. Storage: bucket sgcc-documents.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, uploadFile } from "@/lib/supabase";
import { requireParte } from "@/lib/partes/auth-guard";
import { randomUUID } from "crypto";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_ADJUNTOS = 5;
const MIME_PERMITIDOS = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

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

  // Límite de adjuntos
  const { count } = await supabaseAdmin
    .from("sgcc_ticket_adjuntos")
    .select("id", { count: "exact", head: true })
    .eq("ticket_id", ticketId);
  if ((count ?? 0) >= MAX_ADJUNTOS) {
    return NextResponse.json(
      { error: `Máximo ${MAX_ADJUNTOS} adjuntos por ticket` },
      { status: 400 }
    );
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Archivo excede 10 MB" }, { status: 413 });
  }
  if (!MIME_PERMITIDOS.has(file.type)) {
    return NextResponse.json(
      { error: "Tipo no permitido (PDF, JPG, PNG, WebP)" },
      { status: 415 }
    );
  }

  // Subir a Storage
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const storagePath = `tickets/${ticket.center_id}/${ticketId}/${randomUUID()}.${ext}`;
  let url: string;
  try {
    url = await uploadFile(file, "sgcc-documents", storagePath, file.type);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error subiendo archivo" },
      { status: 500 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("sgcc_ticket_adjuntos")
    .insert({
      ticket_id: ticketId,
      nombre_archivo: file.name,
      storage_path: storagePath,
      url,
      mime_type: file.type,
      tamano_bytes: file.size,
      subido_por_party: guard.userId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
