// src/app/api/partes/tickets/route.ts
// GET: lista tickets de la parte autenticada (filtros opcionales estado, case_id).
// POST: crea ticket nuevo. Categoría se forza a 'consulta_parte'. Si se envía
// case_id, se valida que la parte pertenezca al caso. Notifica a admins del centro.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireParte } from "@/lib/partes/auth-guard";
import { notify } from "@/lib/notifications";
import { randomUUID } from "crypto";
import type { TicketEstado, TicketPrioridad } from "@/types";

const PRIORIDADES_VALIDAS: TicketPrioridad[] = ["Normal", "Media", "Alta"];
const ESTADOS_FILTRO: TicketEstado[] = ["Pendiente", "EnRevision", "Respondido", "Cerrado"];

export async function GET(req: NextRequest) {
  const guard = await requireParte();
  if ("error" in guard) return guard.error;

  const { searchParams } = new URL(req.url);
  const estado = searchParams.get("estado");
  const caseId = searchParams.get("case_id");

  let query = supabaseAdmin
    .from("sgcc_tickets")
    .select(`
      *,
      caso:sgcc_cases(id, numero_radicado),
      respondedor:sgcc_staff!sgcc_tickets_respondido_por_fkey(id, nombre)
    `)
    .eq("solicitante_party_id", guard.userId)
    .order("created_at", { ascending: false });

  if (estado && ESTADOS_FILTRO.includes(estado as TicketEstado)) {
    query = query.eq("estado", estado);
  }
  if (caseId) query = query.eq("case_id", caseId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const guard = await requireParte();
  if ("error" in guard) return guard.error;

  const body = await req.json();
  const titulo = String(body.titulo ?? "").trim();
  const descripcion = body.descripcion ? String(body.descripcion).trim() : null;
  const prioridad: TicketPrioridad = PRIORIDADES_VALIDAS.includes(body.prioridad)
    ? body.prioridad
    : "Normal";
  const caseId = body.case_id ? String(body.case_id) : null;

  if (!titulo) {
    return NextResponse.json({ error: "El título es requerido" }, { status: 400 });
  }
  if (titulo.length > 200) {
    return NextResponse.json({ error: "El título no puede exceder 200 caracteres" }, { status: 400 });
  }
  if (descripcion && descripcion.length > 2000) {
    return NextResponse.json({ error: "La descripción no puede exceder 2000 caracteres" }, { status: 400 });
  }

  // Resolver center_id: si hay case_id, validar ownership y heredar centro.
  // Si no, usar el center_id de la parte.
  let centerId: string | null = guard.centerId;
  if (caseId) {
    const { data: caseParty } = await supabaseAdmin
      .from("sgcc_case_parties")
      .select("id, caso:sgcc_cases!inner(id, center_id)")
      .eq("case_id", caseId)
      .eq("party_id", guard.userId)
      .maybeSingle();
    if (!caseParty) {
      return NextResponse.json({ error: "No tiene acceso a este caso" }, { status: 403 });
    }
    centerId = (caseParty as any).caso.center_id;
  }
  if (!centerId) {
    return NextResponse.json(
      { error: "No se pudo determinar el centro. Contacte al centro o adjunte un caso." },
      { status: 400 }
    );
  }

  const ticketId = randomUUID();
  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("sgcc_tickets")
    .insert({
      id: ticketId,
      center_id: centerId,
      case_id: caseId,
      titulo,
      descripcion,
      categoria: "consulta_parte",
      prioridad,
      estado: "Pendiente",
      solicitante_party_id: guard.userId,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notificar a admins del centro (Q5)
  try {
    const { data: admins } = await supabaseAdmin
      .from("sgcc_staff")
      .select("id, email")
      .eq("center_id", centerId)
      .eq("activo", true)
      .eq("rol", "admin");

    const recipients = (admins ?? []).map((a) => ({
      staffId: a.id,
      email: a.email ?? undefined,
    }));

    if (recipients.length > 0) {
      const { data: parte } = await supabaseAdmin
        .from("sgcc_parties")
        .select("nombres, apellidos, razon_social, email")
        .eq("id", guard.userId)
        .maybeSingle();
      const nombreParte =
        [parte?.nombres, parte?.apellidos].filter(Boolean).join(" ") ||
        parte?.razon_social ||
        parte?.email ||
        "una parte";

      await notify({
        centerId,
        caseId: caseId ?? undefined,
        tipo: "ticket_nuevo",
        titulo: `🎫 Nuevo ticket de parte — ${titulo}`,
        mensaje: `${nombreParte} ha abierto un ticket con prioridad ${prioridad}.${
          descripcion ? `\n\n${descripcion}` : ""
        }`,
        recipients,
        canal: "both",
      });
    }
  } catch (e) {
    console.error("[partes/tickets] Error notificando ticket nuevo:", e);
  }

  return NextResponse.json(data, { status: 201 });
}
