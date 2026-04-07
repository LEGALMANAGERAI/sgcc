import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { randomUUID } from "crypto";

/**
 * Verificar que el proceso pertenece al centro del usuario.
 */
async function verifyProcess(processId: string, centerId: string) {
  const { data } = await supabaseAdmin
    .from("sgcc_watched_processes")
    .select("id")
    .eq("id", processId)
    .eq("center_id", centerId)
    .single();
  return data;
}

/**
 * GET /api/vigilancia/[id]/actuaciones
 * Listar actuaciones del proceso.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id } = await params;

  const process = await verifyProcess(id, centerId);
  if (!process) {
    return NextResponse.json({ error: "Proceso no encontrado" }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from("sgcc_process_updates")
    .select("*")
    .eq("watched_process_id", id)
    .order("fecha_actuacion", { ascending: false, nullsFirst: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}

/**
 * POST /api/vigilancia/[id]/actuaciones
 * Registrar nueva actuación manualmente.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id } = await params;

  const process = await verifyProcess(id, centerId);
  if (!process) {
    return NextResponse.json({ error: "Proceso no encontrado" }, { status: 404 });
  }

  const body = await req.json();
  const { fecha_actuacion, tipo_actuacion, anotacion, detalles } = body;

  if (!tipo_actuacion?.trim() && !anotacion?.trim()) {
    return NextResponse.json(
      { error: "Debe indicar el tipo de actuación o una anotación" },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("sgcc_process_updates")
    .insert({
      id: randomUUID(),
      watched_process_id: id,
      fecha_actuacion: fecha_actuacion || null,
      tipo_actuacion: tipo_actuacion?.trim() || null,
      anotacion: anotacion?.trim() || null,
      detalles: detalles?.trim() || null,
      leida: false,
      created_at: now,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Actualizar última actuación en el proceso padre
  const updateFields: Record<string, any> = {};
  if (anotacion?.trim()) updateFields.ultima_actuacion = anotacion.trim();
  if (fecha_actuacion) updateFields.ultima_actuacion_fecha = fecha_actuacion;

  if (Object.keys(updateFields).length > 0) {
    await supabaseAdmin
      .from("sgcc_watched_processes")
      .update(updateFields)
      .eq("id", id);
  }

  return NextResponse.json(data, { status: 201 });
}

/**
 * PATCH /api/vigilancia/[id]/actuaciones
 * Marcar actuación como leída. Body: { update_id: string }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id } = await params;

  const process = await verifyProcess(id, centerId);
  if (!process) {
    return NextResponse.json({ error: "Proceso no encontrado" }, { status: 404 });
  }

  const body = await req.json();
  const { update_id } = body;

  if (!update_id) {
    return NextResponse.json({ error: "Se requiere update_id" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("sgcc_process_updates")
    .update({
      leida: true,
      leida_por: (session.user as any).id,
      leida_at: now,
    })
    .eq("id", update_id)
    .eq("watched_process_id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
