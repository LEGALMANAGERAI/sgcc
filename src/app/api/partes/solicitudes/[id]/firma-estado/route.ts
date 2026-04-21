// GET /api/partes/solicitudes/[id]/firma-estado
// Devuelve el estado de la firma electrónica del PDF del draft. Si el firmante
// ya completó la firma, sincroniza `sgcc_solicitudes_draft` con la URL del PDF
// firmado y la fecha de firma. Es seguro llamarlo repetidamente desde el cliente.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireParte } from "@/lib/partes/auth-guard";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const guard = await requireParte();
  if ("error" in guard) return guard.error;

  const { data: draft } = await supabaseAdmin
    .from("sgcc_solicitudes_draft")
    .select(
      "id, user_id, solicitud_pdf_url, solicitud_pdf_hash, solicitud_pdf_firmado_url, solicitud_firma_documento_id, solicitud_firmada_at"
    )
    .eq("id", id)
    .eq("user_id", guard.userId)
    .maybeSingle();
  if (!draft) {
    return NextResponse.json({ error: "Draft no encontrado" }, { status: 404 });
  }

  if (!draft.solicitud_firma_documento_id) {
    return NextResponse.json({
      estado: "no_iniciada",
      pdf_url: null,
      firmado_url: null,
      firmada_at: null,
    });
  }

  const { data: documento } = await supabaseAdmin
    .from("sgcc_firma_documentos")
    .select("id, estado, archivo_url, archivo_firmado_url")
    .eq("id", draft.solicitud_firma_documento_id)
    .maybeSingle();

  const { data: firmante } = await supabaseAdmin
    .from("sgcc_firmantes")
    .select("id, estado, token, firmado_at")
    .eq("firma_documento_id", draft.solicitud_firma_documento_id)
    .eq("orden", 1)
    .maybeSingle();

  // Sincronizar draft con la firma si el firmante completó y aún no estaba guardado.
  if (
    firmante?.estado === "firmado" &&
    documento?.archivo_firmado_url &&
    (!draft.solicitud_pdf_firmado_url ||
      draft.solicitud_pdf_firmado_url !== documento.archivo_firmado_url)
  ) {
    await supabaseAdmin
      .from("sgcc_solicitudes_draft")
      .update({
        solicitud_pdf_firmado_url: documento.archivo_firmado_url,
        solicitud_firmada_at: firmante.firmado_at ?? new Date().toISOString(),
      })
      .eq("id", draft.id);
    draft.solicitud_pdf_firmado_url = documento.archivo_firmado_url;
    draft.solicitud_firmada_at = firmante.firmado_at ?? new Date().toISOString();
  }

  return NextResponse.json({
    estado: firmante?.estado ?? documento?.estado ?? "pendiente",
    pdf_url: draft.solicitud_pdf_url ?? documento?.archivo_url ?? null,
    firmado_url: draft.solicitud_pdf_firmado_url ?? documento?.archivo_firmado_url ?? null,
    firmada_at: draft.solicitud_firmada_at ?? firmante?.firmado_at ?? null,
    firmante_token: firmante?.token ?? null,
  });
}
