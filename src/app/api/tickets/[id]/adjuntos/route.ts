// src/app/api/tickets/[id]/adjuntos/route.ts
// POST: el staff sube un adjunto a un ticket (típicamente al responder).
// Mismo patrón que el endpoint de partes pero con auth de staff.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin, uploadFile } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { randomUUID } from "crypto";

const MAX_BYTES = 10 * 1024 * 1024;
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

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const storagePath = `tickets/${centerId}/${ticketId}/${randomUUID()}.${ext}`;
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
      subido_por_staff: staffId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
