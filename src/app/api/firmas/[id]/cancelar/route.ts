import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { randomUUID } from "crypto";

/**
 * POST /api/firmas/[id]/cancelar
 * Cancelar un documento de firma. Cambia estado a "cancelado" y notifica.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id } = await params;
  const userId = (session.user as any)?.id;

  // Verificar documento
  const { data: documento } = await supabaseAdmin
    .from("sgcc_firma_documentos")
    .select("id, estado, nombre")
    .eq("id", id)
    .eq("center_id", centerId)
    .single();

  if (!documento) {
    return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  }

  const noPermitidos = ["completado", "cancelado"];
  if (noPermitidos.includes(documento.estado)) {
    return NextResponse.json(
      { error: `No se puede cancelar un documento en estado "${documento.estado}"` },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const motivo = body.motivo ?? "Cancelado por el operador";
  const now = new Date().toISOString();

  // Actualizar estado del documento
  await supabaseAdmin
    .from("sgcc_firma_documentos")
    .update({ estado: "cancelado", updated_at: now })
    .eq("id", id);

  // Actualizar firmantes pendientes a cancelado
  await supabaseAdmin
    .from("sgcc_firmantes")
    .update({ estado: "cancelado", updated_at: now })
    .eq("firma_documento_id", id)
    .in("estado", ["pendiente", "enviado", "visto"]);

  // Registrar en audit trail
  await supabaseAdmin.from("sgcc_firma_registros").insert({
    id: randomUUID(),
    firma_documento_id: id,
    firmante_id: null,
    accion: "cancelado",
    ip: req.headers.get("x-forwarded-for") || "unknown",
    user_agent: req.headers.get("user-agent") || "unknown",
    metadatos: { cancelado_por: userId, motivo },
    created_at: now,
  });

  return NextResponse.json({ ok: true, estado: "cancelado" });
}
