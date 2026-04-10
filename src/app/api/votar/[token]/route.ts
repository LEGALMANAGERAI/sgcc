import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

type Params = { params: Promise<{ token: string }> };

/**
 * GET /api/votar/[token]
 * PÚBLICA — Obtener datos de votación para el acreedor.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params;

  const { data: voto } = await supabaseAdmin
    .from("sgcc_votacion_insolvencia")
    .select(`
      id, voto, otp_verificado, votado_at, modo,
      acreencia:sgcc_acreencias(
        acreedor_nombre, acreedor_documento, con_capital,
        porcentaje_voto, clase_credito, es_pequeno_acreedor
      ),
      propuesta:sgcc_propuesta_pago(
        id, titulo, descripcion, plazo_meses, tasa_interes,
        periodo_gracia_meses, estado, caso:sgcc_cases(numero_radicado)
      )
    `)
    .eq("token", token)
    .single();

  if (!voto) {
    return NextResponse.json({ error: "Enlace de votación inválido" }, { status: 404 });
  }

  const propuesta = voto.propuesta as any;
  if (propuesta?.estado !== "en_votacion") {
    return NextResponse.json({ error: "La votación ya no está activa" }, { status: 400 });
  }

  if (voto.votado_at && voto.voto) {
    return NextResponse.json({ error: "Ya registró su voto", voto: voto.voto }, { status: 400 });
  }

  return NextResponse.json({
    acreedor: voto.acreencia,
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
