import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { randomUUID } from "crypto";
import { lmConfigured, lmCancelarSolicitud, LmApiError } from "@/lib/firma/lm-client";

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
    .select("id, estado, nombre, proveedor, lm_solicitud_id")
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

  // Documentos de Legal Manager: cancelar primero allá; si falla, no tocar nada
  // local (evita estados divergentes).
  let lmMeta: { ya_cancelada: boolean } | undefined;
  if (documento.proveedor === "lm" && documento.lm_solicitud_id) {
    if (!lmConfigured()) {
      return NextResponse.json(
        { error: "La firma con Legal Manager no está configurada (faltan credenciales del partner)." },
        { status: 502 },
      );
    }
    try {
      const r = await lmCancelarSolicitud(documento.lm_solicitud_id, motivo);
      lmMeta = { ya_cancelada: !!r.ya_cancelada };
    } catch (err: any) {
      if (err instanceof LmApiError && err.status === 409) {
        return NextResponse.json(
          {
            error:
              "Legal Manager no permite cancelar: el documento ya fue firmado o venció. Use Sincronizar para ver el estado real.",
          },
          { status: 409 },
        );
      }
      console.error("Error cancelando en Legal Manager:", err?.message);
      return NextResponse.json(
        { error: `No se pudo cancelar en Legal Manager: ${err?.message ?? "error desconocido"}` },
        { status: 502 },
      );
    }
  }

  // Actualizar estado del documento. Si esto falla, abortamos y reportamos el
  // error (antes se ignoraba y se devolvía ok aunque no se guardara nada).
  const { error: docErr } = await supabaseAdmin
    .from("sgcc_firma_documentos")
    .update({ estado: "cancelado", updated_at: now })
    .eq("id", id);

  if (docErr) {
    return NextResponse.json(
      { error: `No se pudo cancelar el documento: ${docErr.message}` },
      { status: 500 },
    );
  }

  // Actualizar firmantes pendientes a cancelado.
  // OJO: sgcc_firmantes NO tiene columna updated_at — no la incluyas o el
  // UPDATE falla. Si esto falla no es fatal (el documento ya quedó cancelado),
  // pero lo logueamos.
  const { error: firmErr } = await supabaseAdmin
    .from("sgcc_firmantes")
    .update({ estado: "cancelado" })
    .eq("firma_documento_id", id)
    .in("estado", ["pendiente", "enviado", "visto"]);

  if (firmErr) {
    console.error("Error cancelando firmantes:", firmErr.message);
  }

  // Registrar en audit trail
  await supabaseAdmin.from("sgcc_firma_registros").insert({
    id: randomUUID(),
    firma_documento_id: id,
    firmante_id: null,
    accion: "cancelado",
    ip: req.headers.get("x-forwarded-for") || "unknown",
    user_agent: req.headers.get("user-agent") || "unknown",
    metadatos: { cancelado_por: userId, motivo, ...(lmMeta ? { lm: lmMeta } : {}) },
    created_at: now,
  });

  return NextResponse.json({ ok: true, estado: "cancelado" });
}
