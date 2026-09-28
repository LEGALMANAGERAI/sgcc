import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { guardGestionStaff } from "@/lib/server-utils";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const g = guardGestionStaff(await auth());
  if ("error" in g) return g.error;
  const { centerId, esAdmin } = g;

  const { id } = await params;
  const body = await req.json();
  const { nombre, email, telefono, rol, tarjeta_profesional, codigo_interno, supervisor_id, cedula, ciudad_cedula, codigo_inscripcion } = body;

  // Verificar que el staff pertenece al centro
  const { data: existing } = await supabaseAdmin
    .from("sgcc_staff")
    .select("id, rol")
    .eq("id", id)
    .eq("center_id", centerId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Miembro no encontrado en este centro" }, { status: 404 });
  }

  // Validar rol si se envia
  if (rol && !["admin", "conciliador", "secretario", "asistente"].includes(rol)) {
    return NextResponse.json({ error: "Rol no valido" }, { status: 400 });
  }
  // Sin esto, cualquiera podía ascenderse (o ascender a otro) a admin.
  if (!esAdmin && (existing.rol === "admin" || rol === "admin")) {
    return NextResponse.json({ error: "Solo un admin puede modificar administradores" }, { status: 403 });
  }

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (nombre !== undefined) updates.nombre = nombre;
  if (email !== undefined) updates.email = email;
  if (telefono !== undefined) updates.telefono = telefono || null;
  if (rol !== undefined) updates.rol = rol;
  if (tarjeta_profesional !== undefined) updates.tarjeta_profesional = tarjeta_profesional || null;
  if (codigo_interno !== undefined) updates.codigo_interno = codigo_interno || null;
  if (supervisor_id !== undefined) updates.supervisor_id = supervisor_id || null;
  if (cedula !== undefined) updates.cedula = cedula || null;
  if (ciudad_cedula !== undefined) updates.ciudad_cedula = ciudad_cedula || null;
  if (codigo_inscripcion !== undefined) updates.codigo_inscripcion = codigo_inscripcion || null;

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
  const g = guardGestionStaff(session);
  if ("error" in g) return g.error;
  const { centerId, esAdmin } = g;

  const { id } = await params;
  if (id === (session as any).user?.id) {
    return NextResponse.json({ error: "No puedes desactivar tu propia cuenta" }, { status: 400 });
  }

  // Verificar que el staff pertenece al centro
  const { data: existing } = await supabaseAdmin
    .from("sgcc_staff")
    .select("id, nombre, rol")
    .eq("id", id)
    .eq("center_id", centerId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Miembro no encontrado en este centro" }, { status: 404 });
  }
  if (existing.rol === "admin" && !esAdmin) {
    return NextResponse.json({ error: "Solo un admin puede desactivar administradores" }, { status: 403 });
  }

  // No eliminar, solo desactivar
  const { error } = await supabaseAdmin
    .from("sgcc_staff")
    .update({ activo: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ mensaje: `${existing.nombre} ha sido desactivado` });
}
