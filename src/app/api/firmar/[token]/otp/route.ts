import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { crearYEnviarOtp } from "@/lib/firma/otp";

type Params = { params: Promise<{ token: string }> };

/**
 * POST /api/firmar/[token]/otp
 * PÚBLICA - Enviar código OTP al firmante.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params;

  // Obtener firmante por token
  const { data: firmante } = await supabaseAdmin
    .from("sgcc_firmantes")
    .select("id, nombre, email, estado, firma_documento_id")
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

  try {
    // Enviar OTP
    const resultado = await crearYEnviarOtp(firmante.id, "email", firmante.email);

    // Registrar en audit trail
    await supabaseAdmin.from("sgcc_firma_registros").insert({
      firma_documento_id: firmante.firma_documento_id,
      firmante_id: firmante.id,
      accion: "otp_solicitado",
      ip: req.headers.get("x-forwarded-for") || "unknown",
      user_agent: req.headers.get("user-agent") || "unknown",
      canal_otp: resultado.canal,
    });

    return NextResponse.json({
      destino: resultado.destino,
      canal: resultado.canal,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error enviando OTP" }, { status: 500 });
  }
}
