import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isSuperAdminEmail, superAdminAllowlistSize } from "@/lib/superadmin";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/whoami
 *
 * Diagnostico para entender por que /admin redirige. Requiere sesion pero
 * NO requiere ser SuperAdmin — su proposito es justamente revelar si la
 * sesion califica o no. No expone datos sensibles: solo el email propio
 * (que el usuario ya conoce) y si la env var tiene correos cargados.
 */
export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Sin sesion" }, { status: 401 });
  }

  const email = (session.user as { email?: string | null } | undefined)?.email ?? null;
  const userType = (session.user as { userType?: string } | undefined)?.userType ?? null;

  return NextResponse.json({
    session_email: email,
    user_type: userType,
    superadmin_env_set: !!process.env.SUPERADMIN_EMAILS,
    superadmin_env_count: superAdminAllowlistSize(),
    is_superadmin: isSuperAdminEmail(email),
  });
}
