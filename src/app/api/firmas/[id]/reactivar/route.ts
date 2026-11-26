import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { lmConfigured, lmReactivarSolicitud, LmApiError } from "@/lib/firma/lm-client";

/**
 * POST /api/firmas/[id]/reactivar
 * Da nuevo plazo a una firma de Legal Manager vencida (conserva firmas hechas).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id } = await params;
  const userId = (session.user as any)?.id;

  const body = (await req.json().catch(() => null)) ?? {};
  const dias_expiracion = body.dias_expiracion;
  if (
    dias_expiracion !== undefined &&
    (!Number.isInteger(dias_expiracion) || dias_expiracion < 1 || dias_expiracion > 90)
  ) {
    return NextResponse.json({ error: "dias_expiracion debe ser un entero entre 1 y 90" }, { status: 422 });
  }

  const { data: documento } = await supabaseAdmin
    .from("sgcc_firma_documentos")
    .select("id, estado, proveedor, lm_solicitud_id, firmantes_completados")
    .eq("id", id)
    .eq("center_id", centerId)
    .single();
  if (!documento) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });

  if (documento.proveedor !== "lm" || !documento.lm_solicitud_id) {
    return NextResponse.json({ error: "Solo disponible para firmas de Legal Manager" }, { status: 400 });
  }
  if (documento.estado === "cancelado") {
    return NextResponse.json({ error: "Una firma cancelada no se puede reactivar" }, { status: 409 });
  }
  if (documento.estado !== "expirado") {
    return NextResponse.json({ error: "Solo se puede reactivar una firma expirada" }, { status: 409 });
  }

  if (!lmConfigured()) {
    return NextResponse.json(
      { error: "La firma con Legal Manager no está configurada (faltan credenciales del partner)." },
      { status: 502 },
    );
  }

  let r: Awaited<ReturnType<typeof lmReactivarSolicitud>>;
  try {
    r = await lmReactivarSolicitud(documento.lm_solicitud_id, dias_expiracion);
  } catch (err: any) {
    if (err instanceof LmApiError && (err.status === 409 || err.status === 422)) {
      return NextResponse.json({ error: err.message || "No se pudo reactivar" }, { status: err.status });
    }
    console.error("Error reactivando en Legal Manager:", err?.message);
    return NextResponse.json(
      { error: `No se pudo reactivar en Legal Manager: ${err?.message ?? "error desconocido"}` },
      { status: 502 },
    );
  }

  const now = new Date().toISOString();
  const estado = (documento.firmantes_completados ?? 0) > 0 ? "en_proceso" : "enviado";

  const { error: docErr } = await supabaseAdmin
    .from("sgcc_firma_documentos")
    .update({ estado, fecha_expiracion: r.fecha_expiracion, updated_at: now })
    .eq("id", id);
  if (docErr) {
    console.error("Error guardando reactivación local:", docErr.message);
    return NextResponse.json(
      { error: "Se reactivó en Legal Manager pero falló el guardado local. Use Sincronizar." },
      { status: 500 },
    );
  }

  // sgcc_firmantes NO tiene updated_at. No fatal si falla.
  const { error: firmErr } = await supabaseAdmin
    .from("sgcc_firmantes")
    .update({ estado: "enviado" })
    .eq("firma_documento_id", id)
    .eq("estado", "expirado");
  if (firmErr) console.error("Error reactivando firmantes:", firmErr.message);

  await supabaseAdmin.from("sgcc_firma_registros").insert({
    id: randomUUID(),
    firma_documento_id: id,
    firmante_id: null,
    accion: "reactivado",
    ip: req.headers.get("x-forwarded-for") || "unknown",
    user_agent: req.headers.get("user-agent") || "unknown",
    metadatos: {
      proveedor: "lm",
      reactivado_por: userId,
      fecha_expiracion: r.fecha_expiracion,
      firmas_conservadas: r.firmas_conservadas,
    },
    created_at: now,
  });

  return NextResponse.json({
    ok: true,
    estado,
    fecha_expiracion: r.fecha_expiracion,
    firmas_conservadas: r.firmas_conservadas,
  });
}
