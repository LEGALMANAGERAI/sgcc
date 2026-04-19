// src/app/api/partes/solicitudes/[id]/radicar/route.ts
// POST: valida el draft con los validators (Ley 2445/2025) y llama la RPC
// atómica radicar_solicitud. Si OK, devuelve {case_id, numero_radicado}.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireParte } from "@/lib/partes/auth-guard";
import {
  validarConciliacion,
  validarInsolvencia,
  type ValidationError,
} from "@/lib/solicitudes/validators";
import type {
  FormDataConciliacion,
  FormDataInsolvencia,
} from "@/types/solicitudes";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const guard = await requireParte();
  if ("error" in guard) return guard.error;

  // 1. Cargar draft
  const { data: draft, error: drErr } = await supabaseAdmin
    .from("sgcc_solicitudes_draft")
    .select("*")
    .eq("id", id)
    .eq("user_id", guard.userId)
    .maybeSingle();
  if (drErr) {
    return NextResponse.json({ error: drErr.message }, { status: 500 });
  }
  if (!draft) {
    return NextResponse.json({ error: "Draft no encontrado" }, { status: 404 });
  }

  // 2. Cargar adjuntos (para validación de anexos obligatorios)
  const { data: adjuntos } = await supabaseAdmin
    .from("sgcc_documents")
    .select("tipo_anexo")
    .eq("draft_id", id);

  // 3. Validar según tipo de trámite
  const fd = draft.form_data as Record<string, unknown>;
  let errors: ValidationError[];
  if (draft.tipo_tramite === "conciliacion") {
    errors = validarConciliacion(fd as Partial<FormDataConciliacion>);
  } else if (draft.tipo_tramite === "insolvencia") {
    errors = validarInsolvencia(
      fd as Partial<FormDataInsolvencia>,
      (adjuntos ?? []) as { tipo_anexo: string }[]
    );
  } else {
    return NextResponse.json(
      { error: "Trámite aún no soportado en esta versión" },
      { status: 501 }
    );
  }

  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 422 });
  }

  // 4. RPC atómica
  const { data: rpcOut, error: rpcErr } = await supabaseAdmin.rpc(
    "radicar_solicitud",
    { p_draft_id: id, p_user_id: guard.userId }
  );
  if (rpcErr) {
    return NextResponse.json({ error: rpcErr.message }, { status: 500 });
  }

  return NextResponse.json(rpcOut);
}
