// src/lib/partes/auth-guard.ts
// Guard de autenticación para rutas /api/partes/*.
// Valida que la sesión sea de userType "party" y carga su center_id desde BD
// (no vive en la sesión porque sgcc_parties.center_id se agregó en migración 020
// y las sesiones actuales tienen centerId=null).

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

interface GuardOk {
  userId: string;
  centerId: string | null;
  error?: never;
}
interface GuardFail {
  error: NextResponse;
  userId?: never;
  centerId?: never;
}

export async function requireParte(): Promise<GuardOk | GuardFail> {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  }
  const u = session.user as { id: string; userType?: string };
  if (u.userType !== "party") {
    return { error: NextResponse.json({ error: "Solo usuarios parte" }, { status: 403 }) };
  }

  const { data: parte } = await supabaseAdmin
    .from("sgcc_parties")
    .select("center_id")
    .eq("id", u.id)
    .maybeSingle();

  return { userId: u.id, centerId: parte?.center_id ?? null };
}
