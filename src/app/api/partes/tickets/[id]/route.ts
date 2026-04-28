// src/app/api/partes/tickets/[id]/route.ts
// GET: detalle del ticket de la parte (con adjuntos) — verifica ownership.
// PATCH: solo permite cambiar estado a 'Cerrado'. Cualquier otro cambio → 403.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireParte } from "@/lib/partes/auth-guard";
import { notify } from "@/lib/notifications";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireParte();
  if ("error" in guard) return guard.error;
  const { id } = await params;

  const { data: ticket, error } = await supabaseAdmin
    .from("sgcc_tickets")
    .select(`
      *,
      caso:sgcc_cases(id, numero_radicado),
      respondedor:sgcc_staff!sgcc_tickets_respondido_por_fkey(id, nombre)
    `)
    .eq("id", id)
    .eq("solicitante_party_id", guard.userId)
    .maybeSingle();

  if (error || !ticket) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }

  // Cargar adjuntos en paralelo con info del uploader
  const { data: adjuntos } = await supabaseAdmin
    .from("sgcc_ticket_adjuntos")
    .select("*")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });

  return NextResponse.json({ ...ticket, adjuntos: adjuntos ?? [] });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireParte();
  if ("error" in guard) return guard.error;
  const { id } = await params;
  const body = await req.json();

  // Solo se permite cerrar el ticket: cualquier otro campo → 403
  const keys = Object.keys(body);
  if (keys.length !== 1 || keys[0] !== "estado" || body.estado !== "Cerrado") {
    return NextResponse.json(
      { error: "Las partes solo pueden cerrar el ticket" },
      { status: 403 }
    );
  }

  // Verificar ownership
  const { data: ticket } = await supabaseAdmin
    .from("sgcc_tickets")
    .select("id, center_id, titulo, estado")
    .eq("id", id)
    .eq("solicitante_party_id", guard.userId)
    .maybeSingle();
  if (!ticket) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }
  if (ticket.estado === "Cerrado") {
    return NextResponse.json({ error: "El ticket ya está cerrado" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("sgcc_tickets")
    .update({ estado: "Cerrado", updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notificación informativa a admins del centro (Q4)
  try {
    const { data: admins } = await supabaseAdmin
      .from("sgcc_staff")
      .select("id, email")
      .eq("center_id", ticket.center_id)
      .eq("activo", true)
      .eq("rol", "admin");
    const recipients = (admins ?? []).map((a) => ({
      staffId: a.id,
      email: a.email ?? undefined,
    }));
    if (recipients.length > 0) {
      await notify({
        centerId: ticket.center_id,
        tipo: "ticket_respondido",
        titulo: `✅ Ticket cerrado por la parte — ${ticket.titulo}`,
        mensaje: `La parte cerró el ticket "${ticket.titulo}".`,
        recipients,
        canal: "in_app",
      });
    }
  } catch (e) {
    console.error("[PARTES/TICKETS PATCH] Error notificando cierre:", e);
  }

  return NextResponse.json(data);
}
