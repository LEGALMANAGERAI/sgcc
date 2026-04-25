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

  // Buscar TODAS las filas asociadas al token (cubre el caso de un acreedor con varios créditos)
  const { data: filas } = await supabaseAdmin
    .from("sgcc_votacion_insolvencia")
    .select("id, votado_at, voto, propuesta_id, acreencia_id, porcentaje_voto, created_at")
    .eq("token", token)
    .order("created_at", { ascending: true });

  if (!filas || filas.length === 0) {
    return NextResponse.json({ error: "Token inválido" }, { status: 404 });
  }

  if (filas.every((f) => f.votado_at)) {
    return NextResponse.json({ error: "Ya registró su voto" }, { status: 400 });
  }

  const propuestaId = filas[0].propuesta_id;
  const filaPrincipal = filas[0]; // se usa como firmante_id de OTP (consistente con /otp)

  // Verificar propuesta en estado en_votacion
  const { data: propuesta } = await supabaseAdmin
    .from("sgcc_propuesta_pago")
    .select("estado, case_id")
    .eq("id", propuestaId)
    .single();

  if (!propuesta || propuesta.estado !== "en_votacion") {
    return NextResponse.json({ error: "La votación no está activa" }, { status: 400 });
  }

  // Verificar OTP usando la fila principal como firmante_id
  const otpResult = await verificarOtp(filaPrincipal.id, codigo_otp);
  if (!otpResult.ok) {
    return NextResponse.json({
      error: otpResult.error ?? "Código incorrecto",
      intentos_restantes: otpResult.intentosRestantes,
    }, { status: 400 });
  }

  const now = new Date().toISOString();

  // Registrar el MISMO voto en todas las filas del token
  const ids = filas.map((f) => f.id);
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
    .in("id", ids);

  // Recalcular resultado de la propuesta deduplicando acreedores únicos.
  const { data: todosVotos } = await supabaseAdmin
    .from("sgcc_votacion_insolvencia")
    .select("voto, porcentaje_voto, acreencia:sgcc_acreencias(party_id, acreedor_documento, acreedor_nombre)")
    .eq("propuesta_id", propuestaId)
    .not("voto", "is", null);

  const votosArr = todosVotos ?? [];
  const claveAcreedor = (a: any): string => {
    const docNorm = (a?.acreedor_documento ?? "").replace(/[\s.\-_]/g, "").toUpperCase();
    return docNorm || a?.party_id || (a?.acreedor_nombre ?? "").trim().toUpperCase() || "anon";
  };
  const positivosSet = new Set<string>();
  const negativosSet = new Set<string>();
  let pctPositivo = 0;
  for (const v of votosArr) {
    const k = claveAcreedor((v as any).acreencia);
    if (v.voto === "positivo") {
      positivosSet.add(k);
      pctPositivo += Number(v.porcentaje_voto);
    } else if (v.voto === "negativo") {
      negativosSet.add(k);
    }
  }

  const { data: todasAcreencias } = await supabaseAdmin
    .from("sgcc_acreencias")
    .select("party_id, acreedor_documento, acreedor_nombre")
    .eq("case_id", propuesta.case_id);
  const acreedoresUnicos = new Set<string>();
  for (const a of todasAcreencias ?? []) acreedoresUnicos.add(claveAcreedor(a));
  const votantes = new Set<string>([...positivosSet, ...negativosSet]);
  const todosVotaron = votantes.size >= acreedoresUnicos.size && acreedoresUnicos.size > 0;
  const aprobada = pctPositivo > 0.5 && positivosSet.size >= 2;

  await supabaseAdmin
    .from("sgcc_propuesta_pago")
    .update({
      votos_positivos: positivosSet.size,
      votos_negativos: negativosSet.size,
      porcentaje_aprobacion: Math.round(pctPositivo * 10000) / 10000,
      acreedores_positivos: positivosSet.size,
      resultado_aprobada: todosVotaron ? aprobada : null,
      updated_at: now,
    })
    .eq("id", propuestaId);

  return NextResponse.json({
    ok: true,
    voto,
    creditos_aplicados: ids.length,
    mensaje: voto === "positivo"
      ? `Su voto A FAVOR ha sido registrado exitosamente${ids.length > 1 ? ` (aplicado a sus ${ids.length} créditos)` : ""}.`
      : voto === "negativo"
      ? `Su voto EN CONTRA ha sido registrado${ids.length > 1 ? ` (aplicado a sus ${ids.length} créditos)` : ""}.`
      : `Su abstención ha sido registrada${ids.length > 1 ? ` (aplicada a sus ${ids.length} créditos)` : ""}.`,
  });
}
