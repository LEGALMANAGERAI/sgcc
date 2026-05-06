import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId, staffSoloVeSusCasos } from "@/lib/server-utils";

const TIPOS = new Set(["compromiso", "pendiente"]);

async function getItemDelCentro(id: string, centerId: string) {
  const { data } = await supabaseAdmin
    .from("sgcc_agenda_items")
    .select("id, center_id, staff_id, completado")
    .eq("id", id)
    .eq("center_id", centerId)
    .maybeSingle();
  return data;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro asignado" }, { status: 400 });

  const userId = (session.user as any).id as string | undefined;
  const { id } = await params;

  const item = await getItemDelCentro(id, centerId);
  if (!item) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Solo el creador puede editar (también si conciliador, debe ser suyo).
  if (item.staff_id !== userId) {
    return NextResponse.json({ error: "Solo el creador puede modificar este item" }, { status: 403 });
  }
  // Conciliador adicionalmente solo puede tocar los suyos (redundante pero explícito).
  if (staffSoloVeSusCasos(session) && item.staff_id !== userId) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json();
  const update: Record<string, unknown> = {};

  if (body.tipo !== undefined) {
    const t = String(body.tipo);
    if (!TIPOS.has(t)) return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
    update.tipo = t;
  }
  if (body.titulo !== undefined) {
    const titulo = String(body.titulo).trim();
    if (!titulo) return NextResponse.json({ error: "Título requerido" }, { status: 400 });
    update.titulo = titulo;
  }
  if (body.descripcion !== undefined) {
    update.descripcion = body.descripcion ? String(body.descripcion) : null;
  }
  if (body.fecha !== undefined) {
    const f = String(body.fecha);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) {
      return NextResponse.json({ error: "Fecha inválida (YYYY-MM-DD)" }, { status: 400 });
    }
    update.fecha = f;
  }
  if (body.hora_inicio !== undefined) {
    if (body.hora_inicio === null || body.hora_inicio === "") {
      update.hora_inicio = null;
    } else {
      const h = String(body.hora_inicio);
      if (!/^\d{2}:\d{2}(:\d{2})?$/.test(h)) {
        return NextResponse.json({ error: "Hora inválida (HH:MM)" }, { status: 400 });
      }
      update.hora_inicio = h;
    }
  }
  if (body.duracion_min !== undefined) {
    const n = Number(body.duracion_min);
    if (!Number.isFinite(n)) return NextResponse.json({ error: "Duración inválida" }, { status: 400 });
    update.duracion_min = Math.max(15, Math.min(600, n));
  }
  if (body.caso_id !== undefined) {
    if (body.caso_id === null || body.caso_id === "") {
      update.caso_id = null;
    } else {
      const cid = String(body.caso_id);
      const { data: caso } = await supabaseAdmin
        .from("sgcc_cases")
        .select("id, center_id")
        .eq("id", cid)
        .maybeSingle();
      if (!caso || caso.center_id !== centerId) {
        return NextResponse.json({ error: "Expediente no pertenece al centro" }, { status: 400 });
      }
      update.caso_id = cid;
    }
  }
  if (body.completado !== undefined) {
    const c = Boolean(body.completado);
    update.completado = c;
    update.completado_at = c ? new Date().toISOString() : null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("sgcc_agenda_items")
    .update(update)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro asignado" }, { status: 400 });

  const userId = (session.user as any).id as string | undefined;
  const { id } = await params;

  const item = await getItemDelCentro(id, centerId);
  if (!item) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (item.staff_id !== userId) {
    return NextResponse.json({ error: "Solo el creador puede eliminar este item" }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from("sgcc_agenda_items")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
