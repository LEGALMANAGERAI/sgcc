import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro asignado" }, { status: 400 });

  // Staff del centro
  const { data: staff, error } = await supabaseAdmin
    .from("sgcc_staff")
    .select("id, nombre, email, telefono, tarjeta_profesional, codigo_interno, rol, activo, supervisor_id, created_at")
    .eq("center_id", centerId)
    .order("nombre", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Contar casos activos por conciliador
  const staffIds = (staff ?? []).map((s) => s.id);
  const caseCounts: Record<string, number> = {};

  if (staffIds.length > 0) {
    const { data: cases } = await supabaseAdmin
      .from("sgcc_cases")
      .select("conciliador_id")
      .eq("center_id", centerId)
      .in("conciliador_id", staffIds)
      .not("estado", "in", '("cerrado","rechazado")');

    for (const c of cases ?? []) {
      if (c.conciliador_id) {
        caseCounts[c.conciliador_id] = (caseCounts[c.conciliador_id] ?? 0) + 1;
      }
    }
  }

  const enriched = (staff ?? []).map((s) => ({
    ...s,
    casos_activos: caseCounts[s.id] ?? 0,
  }));

  return NextResponse.json(enriched);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro asignado" }, { status: 400 });

  const body = await req.json();
  const { nombre, email, telefono, rol, tarjeta_profesional, codigo_interno, supervisor_id } = body;

  if (!nombre || !email || !rol) {
    return NextResponse.json({ error: "Nombre, email y rol son obligatorios" }, { status: 400 });
  }

  // Validar rol
  if (!["admin", "conciliador", "secretario"].includes(rol)) {
    return NextResponse.json({ error: "Rol no valido. Use: admin, conciliador o secretario" }, { status: 400 });
  }

  // Verificar email unico en el centro
  const { data: existing } = await supabaseAdmin
    .from("sgcc_staff")
    .select("id")
    .eq("email", email)
    .eq("center_id", centerId)
    .single();

  if (existing) {
    return NextResponse.json({ error: "Ya existe un miembro con ese email en este centro" }, { status: 409 });
  }

  // Hash de contrasena por defecto
  const password_hash = await bcrypt.hash("Sgcc2026*", 12);
  const now = new Date().toISOString();

  const { data: newStaff, error } = await supabaseAdmin
    .from("sgcc_staff")
    .insert({
      id: randomUUID(),
      center_id: centerId,
      nombre,
      email,
      telefono: telefono || null,
      rol,
      tarjeta_profesional: tarjeta_profesional || null,
      codigo_interno: codigo_interno || null,
      supervisor_id: supervisor_id || null,
      password_hash,
      activo: true,
      created_at: now,
      updated_at: now,
    })
    .select("id, nombre, email, rol")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(newStaff, { status: 201 });
}
