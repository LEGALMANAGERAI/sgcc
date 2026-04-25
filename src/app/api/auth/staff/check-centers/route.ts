import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase";
import { normalizeEmail } from "@/lib/normalize-email";

/**
 * POST /api/auth/staff/check-centers
 *
 * Antes de disparar signIn, la UI pregunta: "con estas credenciales, ¿a qué
 * centros puede entrar esta persona?". Esto permite soportar staff que
 * trabaja en varios centros (misma email, distintos center_id).
 *
 * Body: { email, password }
 * Respuesta:
 *  - 200 { centers: [{ id, nombre }, ...] }  — la lista puede tener 0, 1 o N.
 *  - 400 si faltan campos.
 *
 * IMPORTANTE: solo devuelve centros donde la contraseña coincide. Si la
 * contraseña es inválida o el email no existe, se devuelve lista vacía
 * (comportamiento indistinguible para no filtrar existencia de cuentas).
 */
export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const email = normalizeEmail(body.email ?? "");
  const password = body.password ?? "";

  if (!email || !password) {
    return NextResponse.json({ error: "Faltan credenciales" }, { status: 400 });
  }

  const { data: staffRows, error } = await supabaseAdmin
    .from("sgcc_staff")
    .select("id, center_id, password_hash, center:sgcc_centers(id, nombre, activo)")
    .ilike("email", email)
    .eq("activo", true);

  if (error) {
    return NextResponse.json({ error: "Error de consulta" }, { status: 500 });
  }

  if (!staffRows || staffRows.length === 0) {
    return NextResponse.json({ centers: [], reason: "no_staff" });
  }

  // Distinguir "staff existe pero contraseña incorrecta" de "staff no existe"
  // para poder explicar al usuario por qué no puede entrar.
  let algunaCoincidencia = false;
  const centers: Array<{ id: string; nombre: string }> = [];
  for (const row of staffRows) {
    if (!row.password_hash) continue;

    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) continue;
    algunaCoincidencia = true;

    const centerObj = Array.isArray(row.center) ? row.center[0] : row.center;
    if (!centerObj || !centerObj.activo) continue;

    centers.push({ id: centerObj.id, nombre: centerObj.nombre });
  }

  if (centers.length === 0 && !algunaCoincidencia) {
    return NextResponse.json({ centers: [], reason: "wrong_password" });
  }
  if (centers.length === 0) {
    // Coincidió el password pero el centro está inactivo.
    return NextResponse.json({ centers: [], reason: "inactive_center" });
  }

  return NextResponse.json({ centers });
}
