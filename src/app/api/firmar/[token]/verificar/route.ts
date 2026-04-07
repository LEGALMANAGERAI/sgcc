import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { verificarOtp } from "@/lib/firma/otp";

type Params = { params: Promise<{ token: string }> };

/**
 * POST /api/firmar/[token]/verificar
 * PÚBLICA - Verificar código OTP. Body: { codigo: "123456" }
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params;

  // Obtener firmante por token
  const { data: firmante } = await supabaseAdmin
    .from("sgcc_firmantes")
    .select("id, nombre, estado, firma_documento_id")
    .eq("token", token)
    .single();

  if (!firmante) {
    return NextResponse.json({ error: "Token inválido" }, { status: 404 });
  }

  if (firmante.estado === "firmado") {
    return NextResponse.json({ error: "Ya fue firmado" }, { status: 400 });
  }

  if (firmante.estado === "rechazado") {
    return NextResponse.json({ error: "Fue rechazado" }, { status: 400 });
  }

  const body = await req.json();
  const { codigo } = body;

  if (!codigo || typeof codigo !== "string") {
    return NextResponse.json({ error: "Código requerido" }, { status: 400 });
  }

  // Verificar OTP
  const resultado = await verificarOtp(firmante.id, codigo);

  if (resultado.ok) {
    // Registrar en audit trail
    await supabaseAdmin.from("sgcc_firma_registros").insert({
      firma_documento_id: firmante.firma_documento_id,
      firmante_id: firmante.id,
      accion: "otp_verificado",
      ip: req.headers.get("x-forwarded-for") || "unknown",
      user_agent: req.headers.get("user-agent") || "unknown",
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json(
    {
      error: resultado.error || "Código incorrecto",
      intentosRestantes: resultado.intentosRestantes,
    },
    { status: 400 }
  );
}
