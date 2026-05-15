// src/app/api/configuracion/reglamento/route.ts
// POST: sube/reemplaza el reglamento interno del centro (PDF, admin only).
// DELETE: elimina el reglamento vigente.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin, uploadFile } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { randomUUID } from "crypto";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const BUCKET = "sgcc-documents";

async function deleteExistingReglamento(reglamentoUrl: string | null): Promise<void> {
  if (!reglamentoUrl) return;
  // Si el url ya es path relativo lo usamos directo. Si es URL pública vieja,
  // extraemos el path con regex.
  const m = reglamentoUrl.match(/\/sgcc-documents\/(.+)$/);
  const path = m ? m[1] : reglamentoUrl;
  await supabaseAdmin.storage.from(BUCKET).remove([path]).catch(() => {});
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if ((session.user as any).sgccRol !== "admin") {
    return NextResponse.json(
      { error: "Solo el admin puede subir el reglamento" },
      { status: 403 }
    );
  }
  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "El archivo excede 10 MB" }, { status: 413 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Solo se permite PDF" }, { status: 415 });
  }

  // Borrar reglamento anterior si existía
  const { data: center } = await supabaseAdmin
    .from("sgcc_centers")
    .select("reglamento_url")
    .eq("id", centerId)
    .single();
  await deleteExistingReglamento(center?.reglamento_url ?? null);

  // Subir nuevo
  const storagePath = `reglamentos/${centerId}/${randomUUID()}.pdf`;
  let url: string;
  try {
    url = await uploadFile(file, BUCKET, storagePath, "application/pdf");
  } catch (e: any) {
    return NextResponse.json(
      { error: `Error subiendo: ${e?.message ?? "desconocido"}` },
      { status: 500 }
    );
  }

  const { error: updErr } = await supabaseAdmin
    .from("sgcc_centers")
    .update({
      reglamento_url: url,
      reglamento_nombre: file.name,
      reglamento_subido_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", centerId);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    reglamento_url: url,
    reglamento_nombre: file.name,
  });
}

export async function DELETE() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if ((session.user as any).sgccRol !== "admin") {
    return NextResponse.json({ error: "Solo el admin puede eliminar" }, { status: 403 });
  }
  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { data: center } = await supabaseAdmin
    .from("sgcc_centers")
    .select("reglamento_url")
    .eq("id", centerId)
    .single();

  await deleteExistingReglamento(center?.reglamento_url ?? null);

  const { error: updErr } = await supabaseAdmin
    .from("sgcc_centers")
    .update({
      reglamento_url: null,
      reglamento_nombre: null,
      reglamento_subido_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", centerId);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
