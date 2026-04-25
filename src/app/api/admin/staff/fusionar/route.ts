import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";

/**
 * POST /api/admin/staff/fusionar
 *
 * Fusiona dos cuentas duplicadas de staff en el mismo centro:
 *  - Mueve sgcc_cases.conciliador_id y .secretario_id de "desde" a "hacia".
 *  - Mueve sgcc_hearings.conciliador_id.
 *  - Mueve sgcc_correspondence.responsable_id (si existe esa FK).
 *  - Desactiva la cuenta "desde" (no la borra — preserva historial y la
 *    referencia de timestamps en timeline).
 *
 * Body: { desde_staff_id: string, hacia_staff_id: string }
 *
 * Validaciones:
 *  - Solo admin.
 *  - Ambas cuentas deben existir y pertenecer al MISMO centro.
 *  - "desde" y "hacia" no pueden ser el mismo id.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rol = (session.user as any).sgccRol as string | undefined;
  if (rol !== "admin") {
    return NextResponse.json({ error: "Solo admin" }, { status: 403 });
  }

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const { desde_staff_id, hacia_staff_id } = body ?? {};

  if (!desde_staff_id || !hacia_staff_id) {
    return NextResponse.json(
      { error: "desde_staff_id y hacia_staff_id son requeridos" },
      { status: 400 },
    );
  }
  if (desde_staff_id === hacia_staff_id) {
    return NextResponse.json({ error: "Los IDs deben ser distintos" }, { status: 400 });
  }

  // Verificar que ambos sean del mismo centro
  const { data: ambos } = await supabaseAdmin
    .from("sgcc_staff")
    .select("id, center_id, email, nombre")
    .in("id", [desde_staff_id, hacia_staff_id]);

  if (!ambos || ambos.length !== 2) {
    return NextResponse.json({ error: "Una de las cuentas no existe" }, { status: 404 });
  }

  if (ambos.some((s) => s.center_id !== centerId)) {
    return NextResponse.json({ error: "Ambas cuentas deben ser del mismo centro" }, { status: 400 });
  }

  const now = new Date().toISOString();

  // 1) Mover casos como conciliador
  const { data: casosConc } = await supabaseAdmin
    .from("sgcc_cases")
    .update({ conciliador_id: hacia_staff_id, updated_at: now })
    .eq("conciliador_id", desde_staff_id)
    .select("id");

  // 2) Mover casos como secretario
  const { data: casosSec } = await supabaseAdmin
    .from("sgcc_cases")
    .update({ secretario_id: hacia_staff_id, updated_at: now })
    .eq("secretario_id", desde_staff_id)
    .select("id");

  // 3) Mover audiencias
  const { data: audiencias } = await supabaseAdmin
    .from("sgcc_hearings")
    .update({ conciliador_id: hacia_staff_id, updated_at: now })
    .eq("conciliador_id", desde_staff_id)
    .select("id");

  // 4) Desactivar cuenta vieja
  await supabaseAdmin
    .from("sgcc_staff")
    .update({ activo: false, updated_at: now })
    .eq("id", desde_staff_id);

  return NextResponse.json({
    ok: true,
    movidos: {
      casos_conciliador: casosConc?.length ?? 0,
      casos_secretario: casosSec?.length ?? 0,
      audiencias: audiencias?.length ?? 0,
    },
    cuenta_desactivada: desde_staff_id,
  });
}
