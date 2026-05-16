// src/app/api/expediente/[id]/documentos/[docId]/route.ts
// DELETE: elimina un documento del expediente. Solo staff del centro.
// Borra el registro en sgcc_documents Y el archivo del bucket.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";

const BUCKET = "sgcc-documents";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if ((session.user as any).userType !== "staff") {
    return NextResponse.json(
      { error: "Solo el personal del centro puede eliminar documentos" },
      { status: 403 }
    );
  }

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id: caseId, docId } = await params;

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
  let path = doc.storage_path as string | null;
  if (!path && doc.url) {
    const m = String(doc.url).match(/\/sgcc-documents\/(.+?)(\?|$)/);
    path = m ? decodeURIComponent(m[1]) : null;
  }
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
