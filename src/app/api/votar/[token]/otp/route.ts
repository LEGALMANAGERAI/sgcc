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

  // Buscar la fila principal del token (la más antigua del grupo). El token cubre todas
  // las acreencias del mismo acreedor, pero el OTP se ata a una sola fila representativa
  // para que /votar verifique con el mismo firmante_id.
  const { data: filas } = await supabaseAdmin
    .from("sgcc_votacion_insolvencia")
    .select("id, acreencia_id, propuesta:sgcc_propuesta_pago(estado)")
    .eq("token", token)
    .order("created_at", { ascending: true })
    .limit(1);

  const filaPrincipal = filas?.[0] as any;
  if (!filaPrincipal) {
    return NextResponse.json({ error: "Token inválido" }, { status: 404 });
  }

  if (filaPrincipal.propuesta?.estado !== "en_votacion") {
    return NextResponse.json({ error: "La votación no está activa" }, { status: 400 });
  }

  // Obtener email del acreedor desde la acreencia asociada
  const { data: acreenciaFull } = await supabaseAdmin
    .from("sgcc_acreencias")
    .select("party_id, acreedor_nombre")
    .eq("id", filaPrincipal.acreencia_id)
    .single();

  // Buscar email del party
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

  // Reutilizar el sistema OTP de firma — fila principal como firmante_id
  const result = await crearYEnviarOtp(filaPrincipal.id, email, "email");

  return NextResponse.json({ destino: result.destino, canal: "email" });
}
