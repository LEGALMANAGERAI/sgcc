import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId, isAdmin } from "@/lib/server-utils";
import { notify } from "@/lib/notifications";
import type { TicketEstado, TicketPrioridad } from "@/types";

const ESTADOS_VALIDOS: TicketEstado[] = ["Pendiente", "EnRevision", "Respondido", "Cerrado"];
const PRIORIDADES_VALIDAS: TicketPrioridad[] = ["Normal", "Media", "Alta"];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from("sgcc_tickets")
    .select(`
      *,
      solicitante:sgcc_staff!sgcc_tickets_solicitante_staff_id_fkey(id, nombre, email),
      asignado:sgcc_staff!sgcc_tickets_asignado_staff_id_fkey(id, nombre, email),
      respondedor:sgcc_staff!sgcc_tickets_respondido_por_fkey(id, nombre, email),
      caso:sgcc_cases(id, numero_radicado)
    `)
    .eq("id", id)
    .eq("center_id", centerId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const staffId = (session.user as any)?.id as string | undefined;
  const { id } = await params;
  const body = await req.json();

  // Verificar que el ticket pertenece al centro
  const { data: ticket, error: findErr } = await supabaseAdmin
    .from("sgcc_tickets")
    .select("id, solicitante_staff_id, solicitante_party_id, asignado_staff_id, titulo, center_id")
    .eq("id", id)
    .eq("center_id", centerId)
    .single();

  if (findErr || !ticket) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }

  // Permisos: admin, asignado o solicitante pueden editar
  const admin = isAdmin(session);
  const esAsignado = ticket.asignado_staff_id === staffId;
  const esSolicitante = ticket.solicitante_staff_id === staffId;
  if (!admin && !esAsignado && !esSolicitante) {
    return NextResponse.json({ error: "Sin permisos para editar este ticket" }, { status: 403 });
  }

  const update: Record<string, any> = { updated_at: new Date().toISOString() };

  if (body.estado !== undefined) {
    if (!ESTADOS_VALIDOS.includes(body.estado)) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }
    update.estado = body.estado;
  }

  if (body.prioridad !== undefined) {
    if (!PRIORIDADES_VALIDAS.includes(body.prioridad)) {
      return NextResponse.json({ error: "Prioridad inválida" }, { status: 400 });
    }
    update.prioridad = body.prioridad;
  }

  if (body.asignado_staff_id !== undefined) {
    update.asignado_staff_id = body.asignado_staff_id || null;
  }

  const respuestaNueva = typeof body.respuesta === "string" ? body.respuesta.trim() : null;
  if (respuestaNueva) {
    update.respuesta = respuestaNueva;
    update.respondido_por = staffId ?? null;
    update.respondido_at = new Date().toISOString();
    if (!update.estado) update.estado = "Respondido";
  }

  const { data, error } = await supabaseAdmin
    .from("sgcc_tickets")
    .update(update)
    .eq("id", id)
    .eq("center_id", centerId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notificar al solicitante cuando se responde (staff o parte)
  if (respuestaNueva) {
    try {
      // Caso A: solicitante es staff
      if (ticket.solicitante_staff_id && ticket.solicitante_staff_id !== staffId) {
        const { data: solicitante } = await supabaseAdmin
          .from("sgcc_staff")
          .select("id, email")
          .eq("id", ticket.solicitante_staff_id)
          .single();
        if (solicitante) {
          await notify({
            centerId,
            tipo: "ticket_respondido",
            titulo: `💬 Respuesta a tu ticket — ${ticket.titulo}`,
            mensaje: `Tu ticket ha sido respondido.\n\n${respuestaNueva}`,
            recipients: [{ staffId: solicitante.id, email: solicitante.email ?? undefined }],
            canal: "both",
          });
        }
      }

      // Caso B: solicitante es parte
      if (ticket.solicitante_party_id) {
        const { data: parte } = await supabaseAdmin
          .from("sgcc_parties")
          .select("id, email")
          .eq("id", ticket.solicitante_party_id)
          .single();
        if (parte) {
          await notify({
            centerId,
            tipo: "ticket_respondido",
            titulo: `💬 Respuesta a tu ticket — ${ticket.titulo}`,
            mensaje: `El centro respondió tu ticket.\n\n${respuestaNueva}`,
            recipients: [{ partyId: parte.id, email: parte.email ?? undefined }],
            canal: "both",
          });
        }
      }
    } catch (e) {
      console.error("[TICKETS] Error notificando respuesta:", e);
    }
  }

  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Solo administradores pueden eliminar tickets" }, { status: 403 });
  }

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id } = await params;

  const { error } = await supabaseAdmin
    .from("sgcc_tickets")
    .delete()
    .eq("id", id)
    .eq("center_id", centerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
