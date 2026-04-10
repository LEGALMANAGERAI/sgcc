import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

/* ─── GET: Datos del centro del usuario autenticado ─────────────────────── */

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const user = session.user as any;
  if (user.sgccRol !== "admin") {
    return NextResponse.json({ error: "No autorizado. Solo administradores." }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("sgcc_centers")
    .select("*")
    .eq("id", user.centerId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Centro no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ center: data });
}

/* ─── PATCH: Actualizar campos del centro (solo admin) ──────────────────── */

const CAMPOS_PERMITIDOS = [
  "nombre",
  "rep_legal",
  "direccion",
  "ciudad",
  "departamento",
  "telefono",
  "email_contacto",
  "dias_habiles_citacion",
  "hora_inicio_audiencias",
  "hora_fin_audiencias",
  "metodo_asignacion",
  "logo_url",
  "color_primario",
  "color_secundario",
] as const;

const CAMPOS_PROHIBIDOS = ["nit", "resolucion_habilitacion", "tipo", "id", "created_at", "activo"];

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const user = session.user as any;
  if (user.sgccRol !== "admin") {
    return NextResponse.json({ error: "No autorizado. Solo administradores." }, { status: 403 });
  }

  const body = await request.json();

  // Verificar que no se intenten cambiar campos prohibidos
  for (const campo of CAMPOS_PROHIBIDOS) {
    if (campo in body) {
      return NextResponse.json(
        { error: `El campo '${campo}' no se puede modificar` },
        { status: 400 }
      );
    }
  }

  // Filtrar solo campos permitidos
  const updates: Record<string, any> = {};
  for (const campo of CAMPOS_PERMITIDOS) {
    if (campo in body) {
      updates[campo] = body[campo];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No se proporcionaron campos válidos para actualizar" }, { status: 400 });
  }

  // Validaciones básicas
  if (updates.nombre !== undefined && !updates.nombre.trim()) {
    return NextResponse.json({ error: "El nombre del centro es requerido" }, { status: 400 });
  }

  if (updates.dias_habiles_citacion !== undefined) {
    const dias = Number(updates.dias_habiles_citacion);
    if (isNaN(dias) || dias < 1 || dias > 90) {
      return NextResponse.json({ error: "Los días hábiles deben estar entre 1 y 90" }, { status: 400 });
    }
    updates.dias_habiles_citacion = dias;
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("sgcc_centers")
    .update(updates)
    .eq("id", user.centerId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Error al actualizar el centro: " + error.message }, { status: 500 });
  }

  return NextResponse.json({ center: data });
}
