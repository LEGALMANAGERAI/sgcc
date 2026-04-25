import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { randomUUID } from "crypto";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/expediente/[id]/votacion
 * Registrar voto de un acreedor.
 * Body: { propuesta_id, acreencia_id, voto, observaciones? }
 */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const userId = (session.user as any)?.id;
  const { id: caseId } = await params;
  const body = await req.json();

  const { propuesta_id, acreencia_id, voto, observaciones } = body;

  if (!propuesta_id || !acreencia_id || !voto) {
    return NextResponse.json({ error: "propuesta_id, acreencia_id y voto son requeridos" }, { status: 400 });
  }

  const votosValidos = ["positivo", "negativo", "abstiene"];
  if (!votosValidos.includes(voto)) {
    return NextResponse.json({ error: `Voto inválido. Opciones: ${votosValidos.join(", ")}` }, { status: 400 });
  }

  // Verificar propuesta en estado "en_votacion"
  const { data: propuesta } = await supabaseAdmin
    .from("sgcc_propuesta_pago")
    .select("id, estado")
    .eq("id", propuesta_id)
    .eq("case_id", caseId)
    .eq("center_id", centerId)
    .single();

  if (!propuesta) return NextResponse.json({ error: "Propuesta no encontrada" }, { status: 404 });
  if (propuesta.estado !== "en_votacion") {
    return NextResponse.json({ error: "La propuesta no está en estado de votación" }, { status: 400 });
  }

  // Obtener % de voto de la acreencia
  const { data: acreencia } = await supabaseAdmin
    .from("sgcc_acreencias")
    .select("id, porcentaje_voto")
    .eq("id", acreencia_id)
    .eq("case_id", caseId)
    .single();

  if (!acreencia) return NextResponse.json({ error: "Acreencia no encontrada" }, { status: 404 });

  // Upsert: si ya votó, actualizar
  const { data: existente } = await supabaseAdmin
    .from("sgcc_votacion_insolvencia")
    .select("id")
    .eq("propuesta_id", propuesta_id)
    .eq("acreencia_id", acreencia_id)
    .single();

  if (existente) {
    await supabaseAdmin
      .from("sgcc_votacion_insolvencia")
      .update({
        voto,
        porcentaje_voto: acreencia.porcentaje_voto,
        observaciones: observaciones?.trim() || null,
        registrado_por: userId,
      })
      .eq("id", existente.id);
  } else {
    await supabaseAdmin
      .from("sgcc_votacion_insolvencia")
      .insert({
        id: randomUUID(),
        propuesta_id,
        acreencia_id,
        voto,
        porcentaje_voto: acreencia.porcentaje_voto,
        observaciones: observaciones?.trim() || null,
        registrado_por: userId,
        created_at: new Date().toISOString(),
      });
  }

  // Recalcular resultado de la votación.
  // Cada acreedor (no cada acreencia) cuenta como un solo voto: si Davivienda tiene 3
  // créditos, sus 3 votos positivos cuentan como 1 acreedor positivo y como la SUMA de
  // sus % de voto. La deduplicación se hace por documento normalizado | party_id | nombre.
  const { data: votos } = await supabaseAdmin
    .from("sgcc_votacion_insolvencia")
    .select("voto, porcentaje_voto, acreencia:sgcc_acreencias(party_id, acreedor_documento, acreedor_nombre)")
    .eq("propuesta_id", propuesta_id);

  const votosArr = votos ?? [];
  const claveAcreedor = (a: any): string => {
    const docNorm = (a?.acreedor_documento ?? "").replace(/[\s.\-_]/g, "").toUpperCase();
    return docNorm || a?.party_id || (a?.acreedor_nombre ?? "").trim().toUpperCase() || "anon";
  };
  const positivosAcreedoresSet = new Set<string>();
  const negativosAcreedoresSet = new Set<string>();
  let pctPositivo = 0;
  let pctNegativo = 0;
  for (const v of votosArr) {
    const k = claveAcreedor((v as any).acreencia);
    if (v.voto === "positivo") {
      positivosAcreedoresSet.add(k);
      pctPositivo += Number(v.porcentaje_voto);
    } else if (v.voto === "negativo") {
      negativosAcreedoresSet.add(k);
      pctNegativo += Number(v.porcentaje_voto);
    }
  }
  const acreedoresPositivos = positivosAcreedoresSet.size;
  const acreedoresNegativos = negativosAcreedoresSet.size;

  // Total de acreedores únicos del caso (para saber si "todos votaron")
  const { data: todasAcreencias } = await supabaseAdmin
    .from("sgcc_acreencias")
    .select("party_id, acreedor_documento, acreedor_nombre")
    .eq("case_id", caseId)
    .eq("center_id", centerId);
  const acreedoresUnicosCaso = new Set<string>();
  for (const a of todasAcreencias ?? []) acreedoresUnicosCaso.add(claveAcreedor(a));
  const acreedoresVotantes = new Set<string>([...positivosAcreedoresSet, ...negativosAcreedoresSet]);
  const todosVotaron = acreedoresVotantes.size >= acreedoresUnicosCaso.size && acreedoresUnicosCaso.size > 0;

  // Regla: >50% de votos positivos Y al menos 2 acreedores positivos (únicos)
  const aprobada = pctPositivo > 0.5 && acreedoresPositivos >= 2;

  await supabaseAdmin
    .from("sgcc_propuesta_pago")
    .update({
      votos_positivos: acreedoresPositivos,
      votos_negativos: acreedoresNegativos,
      porcentaje_aprobacion: Math.round(pctPositivo * 10000) / 10000,
      acreedores_positivos: acreedoresPositivos,
      resultado_aprobada: todosVotaron ? aprobada : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", propuesta_id);

  return NextResponse.json({
    ok: true,
    votos_positivos: acreedoresPositivos,
    votos_negativos: acreedoresNegativos,
    porcentaje_aprobacion: pctPositivo,
    acreedores_positivos: acreedoresPositivos,
    todos_votaron: todosVotaron,
    aprobada,
  });
}
