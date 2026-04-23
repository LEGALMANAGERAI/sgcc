// src/app/api/partes/casos/[id]/propuesta-pago/[version]/route.ts
// PATCH: actualiza el snapshot_json y/o motivo_ajuste de una versión en estado
//        'borrador'. Body: { snapshot_json?, motivo_ajuste? }.
// DELETE: elimina una versión en estado 'borrador'.
//
// No se puede modificar ni borrar una versión en estado 'presentada' — para
// cambiarla hay que crear una versión nueva.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  puedeEditarPropuesta,
  requireParteDeCaso,
} from "@/lib/partes/caso-guard";

const MAX_SNAPSHOT_BYTES = 500 * 1024;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; version: string }> },
) {
  const { id, version } = await params;
  const v = Number(version);
  if (!Number.isFinite(v) || v <= 0) {
    return NextResponse.json({ error: "Versión inválida" }, { status: 400 });
  }

  const guard = await requireParteDeCaso(id);
  if ("error" in guard) return guard.error;
  if (!puedeEditarPropuesta(guard.caso.estado)) {
    return NextResponse.json(
      { error: `No se puede editar en estado '${guard.caso.estado}'` },
      { status: 409 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = {};

  if (body.snapshot_json !== undefined) {
    const size = new TextEncoder().encode(JSON.stringify(body.snapshot_json)).length;
    if (size > MAX_SNAPSHOT_BYTES) {
      return NextResponse.json(
        { error: "snapshot_json supera el límite de 500 kB" },
        { status: 413 },
      );
    }
    update.snapshot_json = body.snapshot_json;
  }
  if (typeof body.motivo_ajuste === "string") {
    update.motivo_ajuste = body.motivo_ajuste.slice(0, 1000);
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
  }

  const { error, count } = await supabaseAdmin
    .from("sgcc_case_payment_plan")
    .update(update, { count: "exact" })
    .eq("case_id", id)
    .eq("version", v)
    .eq("estado", "borrador");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!count) {
    return NextResponse.json(
      { error: "Versión no encontrada o ya presentada" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, filas_actualizadas: count });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; version: string }> },
) {
  const { id, version } = await params;
  const v = Number(version);
  if (!Number.isFinite(v) || v <= 0) {
    return NextResponse.json({ error: "Versión inválida" }, { status: 400 });
  }

  const guard = await requireParteDeCaso(id);
  if ("error" in guard) return guard.error;

  const { error, count } = await supabaseAdmin
    .from("sgcc_case_payment_plan")
    .delete({ count: "exact" })
    .eq("case_id", id)
    .eq("version", v)
    .eq("estado", "borrador");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!count) {
    return NextResponse.json(
      { error: "Borrador no encontrado (quizás ya fue presentado o no existe)" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
