// src/app/api/partes/solicitudes/[id]/adjuntos/[docId]/route.ts
// DELETE: elimina un adjunto del draft (verifica ownership vía JOIN al draft).

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, deleteFile } from "@/lib/supabase";
import { requireParte } from "@/lib/partes/auth-guard";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { id: draftId, docId } = await params;
  const guard = await requireParte();
  if ("error" in guard) return guard.error;

  // Ownership: el doc debe pertenecer a un draft del usuario
  const { data: doc } = await supabaseAdmin
    .from("sgcc_documents")
    .select("id, url, draft_id, draft:sgcc_solicitudes_draft!inner(user_id)")
    .eq("id", docId)
    .eq("draft_id", draftId)
    .maybeSingle();

  const draftUserId = (doc as { draft?: { user_id?: string } } | null)?.draft?.user_id;
  if (!doc || draftUserId !== guard.userId) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  // Extraer path del URL público: ".../documentos/<path>"
  const marker = "/documentos/";
  const idx = (doc as { url: string }).url.indexOf(marker);
  if (idx !== -1) {
    const path = (doc as { url: string }).url.slice(idx + marker.length);
    try {
      await deleteFile("documentos", path);
    } catch (e) {
      console.error("[adjuntos DELETE] falló delete en Storage:", e);
      // Seguimos con el borrado del registro de todos modos
    }
  }

  await supabaseAdmin.from("sgcc_documents").delete().eq("id", docId);
  return NextResponse.json({ ok: true });
}
