// src/app/api/partes/solicitudes/[id]/adjuntos/route.ts
// POST: sube un adjunto al draft. Valida tipo/tamaño, guarda en Storage,
// registra en sgcc_documents con is_draft=true + draft_id.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, uploadFile } from "@/lib/supabase";
import { requireParte } from "@/lib/partes/auth-guard";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const TIPOS_VALIDOS = new Set([
  "cedula",
  "redam",
  "poder",
  "tradicion",
  "soporte_acreencia",
  "ingresos_contador",
  "matricula_mercantil",
  "certif_laboral",
  "certif_pension",
  "declaracion_independiente",
  "liquidacion_sociedad_conyugal",
  "documento_bien",
  "otro",
]);
const MIME_PERMITIDOS = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: draftId } = await params;
  const guard = await requireParte();
  if ("error" in guard) return guard.error;

  // Verificar ownership del draft
  const { data: draft } = await supabaseAdmin
    .from("sgcc_solicitudes_draft")
    .select("id")
    .eq("id", draftId)
    .eq("user_id", guard.userId)
    .maybeSingle();
  if (!draft) {
    return NextResponse.json({ error: "Draft no encontrado" }, { status: 404 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const tipoAnexo = String(form.get("tipo_anexo") ?? "otro");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  }
  if (!TIPOS_VALIDOS.has(tipoAnexo)) {
    return NextResponse.json({ error: "tipo_anexo inválido" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Archivo excede 10 MB" }, { status: 413 });
  }
  if (!MIME_PERMITIDOS.has(file.type)) {
    return NextResponse.json(
      { error: "Tipo de archivo no permitido (pdf, jpg, png, docx)" },
      { status: 415 }
    );
  }

  // Sanitizar nombre
  const safeName = file.name.replace(/[^\w.\-]/g, "_");
  const path = `solicitudes-draft/${guard.userId}/${draftId}/${Date.now()}-${safeName}`;

  let publicUrl: string;
  try {
    publicUrl = await uploadFile(file, "documentos", path, file.type);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error subiendo archivo" },
      { status: 500 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("sgcc_documents")
    .insert({
      draft_id: draftId,
      is_draft: true,
      tipo_anexo: tipoAnexo,
      nombre_archivo: file.name,
      tamano_bytes: file.size,
      mime_type: file.type,
      url: publicUrl,
      subido_por_party: guard.userId,
    })
    .select("id, url, nombre_archivo, tamano_bytes, tipo_anexo, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ adjunto: data }, { status: 201 });
}
