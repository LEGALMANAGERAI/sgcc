// src/app/api/plantillas/archivos/[id]/route.ts
// DELETE: borra un archivo de plantilla. Solo admin del centro.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";

const BUCKET = "sgcc-documents";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if ((session.user as any).sgccRol !== "admin") {
    return NextResponse.json(
      { error: "Solo el admin puede eliminar archivos de plantilla" },
      { status: 403 }
    );
  }

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id } = await params;

  const { data: archivo } = await supabaseAdmin
    .from("sgcc_template_files")
    .select("id, storage_path")
    .eq("id", id)
    .eq("center_id", centerId)
    .maybeSingle();

  if (!archivo) return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });

  if (archivo.storage_path) {
    await supabaseAdmin.storage.from(BUCKET).remove([archivo.storage_path]).catch(() => {});
  }

  const { error } = await supabaseAdmin
    .from("sgcc_template_files")
    .delete()
    .eq("id", id)
    .eq("center_id", centerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
