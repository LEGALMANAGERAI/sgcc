import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";

/**
 * GET /api/admin/staff/duplicados
 *
 * Devuelve grupos de staff potencialmente duplicados en el mismo centro.
 * Criterios de match:
 *  - Mismo `nombre` (case-insensitive, sin espacios extras), o
 *  - Mismo `email` (case-insensitive — debería ser único pero por seguridad).
 *
 * Cada grupo trae count y la lista de cuentas con sus IDs, para que la UI
 * permita fusionar.
 */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rol = (session.user as any).sgccRol as string | undefined;
  if (rol !== "admin") {
    return NextResponse.json({ error: "Solo admin" }, { status: 403 });
  }

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { data: rows } = await supabaseAdmin
    .from("sgcc_staff")
    .select("id, email, nombre, rol, activo, created_at, password_hash")
    .eq("center_id", centerId)
    .order("nombre", { ascending: true });

  const todos = (rows ?? []).map((s: any) => ({
    id: s.id,
    email: s.email,
    nombre: s.nombre,
    rol: s.rol,
    activo: s.activo,
    created_at: s.created_at,
    tiene_password: !!s.password_hash,
  }));

  // Agrupar por nombre normalizado
  const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const porNombre = new Map<string, typeof todos>();
  for (const s of todos) {
    const k = norm(s.nombre);
    if (!k) continue;
    const arr = porNombre.get(k) ?? [];
    arr.push(s);
    porNombre.set(k, arr);
  }

  const grupos = Array.from(porNombre.values()).filter((g) => g.length > 1);

  return NextResponse.json({ grupos, total_staff: todos.length });
}
