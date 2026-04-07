import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

/* ─── PATCH: Actualizar checklist ───────────────────────────────────────── */

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const user = session.user as any;
  if (user.sgccRol !== "admin") {
    return NextResponse.json({ error: "No autorizado. Solo administradores." }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  // Verificar que la checklist pertenece al centro del usuario
  const { data: existing } = await supabaseAdmin
    .from("sgcc_checklists")
    .select("id, center_id")
    .eq("id", id)
    .eq("center_id", user.centerId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Checklist no encontrada" }, { status: 404 });
  }

  // Campos actualizables
  const updates: Record<string, any> = {};

  if (body.nombre !== undefined) {
    if (!body.nombre.trim()) {
      return NextResponse.json({ error: "El nombre no puede estar vacío" }, { status: 400 });
    }
    updates.nombre = body.nombre.trim();
  }

  if (body.items !== undefined) {
    if (!Array.isArray(body.items)) {
      return NextResponse.json({ error: "Los items deben ser un arreglo" }, { status: 400 });
    }
    // Validar estructura de cada item
    for (let i = 0; i < body.items.length; i++) {
      const item = body.items[i];
      if (!item.nombre || typeof item.nombre !== "string") {
        return NextResponse.json(
          { error: `El item ${i + 1} debe tener un nombre válido` },
          { status: 400 }
        );
      }
    }
    updates.items = body.items.map((item: any) => ({
      nombre: item.nombre,
      requerido: Boolean(item.requerido),
      descripcion: item.descripcion ?? "",
    }));
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No se proporcionaron campos para actualizar" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("sgcc_checklists")
    .update(updates)
    .eq("id", id)
    .eq("center_id", user.centerId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Error al actualizar checklist: " + error.message }, { status: 500 });
  }

  return NextResponse.json({ checklist: data });
}

/* ─── DELETE: Desactivar checklist (soft delete) ────────────────────────── */

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const user = session.user as any;
  if (user.sgccRol !== "admin") {
    return NextResponse.json({ error: "No autorizado. Solo administradores." }, { status: 403 });
  }

  const { id } = await params;

  // Verificar pertenencia al centro
  const { data: existing } = await supabaseAdmin
    .from("sgcc_checklists")
    .select("id, center_id")
    .eq("id", id)
    .eq("center_id", user.centerId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Checklist no encontrada" }, { status: 404 });
  }

  // Soft delete: marcar como inactiva
  const { error } = await supabaseAdmin
    .from("sgcc_checklists")
    .update({ activo: false })
    .eq("id", id)
    .eq("center_id", user.centerId);

  if (error) {
    return NextResponse.json({ error: "Error al eliminar checklist: " + error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: "Checklist eliminada correctamente" });
}
