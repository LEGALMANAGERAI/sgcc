import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";

/**
 * PATCH /api/plantillas/[id]
 * Actualizar plantilla (solo las del centro, no las globales).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.sgccRol !== "admin") {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  }

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id } = await params;
  const body = await req.json();

  // Verificar que la plantilla pertenece al centro
  const { data: existing } = await supabaseAdmin
    .from("sgcc_templates")
    .select("id, center_id, es_default")
    .eq("id", id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });
  }

  if (existing.center_id !== centerId) {
    return NextResponse.json(
      { error: "No puede editar plantillas globales. Duplique la plantilla para personalizarla." },
      { status: 403 }
    );
  }

  const updates: Record<string, any> = {};
  if (body.nombre?.trim()) updates.nombre = body.nombre.trim();
  if (body.contenido?.trim()) {
    updates.contenido = body.contenido.trim();
    // Re-extraer variables
    const matches = updates.contenido.match(/\{\{([^}]+)\}\}/g) ?? [];
    updates.variables = [...new Set(matches.map((m: string) => m.replace(/[{}]/g, "")))];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("sgcc_templates")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

/**
 * DELETE /api/plantillas/[id]
 * Desactivar plantilla (soft delete, solo las del centro).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.sgccRol !== "admin") {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  }

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id } = await params;

  // Verificar que la plantilla pertenece al centro
  const { data: existing } = await supabaseAdmin
    .from("sgcc_templates")
    .select("id, center_id")
    .eq("id", id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });
  }

  if (existing.center_id !== centerId) {
    return NextResponse.json({ error: "No puede eliminar plantillas globales" }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from("sgcc_templates")
    .update({ activo: false })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
