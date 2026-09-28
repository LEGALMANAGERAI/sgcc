import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { guardGestionStaff } from "@/lib/server-utils";
import bcrypt from "bcryptjs";
import { randomUUID, randomBytes } from "crypto";
import { normalizeEmail } from "@/lib/normalize-email";

export async function GET(req: NextRequest) {
  const g = guardGestionStaff(await auth());
  if ("error" in g) return g.error;
  const { centerId } = g;

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
  const g = guardGestionStaff(await auth());
  if ("error" in g) return g.error;
  const { centerId, esAdmin } = g;

  const body = await req.json();
  const { nombre, email: rawEmail, telefono, rol, tarjeta_profesional, codigo_interno, supervisor_id } = body;

  const email = normalizeEmail(rawEmail);
  if (!nombre || !email || !rol) {
    return NextResponse.json({ error: "Nombre, email y rol son obligatorios" }, { status: 400 });
  }

  // Validar rol
  if (!["admin", "conciliador", "secretario"].includes(rol)) {
    return NextResponse.json({ error: "Rol no valido. Use: admin, conciliador o secretario" }, { status: 400 });
  }
  if (rol === "admin" && !esAdmin) {
    return NextResponse.json({ error: "Solo un admin puede crear administradores" }, { status: 403 });
  }

  // Verificar email unico en el centro (case-insensitive)
  const { data: existing } = await supabaseAdmin
    .from("sgcc_staff")
    .select("id")
    .ilike("email", email)
    .eq("center_id", centerId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Ya existe un miembro con ese email en este centro" }, { status: 409 });
  }

  // Contraseña temporal aleatoria: se devuelve UNA vez para que quien crea el
  // usuario se la entregue (antes era una clave fija igual para todos).
  const passwordTemporal = randomBytes(9).toString("base64url");
  const password_hash = await bcrypt.hash(passwordTemporal, 12);
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

  return NextResponse.json({ ...newStaff, password_temporal: passwordTemporal }, { status: 201 });
}
