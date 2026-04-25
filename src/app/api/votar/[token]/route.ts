import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

type Params = { params: Promise<{ token: string }> };

/**
 * GET /api/votar/[token]
 * PÚBLICA — Obtener datos de votación para el acreedor. El token cubre todas las
 * acreencias del mismo acreedor (un acreedor con N créditos vota una sola vez).
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params;

  const { data: votos } = await supabaseAdmin
    .from("sgcc_votacion_insolvencia")
    .select(`
      id, voto, otp_verificado, votado_at, modo, porcentaje_voto,
      acreencia:sgcc_acreencias(
        id, acreedor_nombre, acreedor_documento, con_capital,
        porcentaje_voto, clase_credito, es_pequeno_acreedor
      ),
      propuesta:sgcc_propuesta_pago(
        id, titulo, descripcion, plazo_meses, tasa_interes,
        periodo_gracia_meses, estado, caso:sgcc_cases(numero_radicado)
      )
    `)
    .eq("token", token)
    .order("created_at", { ascending: true });

  if (!votos || votos.length === 0) {
    return NextResponse.json({ error: "Enlace de votación inválido" }, { status: 404 });
  }

  const propuesta = (votos[0] as any).propuesta;
  if (propuesta?.estado !== "en_votacion") {
    return NextResponse.json({ error: "La votación ya no está activa" }, { status: 400 });
  }

  // Si TODAS las filas ya tienen voto registrado, considerar votación completada
  const todasVotadas = votos.every((v) => v.votado_at && v.voto);
  if (todasVotadas) {
    return NextResponse.json({ error: "Ya registró su voto", voto: votos[0].voto }, { status: 400 });
  }

  // Consolidar al acreedor: nombre/documento de la primera fila, capital y % sumados,
  // lista de créditos para que el votante vea claramente qué está votando.
  const primera = (votos[0] as any).acreencia;
  const creditos = votos.map((v: any) => v.acreencia).filter(Boolean);
  const capitalTotal = creditos.reduce((s, c) => s + Number(c.con_capital || 0), 0);
  const pctTotal = creditos.reduce((s, c) => s + Number(c.porcentaje_voto || 0), 0);
  const todosPequenos = creditos.every((c) => c.es_pequeno_acreedor);

  return NextResponse.json({
    acreedor: {
      acreedor_nombre: primera?.acreedor_nombre ?? "",
      acreedor_documento: primera?.acreedor_documento ?? null,
      con_capital: capitalTotal,
      porcentaje_voto: pctTotal,
      clase_credito: primera?.clase_credito ?? "quinta",
      es_pequeno_acreedor: todosPequenos,
    },
    creditos: creditos.map((c: any) => ({
      id: c.id,
      con_capital: Number(c.con_capital || 0),
      porcentaje_voto: Number(c.porcentaje_voto || 0),
      clase_credito: c.clase_credito,
    })),
    propuesta: {
      titulo: propuesta.titulo,
      descripcion: propuesta.descripcion,
      plazo_meses: propuesta.plazo_meses,
      tasa_interes: propuesta.tasa_interes,
      periodo_gracia_meses: propuesta.periodo_gracia_meses,
      radicado: propuesta.caso?.numero_radicado,
    },
  });
}
