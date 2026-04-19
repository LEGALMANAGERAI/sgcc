// src/app/api/partes/solicitudes/[id]/route.ts
// GET: lee draft + adjuntos asociados.
// PATCH: actualiza form_data / step_actual / completado_pct del draft.
// DELETE: elimina draft (y sus adjuntos por cascade).

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireParte } from "@/lib/partes/auth-guard";

const MAX_FORM_DATA_BYTES = 500 * 1024; // 500 kB

async function fetchOwnedDraft(id: string, userId: string) {
  return supabaseAdmin
    .from("sgcc_solicitudes_draft")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const guard = await requireParte();
  if ("error" in guard) return guard.error;

  const { data, error } = await fetchOwnedDraft(id, guard.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const { data: adjuntos } = await supabaseAdmin
    .from("sgcc_documents")
    .select("id, tipo_anexo, nombre_archivo, tamano_bytes, url, created_at")
    .eq("draft_id", id);

  return NextResponse.json({ draft: data, adjuntos: adjuntos ?? [] });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const guard = await requireParte();
  if ("error" in guard) return guard.error;

  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = {};

  if (body.form_data !== undefined) {
    const size = new TextEncoder().encode(JSON.stringify(body.form_data)).length;
    if (size > MAX_FORM_DATA_BYTES) {
      return NextResponse.json(
        { error: "form_data supera el límite de 500 kB" },
        { status: 413 }
      );
    }
    update.form_data = body.form_data;
  }
  if (body.step_actual !== undefined) update.step_actual = body.step_actual;
  if (body.completado_pct !== undefined) update.completado_pct = body.completado_pct;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("sgcc_solicitudes_draft")
    .update(update)
    .eq("id", id)
    .eq("user_id", guard.userId)
    .select("updated_at")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true, updated_at: data.updated_at });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const guard = await requireParte();
  if ("error" in guard) return guard.error;

  const { error } = await supabaseAdmin
    .from("sgcc_solicitudes_draft")
    .delete()
    .eq("id", id)
    .eq("user_id", guard.userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
