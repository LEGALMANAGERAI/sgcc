// src/app/api/partes/solicitudes/route.ts
// GET: lista drafts del usuario parte.
// POST: crea un draft nuevo para un tipo de trámite.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireParte } from "@/lib/partes/auth-guard";
import type { TipoTramite } from "@/types";

const TIPOS_VALIDOS: TipoTramite[] = [
  "conciliacion",
  "insolvencia",
  "acuerdo_apoyo",
  "directiva_anticipada",
];

export async function GET() {
  const guard = await requireParte();
  if ("error" in guard) return guard.error;

  const { data, error } = await supabaseAdmin
    .from("sgcc_solicitudes_draft")
    .select("id, tipo_tramite, step_actual, completado_pct, created_at, updated_at")
    .eq("user_id", guard.userId)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ drafts: data ?? [] });
}

export async function POST(req: NextRequest) {
  const guard = await requireParte();
  if ("error" in guard) return guard.error;
  if (!guard.centerId) {
    return NextResponse.json(
      { error: "Tu cuenta no está asociada a un centro. Regístrate con el código del centro." },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const tipo = body.tipo_tramite as TipoTramite;
  if (!TIPOS_VALIDOS.includes(tipo)) {
    return NextResponse.json({ error: "tipo_tramite inválido" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("sgcc_solicitudes_draft")
    .insert({
      user_id: guard.userId,
      center_id: guard.centerId,
      tipo_tramite: tipo,
      form_data: {},
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
