import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { crearYEnviarOtp } from "@/lib/firma/otp";

type Params = { params: Promise<{ token: string }> };

/**
 * POST /api/votar/[token]/otp
 * PÚBLICA — Enviar OTP al email del acreedor para verificar identidad antes de votar.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const { token } = await params;

  // Buscar el voto por token
  const { data: voto } = await supabaseAdmin
    .from("sgcc_votacion_insolvencia")
    .select("id, acreencia:sgcc_acreencias(acreedor_nombre), propuesta:sgcc_propuesta_pago(estado)")
    .eq("token", token)
    .single();

  if (!voto) {
    return NextResponse.json({ error: "Token inválido" }, { status: 404 });
  }

  if ((voto.propuesta as any)?.estado !== "en_votacion") {
    return NextResponse.json({ error: "La votación no está activa" }, { status: 400 });
  }

  // Obtener email del acreedor (desde la parte vinculada o del registro)
  const { data: acreenciaFull } = await supabaseAdmin
    .from("sgcc_acreencias")
    .select("party_id, acreedor_nombre")
    .eq("id", (voto as any).acreencia_id ?? voto.id)
    .single();

  // Buscar email de la parte
  let email: string | null = null;
  if (acreenciaFull?.party_id) {
    const { data: party } = await supabaseAdmin
      .from("sgcc_parties")
      .select("email")
      .eq("id", acreenciaFull.party_id)
      .single();
    email = party?.email ?? null;
  }

  if (!email) {
    return NextResponse.json({ error: "No se encontró email del acreedor" }, { status: 400 });
  }

  // Reutilizar el sistema OTP de firma (genera, guarda, envía)
  // Usamos el voto.id como "firmante_id" para reutilizar la tabla sgcc_firma_otp
  const result = await crearYEnviarOtp(voto.id, email, "email");

  return NextResponse.json({ destino: result.destino, canal: "email" });
}
