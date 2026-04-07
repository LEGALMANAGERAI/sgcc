import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

type Params = { params: Promise<{ token: string }> };

/**
 * POST /api/firmar/[token]/rechazar
 * PÚBLICA - Rechazar firma. Body: { motivo: "..." }
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params;
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  // Obtener firmante por token
  const { data: firmante } = await supabaseAdmin
    .from("sgcc_firmantes")
    .select(`
      id, nombre, estado, firma_documento_id,
      documento:sgcc_firma_documentos(id, estado, total_firmantes)
    `)
    .eq("token", token)
    .single();

  if (!firmante) {
    return NextResponse.json({ error: "Token inválido" }, { status: 404 });
  }

  if (firmante.estado === "firmado") {
    return NextResponse.json({ error: "Ya fue firmado, no se puede rechazar" }, { status: 400 });
  }

  if (firmante.estado === "rechazado") {
    return NextResponse.json({ error: "Ya fue rechazado anteriormente" }, { status: 400 });
  }

  const body = await req.json();
  const { motivo } = body;

  // Actualizar firmante: estado="rechazado"
  await supabaseAdmin
    .from("sgcc_firmantes")
    .update({
      estado: "rechazado",
      motivo_rechazo: motivo || null,
    })
    .eq("id", firmante.id);

  // Registrar "rechazado" en audit trail
  await supabaseAdmin.from("sgcc_firma_registros").insert({
    firma_documento_id: firmante.firma_documento_id,
    firmante_id: firmante.id,
    accion: "rechazado",
    ip,
    user_agent: userAgent,
    metadatos: { motivo: motivo || null },
  });

  // Si algún firmante rechaza, el documento pasa a "rechazado"
  await supabaseAdmin
    .from("sgcc_firma_documentos")
    .update({ estado: "rechazado" })
    .eq("id", firmante.firma_documento_id);

  return NextResponse.json({ ok: true });
}
