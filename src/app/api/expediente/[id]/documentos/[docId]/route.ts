// src/app/api/expediente/[id]/documentos/[docId]/route.ts
// DELETE: elimina un documento del expediente. Solo staff del centro.
// Borra el registro en sgcc_documents Y el archivo del bucket.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { guardCasoStaff } from "@/lib/server-utils";
import { DOCS_BUCKET as BUCKET, pathDeArchivo } from "@/lib/archivos-ref";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { id: caseId, docId } = await params;
  const session = await auth();
  const g = await guardCasoStaff(session, caseId);
  if ("error" in g) return g.error;
  const { centerId } = g;

  // Verificar que el documento pertenece a un caso del centro
  const { data: doc } = await supabaseAdmin
    .from("sgcc_documents")
    .select("id, case_id, center_id, storage_path, url")
    .eq("id", docId)
    .eq("case_id", caseId)
    .eq("center_id", centerId)
    .maybeSingle();

  if (!doc) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });

  // Borrar archivo del bucket. Path preferido: storage_path; fallback: extraer del URL.
  const path = pathDeArchivo(doc.storage_path) ?? pathDeArchivo(doc.url);
  if (path) {
    await supabaseAdmin.storage.from(BUCKET).remove([path]).catch(() => {});
  }

  // Borrar el registro
  const { error: delErr } = await supabaseAdmin
    .from("sgcc_documents")
    .delete()
    .eq("id", docId)
    .eq("case_id", caseId)
    .eq("center_id", centerId);

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
