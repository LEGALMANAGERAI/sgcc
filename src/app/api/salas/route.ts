import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro asignado" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("sgcc_rooms")
    .select("id, nombre, tipo, capacidad, link_virtual, activo, created_at")
    .eq("center_id", centerId)
    .order("nombre", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro asignado" }, { status: 400 });

  const body = await req.json();
  const { nombre, tipo, capacidad, link_virtual } = body;

  if (!nombre || !tipo) {
    return NextResponse.json({ error: "Nombre y tipo son obligatorios" }, { status: 400 });
  }

  if (!["presencial", "virtual", "hibrida"].includes(tipo)) {
    return NextResponse.json({ error: "Tipo no valido. Use: presencial, virtual o hibrida" }, { status: 400 });
  }

  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("sgcc_rooms")
    .insert({
      id: randomUUID(),
      center_id: centerId,
      nombre,
      tipo,
      capacidad: capacidad ?? null,
      link_virtual: link_virtual || null,
      activo: true,
      created_at: now,
      updated_at: now,
    })
    .select("id, nombre, tipo, capacidad")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
