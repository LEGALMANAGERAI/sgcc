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
  const { nombre, tipo, capacidad, link_virtual } = body;

  // Verificar que la sala pertenece al centro
  const { data: existing } = await supabaseAdmin
    .from("sgcc_rooms")
    .select("id")
    .eq("id", id)
    .eq("center_id", centerId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Sala no encontrada en este centro" }, { status: 404 });
  }

  if (tipo && !["presencial", "virtual", "hibrida"].includes(tipo)) {
    return NextResponse.json({ error: "Tipo no valido" }, { status: 400 });
  }

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (nombre !== undefined) updates.nombre = nombre;
  if (tipo !== undefined) updates.tipo = tipo;
  if (capacidad !== undefined) updates.capacidad = capacidad;
  if (link_virtual !== undefined) updates.link_virtual = link_virtual || null;

  const { data, error } = await supabaseAdmin
    .from("sgcc_rooms")
    .update(updates)
    .eq("id", id)
    .select("id, nombre, tipo, capacidad")
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

  const { data: existing } = await supabaseAdmin
    .from("sgcc_rooms")
    .select("id, nombre")
    .eq("id", id)
    .eq("center_id", centerId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Sala no encontrada en este centro" }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from("sgcc_rooms")
    .update({ activo: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ mensaje: `Sala "${existing.nombre}" desactivada` });
}
