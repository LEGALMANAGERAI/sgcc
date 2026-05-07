import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";

/**
 * POST /api/apoderados-poder/[caseAttorneyId]
 *
 * Sube (o reemplaza) el PDF del poder asociado a un case_attorney existente.
 * Útil cuando el upload original falló silenciosamente y la columna
 * `poder_url` quedó NULL — permite reparar la data desde la lista de
 * apoderados sin tener que crear un nuevo case_attorney como sustitución.
 *
 * Body: multipart/form-data con campo `poderFile` (PDF).
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

  // Validar que el case_attorney pertenezca al centro (vía caso)
  const { data: ca } = await supabaseAdmin
    .from("sgcc_case_attorneys")
    .select(`id, case_id, caso:sgcc_cases!inner(center_id)`)
    .eq("id", caseAttorneyId)
    .maybeSingle();

  if (!ca || (ca.caso as any)?.center_id !== centerId) {
    return NextResponse.json({ error: "Apoderado no encontrado" }, { status: 404 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Se requiere multipart/form-data" }, { status: 400 });
  }

  const formData = await req.formData();
  const poderFile = formData.get("poderFile") as File | null;

  if (!poderFile || poderFile.size === 0) {
    return NextResponse.json({ error: "Archivo PDF requerido" }, { status: 400 });
  }
  if (poderFile.type !== "application/pdf") {
    return NextResponse.json({ error: "El archivo debe ser PDF" }, { status: 400 });
  }
  if (poderFile.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "El archivo no puede superar 10 MB" }, { status: 400 });
  }

  const buffer = Buffer.from(await poderFile.arrayBuffer());
  const filePath = `${ca.case_id}/${caseAttorneyId}.pdf`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from("poderes")
    .upload(filePath, buffer, { contentType: "application/pdf", upsert: true });

  if (uploadError) {
    console.error("[apoderados-poder] upload error:", uploadError);
    return NextResponse.json(
      { error: `Error al subir el PDF: ${uploadError.message}` },
      { status: 500 }
    );
  }

  const { data: urlData } = supabaseAdmin.storage.from("poderes").getPublicUrl(filePath);

  // sgcc_case_attorneys no tiene columna updated_at (solo created_at).
  const { error: updateError } = await supabaseAdmin
    .from("sgcc_case_attorneys")
    .update({ poder_url: urlData.publicUrl })
    .eq("id", caseAttorneyId);

  if (updateError) {
    console.error("[apoderados-poder] update error:", updateError);
    return NextResponse.json(
      { error: `Error al actualizar el registro: ${updateError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, poder_url: urlData.publicUrl });
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

  const filePath = `${ca.case_id}/${caseAttorneyId}.pdf`;
  // Borra el archivo del bucket. No fallar si el archivo no existe.
  const { error: removeError } = await supabaseAdmin.storage.from("poderes").remove([filePath]);
  if (removeError) {
    console.error("[apoderados-poder] remove error:", removeError);
    // Continuamos: aunque el storage falle, queremos limpiar la columna
    // para que la UI no apunte a un archivo inválido.
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
