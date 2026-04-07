import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro asignado" }, { status: 400 });

  const { id } = await params;
  const body = await req.json();
  const { nombre, email, telefono, rol, tarjeta_profesional, supervisor_id } = body;

  // Verificar que el staff pertenece al centro
  const { data: existing } = await supabaseAdmin
    .from("sgcc_staff")
    .select("id")
    .eq("id", id)
    .eq("center_id", centerId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Miembro no encontrado en este centro" }, { status: 404 });
  }

  // Validar rol si se envia
  if (rol && !["admin", "conciliador", "secretario"].includes(rol)) {
    return NextResponse.json({ error: "Rol no valido" }, { status: 400 });
  }

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (nombre !== undefined) updates.nombre = nombre;
  if (email !== undefined) updates.email = email;
  if (telefono !== undefined) updates.telefono = telefono || null;
  if (rol !== undefined) updates.rol = rol;
  if (tarjeta_profesional !== undefined) updates.tarjeta_profesional = tarjeta_profesional || null;
  if (supervisor_id !== undefined) updates.supervisor_id = supervisor_id || null;

  const { data, error } = await supabaseAdmin
    .from("sgcc_staff")
    .update(updates)
    .eq("id", id)
    .select("id, nombre, email, rol")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro asignado" }, { status: 400 });

  const { id } = await params;

  // Verificar que el staff pertenece al centro
  const { data: existing } = await supabaseAdmin
    .from("sgcc_staff")
    .select("id, nombre")
    .eq("id", id)
    .eq("center_id", centerId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Miembro no encontrado en este centro" }, { status: 404 });
  }

  // No eliminar, solo desactivar
  const { error } = await supabaseAdmin
    .from("sgcc_staff")
    .update({ activo: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ mensaje: `${existing.nombre} ha sido desactivado` });
}
