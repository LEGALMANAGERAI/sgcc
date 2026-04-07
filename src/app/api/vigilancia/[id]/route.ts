import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";

/**
 * PATCH /api/vigilancia/[id]
 * Actualizar estado del proceso (activo/terminado/archivado).
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
  const body = await req.json();
  const { estado } = body;

  const validEstados = ["activo", "terminado", "archivado"];
  if (!estado || !validEstados.includes(estado)) {
    return NextResponse.json(
      { error: "Estado inválido. Debe ser: activo, terminado o archivado" },
      { status: 400 }
    );
  }

  // Verificar que el proceso pertenece al centro
  const { data: existing } = await supabaseAdmin
    .from("sgcc_watched_processes")
    .select("id")
    .eq("id", id)
    .eq("center_id", centerId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Proceso no encontrado" }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from("sgcc_watched_processes")
    .update({ estado })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

/**
 * DELETE /api/vigilancia/[id]
 * Eliminar proceso de vigilancia.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id } = await params;

  // Verificar que el proceso pertenece al centro
  const { data: existing } = await supabaseAdmin
    .from("sgcc_watched_processes")
    .select("id")
    .eq("id", id)
    .eq("center_id", centerId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Proceso no encontrado" }, { status: 404 });
  }

  // Eliminar actuaciones asociadas primero
  await supabaseAdmin
    .from("sgcc_process_updates")
    .delete()
    .eq("watched_process_id", id);

  // Eliminar el proceso
  const { error } = await supabaseAdmin
    .from("sgcc_watched_processes")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
