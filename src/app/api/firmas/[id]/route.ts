import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/firmas/[id]
 * Detalle del documento con firmantes y registros. Auth required.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id } = await params;

  const { data: documento, error } = await supabaseAdmin
    .from("sgcc_firma_documentos")
    .select(`
      *,
      firmantes:sgcc_firmantes(
        id, nombre, cedula, email, telefono, orden, estado,
        visto_at, firmado_at, enviado_at, motivo_rechazo, created_at
      ),
      registros:sgcc_firma_registros(
        id, firmante_id, accion, ip, user_agent, metadatos, created_at
      )
    `)
    .eq("id", id)
    .eq("center_id", centerId)
    .single();

  if (error || !documento) {
    return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  }

  return NextResponse.json(documento);
}

/**
 * DELETE /api/firmas/[id]
 * Eliminar documento (solo si estado=pendiente). Auth required.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id } = await params;

  // Verificar que el documento existe y está en estado pendiente
  const { data: documento } = await supabaseAdmin
    .from("sgcc_firma_documentos")
    .select("id, estado")
    .eq("id", id)
    .eq("center_id", centerId)
    .single();

  if (!documento) {
    return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  }

  if (documento.estado !== "pendiente") {
    return NextResponse.json(
      { error: "Solo se pueden eliminar documentos en estado pendiente" },
      { status: 400 }
    );
  }

  // Eliminar registros
  await supabaseAdmin
    .from("sgcc_firma_registros")
    .delete()
    .eq("firma_documento_id", id);

  // Eliminar OTPs de los firmantes
  const { data: firmantes } = await supabaseAdmin
    .from("sgcc_firmantes")
    .select("id")
    .eq("firma_documento_id", id);

  if (firmantes?.length) {
    const firmanteIds = firmantes.map((f: any) => f.id);
    await supabaseAdmin
      .from("sgcc_firma_otp")
      .delete()
      .in("firmante_id", firmanteIds);
  }

  // Eliminar firmantes
  await supabaseAdmin
    .from("sgcc_firmantes")
    .delete()
    .eq("firma_documento_id", id);

  // Eliminar documento
  const { error } = await supabaseAdmin
    .from("sgcc_firma_documentos")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
