import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { verificarOtp } from "@/lib/firma/otp";

type Params = { params: Promise<{ token: string }> };

/**
 * POST /api/votar/[token]/votar
 * PÚBLICA — Registrar voto del acreedor después de verificar OTP.
 * Body: { voto: "positivo"|"negativo"|"abstiene", codigo_otp: string, observaciones?: string }
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params;
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  const body = await req.json();
  const { voto, codigo_otp, observaciones } = body;

  const votosValidos = ["positivo", "negativo", "abstiene"];
  if (!voto || !votosValidos.includes(voto)) {
    return NextResponse.json({ error: "Voto inválido" }, { status: 400 });
  }

  if (!codigo_otp) {
    return NextResponse.json({ error: "Código OTP requerido" }, { status: 400 });
  }

  // Buscar el registro de votación
  const { data: votacion } = await supabaseAdmin
    .from("sgcc_votacion_insolvencia")
    .select("id, votado_at, voto, propuesta_id, acreencia_id, porcentaje_voto")
    .eq("token", token)
    .single();

  if (!votacion) {
    return NextResponse.json({ error: "Token inválido" }, { status: 404 });
  }

  if (votacion.votado_at) {
    return NextResponse.json({ error: "Ya registró su voto" }, { status: 400 });
  }

  // Verificar propuesta en estado en_votacion
  const { data: propuesta } = await supabaseAdmin
    .from("sgcc_propuesta_pago")
    .select("estado, case_id")
    .eq("id", votacion.propuesta_id)
    .single();

  if (!propuesta || propuesta.estado !== "en_votacion") {
    return NextResponse.json({ error: "La votación no está activa" }, { status: 400 });
  }

  // Verificar OTP (reutilizamos votacion.id como firmante_id)
  const otpResult = await verificarOtp(votacion.id, codigo_otp);
  if (!otpResult.ok) {
    return NextResponse.json({
      error: otpResult.error ?? "Código incorrecto",
      intentos_restantes: otpResult.intentosRestantes,
    }, { status: 400 });
  }

  const now = new Date().toISOString();

  // Registrar voto
  await supabaseAdmin
    .from("sgcc_votacion_insolvencia")
    .update({
      voto,
      otp_verificado: true,
      ip,
      user_agent: userAgent,
      modo: "link",
      votado_at: now,
      observaciones: observaciones?.trim() || null,
    })
    .eq("id", votacion.id);

  // Recalcular resultado de la propuesta
  const { data: todosVotos } = await supabaseAdmin
    .from("sgcc_votacion_insolvencia")
    .select("voto, porcentaje_voto")
    .eq("propuesta_id", votacion.propuesta_id)
    .not("voto", "is", null);

  const votosArr = todosVotos ?? [];
  const positivos = votosArr.filter((v) => v.voto === "positivo");
  const negativos = votosArr.filter((v) => v.voto === "negativo");
  const pctPositivo = positivos.reduce((sum, v) => sum + Number(v.porcentaje_voto), 0);

  const { count: totalAcreedores } = await supabaseAdmin
    .from("sgcc_acreencias")
    .select("id", { count: "exact", head: true })
    .eq("case_id", propuesta.case_id);

  const todosVotaron = votosArr.length >= (totalAcreedores ?? 0);
  const aprobada = pctPositivo > 0.5 && positivos.length >= 2;

  await supabaseAdmin
    .from("sgcc_propuesta_pago")
    .update({
      votos_positivos: positivos.length,
      votos_negativos: negativos.length,
      porcentaje_aprobacion: Math.round(pctPositivo * 10000) / 10000,
      acreedores_positivos: positivos.length,
      resultado_aprobada: todosVotaron ? aprobada : null,
      updated_at: now,
    })
    .eq("id", votacion.propuesta_id);

  return NextResponse.json({
    ok: true,
    voto,
    mensaje: voto === "positivo"
      ? "Su voto A FAVOR ha sido registrado exitosamente."
      : voto === "negativo"
      ? "Su voto EN CONTRA ha sido registrado."
      : "Su abstención ha sido registrada.",
  });
}
