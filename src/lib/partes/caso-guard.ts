// src/lib/partes/caso-guard.ts
// Guard específico para operar sobre un caso desde el portal de partes.
// Valida que el usuario autenticado sea una "party" y que sea el deudor
// (created_by_party) del caso. Devuelve también el registro del caso.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireParte } from "./auth-guard";

export interface CasoGuardOk {
  userId: string;
  caso: {
    id: string;
    estado: string;
    created_by_party: string | null;
    conciliador_id: string | null;
    center_id: string;
  };
  error?: never;
}
export interface CasoGuardFail {
  error: NextResponse;
  userId?: never;
  caso?: never;
}

export async function requireParteDeCaso(
  casoId: string,
): Promise<CasoGuardOk | CasoGuardFail> {
  const guard = await requireParte();
  if ("error" in guard && guard.error) return { error: guard.error };
  if (!("userId" in guard) || !guard.userId) {
    return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  }

  const { data: caso, error } = await supabaseAdmin
    .from("sgcc_cases")
    .select("id, estado, created_by_party, conciliador_id, center_id")
    .eq("id", casoId)
    .maybeSingle();

  if (error) {
    return { error: NextResponse.json({ error: error.message }, { status: 500 }) };
  }
  if (!caso) {
    return { error: NextResponse.json({ error: "Caso no encontrado" }, { status: 404 }) };
  }
  if (caso.created_by_party !== guard.userId) {
    return { error: NextResponse.json({ error: "No eres parte de este caso" }, { status: 403 }) };
  }

  return { userId: guard.userId, caso };
}

export const ESTADOS_EDITABLES_PROPUESTA = ["admitido", "citado"] as const;

export function puedeEditarPropuesta(estado: string): boolean {
  return (ESTADOS_EDITABLES_PROPUESTA as readonly string[]).includes(estado);
}
