import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import {
  isTempPoderPath,
  movePoderToFinal,
  verifyPoderIsPdf,
  deletePoder,
  createSignedDownloadUrl,
  PODERES_BUCKET,
} from "@/lib/poderes-storage";

/**
 * POST /api/apoderados-poder/[caseAttorneyId]
 *
 * Asocia (o reemplaza) el PDF del poder de un case_attorney existente.
 * El PDF debe haberse subido previamente via signed URL al path tmp/<uuid>.pdf;
 * aqui se mueve al path final y se actualiza poder_url en BD.
 *
 * Body JSON: { tmp_poder_path: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ caseAttorneyId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro asignado" }, { status: 400 });

  const { caseAttorneyId } = await params;

  const { data: ca } = await supabaseAdmin
    .from("sgcc_case_attorneys")
    .select(`id, case_id, poder_url, caso:sgcc_cases!inner(center_id)`)
    .eq("id", caseAttorneyId)
    .maybeSingle();

  if (!ca || (ca.caso as any)?.center_id !== centerId) {
    return NextResponse.json({ error: "Apoderado no encontrado" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const { tmp_poder_path } = body ?? {};

  if (!tmp_poder_path || !isTempPoderPath(tmp_poder_path)) {
    return NextResponse.json({ error: "tmp_poder_path requerido" }, { status: 400 });
  }

  const isPdf = await verifyPoderIsPdf(tmp_poder_path);
  if (!isPdf) {
    await deletePoder(tmp_poder_path);
    return NextResponse.json(
      { error: "El archivo no es un PDF valido (firma magica incorrecta)." },
      { status: 400 },
    );
  }

  // Si ya habia un poder anterior, eliminarlo del bucket antes de subir el nuevo.
  if (ca.poder_url) {
    await deletePoder(ca.poder_url);
  }

  const moveResult = await movePoderToFinal(tmp_poder_path, ca.case_id, caseAttorneyId);
  if ("error" in moveResult) {
    await deletePoder(tmp_poder_path);
    return NextResponse.json({ error: moveResult.error }, { status: 500 });
  }

  const { error: updateError } = await supabaseAdmin
    .from("sgcc_case_attorneys")
    .update({ poder_url: moveResult.path })
    .eq("id", caseAttorneyId);

  if (updateError) {
    console.error("[apoderados-poder] update error:", updateError);
    await deletePoder(moveResult.path);
    return NextResponse.json(
      { error: `Error al actualizar el registro: ${updateError.message}` },
      { status: 500 }
    );
  }

  const signedUrl = await createSignedDownloadUrl(moveResult.path);
  return NextResponse.json({ ok: true, poder_url: signedUrl });
}

/**
 * DELETE /api/apoderados-poder/[caseAttorneyId]
 *
 * Elimina el PDF del bucket "poderes" y limpia poder_url en
 * sgcc_case_attorneys. No borra el case_attorney en sí — solo el archivo.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ caseAttorneyId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro asignado" }, { status: 400 });

  const { caseAttorneyId } = await params;

  const { data: ca } = await supabaseAdmin
    .from("sgcc_case_attorneys")
    .select(`id, case_id, poder_url, caso:sgcc_cases!inner(center_id)`)
    .eq("id", caseAttorneyId)
    .maybeSingle();

  if (!ca || (ca.caso as any)?.center_id !== centerId) {
    return NextResponse.json({ error: "Apoderado no encontrado" }, { status: 404 });
  }

  // Borra el archivo del bucket. No fallar si el archivo no existe.
  if (ca.poder_url) {
    await deletePoder(ca.poder_url);
  }

  const { error: updateError } = await supabaseAdmin
    .from("sgcc_case_attorneys")
    .update({ poder_url: null })
    .eq("id", caseAttorneyId);

  if (updateError) {
    console.error("[apoderados-poder] update error:", updateError);
    return NextResponse.json(
      { error: `Error al limpiar el registro: ${updateError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
