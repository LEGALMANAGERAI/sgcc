import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

type Params = { params: Promise<{ token: string }> };

/**
 * GET /api/firmar/[token]
 * PÚBLICA - Validar token y retornar datos del documento + firmante.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const { token } = await params;

  // Buscar firmante por token
  const { data: firmante, error } = await supabaseAdmin
    .from("sgcc_firmantes")
    .select(`
      id, nombre, cedula, email, estado, visto_at, firmado_at, motivo_rechazo, orden,
      documento:sgcc_firma_documentos(
        id, nombre, descripcion, archivo_url, estado, fecha_expiracion, orden_secuencial
      )
    `)
    .eq("token", token)
    .single();

  if (error || !firmante) {
    return NextResponse.json({ error: "Token inválido o no encontrado" }, { status: 404 });
  }

  const documento = firmante.documento as any;

  // Verificar que no esté firmado
  if (firmante.estado === "firmado") {
    return NextResponse.json({ error: "Este documento ya fue firmado" }, { status: 400 });
  }

  // Verificar que no esté rechazado
  if (firmante.estado === "rechazado") {
    return NextResponse.json({ error: "Este documento fue rechazado" }, { status: 400 });
  }

  // Verificar expiración
  if (documento?.fecha_expiracion && new Date(documento.fecha_expiracion) < new Date()) {
    return NextResponse.json({ error: "Este documento ha expirado" }, { status: 400 });
  }

  // Actualizar visto_at si es primera vez
  if (!firmante.visto_at) {
    await supabaseAdmin
      .from("sgcc_firmantes")
      .update({ estado: "visto", visto_at: new Date().toISOString() })
      .eq("id", firmante.id);

    // Registrar en audit trail
    await supabaseAdmin.from("sgcc_firma_registros").insert({
      firma_documento_id: documento.id,
      firmante_id: firmante.id,
      accion: "visto",
      ip: req.headers.get("x-forwarded-for") || "unknown",
      user_agent: req.headers.get("user-agent") || "unknown",
    });
  }

  return NextResponse.json({
    documento: {
      id: documento.id,
      nombre: documento.nombre,
      descripcion: documento.descripcion,
      archivo_url: documento.archivo_url,
    },
    firmante: {
      id: firmante.id,
      nombre: firmante.nombre,
      estado: firmante.visto_at ? firmante.estado : "visto",
    },
  });
}
