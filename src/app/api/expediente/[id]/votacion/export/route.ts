import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { generarVotacionPdf, type GrupoVotoExport, type ResumenVotacion } from "@/lib/votacion/pdf-votacion";
import { generarVotacionDocx } from "@/lib/votacion/docx-votacion";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/expediente/[id]/votacion/export?format=docx|pdf&propuesta_id=...
 * Descarga el acta de votación de la propuesta en estado en_votacion (o la
 * más reciente si no se pasa propuesta_id), agrupando los votos por acreedor.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id: caseId } = await params;
  const format = (req.nextUrl.searchParams.get("format") ?? "docx").toLowerCase();
  const propuestaIdParam = req.nextUrl.searchParams.get("propuesta_id");

  if (format !== "docx" && format !== "pdf") {
    return NextResponse.json({ error: "Formato inválido (docx|pdf)" }, { status: 400 });
  }

  // Caso + convocante para encabezado
  const { data: caso, error: casoError } = await supabaseAdmin
    .from("sgcc_cases")
    .select(
      `id, numero_radicado, materia,
       partes:sgcc_case_parties(rol, party:sgcc_parties(id, tipo_persona, nombres, apellidos, razon_social, numero_doc, nit_empresa, email, tipo_doc))`,
    )
    .eq("id", caseId)
    .eq("center_id", centerId)
    .single();
  if (casoError || !caso) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  const { data: centro } = await supabaseAdmin
    .from("sgcc_centers")
    .select("nombre, ciudad, direccion, resolucion_habilitacion")
    .eq("id", centerId)
    .single();
  if (!centro) return NextResponse.json({ error: "Centro no encontrado" }, { status: 404 });

  // Resolver propuesta a exportar: la pasada por param, o la más reciente del caso
  let propQuery = supabaseAdmin
    .from("sgcc_propuesta_pago")
    .select("id, titulo, descripcion, plazo_meses, tasa_interes, periodo_gracia_meses, modo_votacion, fecha_votacion, estado")
    .eq("case_id", caseId)
    .eq("center_id", centerId);
  if (propuestaIdParam) propQuery = propQuery.eq("id", propuestaIdParam);
  else propQuery = propQuery.order("created_at", { ascending: false });
  const { data: propuesta } = await propQuery.limit(1).maybeSingle();
  if (!propuesta) return NextResponse.json({ error: "No hay propuesta para exportar" }, { status: 404 });

  // Acreencias del caso + votos asociados a la propuesta
  const { data: acreencias } = await supabaseAdmin
    .from("sgcc_acreencias")
    .select("id, acreedor_nombre, acreedor_documento, party_id, porcentaje_voto, con_capital")
    .eq("case_id", caseId)
    .eq("center_id", centerId);

  const { data: votos } = await supabaseAdmin
    .from("sgcc_votacion_insolvencia")
    .select("acreencia_id, voto, observaciones, votado_at, porcentaje_voto")
    .eq("propuesta_id", propuesta.id);
  const votoPorAcreencia = new Map<string, { voto: any; observaciones: string | null; votado_at: string | null }>();
  for (const v of votos ?? []) {
    votoPorAcreencia.set(v.acreencia_id, {
      voto: v.voto,
      observaciones: v.observaciones ?? null,
      votado_at: v.votado_at ?? null,
    });
  }

  // Fallback de documento desde sgcc_parties (mismo criterio que la UI/votación)
  const partyIds = Array.from(new Set((acreencias ?? []).map((a) => a.party_id).filter(Boolean) as string[]));
  const docPorParty = new Map<string, string>();
  if (partyIds.length > 0) {
    const { data: parties } = await supabaseAdmin
      .from("sgcc_parties")
      .select("id, numero_doc, nit_empresa")
      .in("id", partyIds);
    for (const p of parties ?? []) {
      const doc = (p as any).numero_doc ?? (p as any).nit_empresa ?? null;
      if (doc) docPorParty.set(p.id, doc);
    }
  }

  // Agrupar por acreedor
  const claveAcreedor = (a: any): string => {
    const docDirecto = (a?.acreedor_documento ?? "").replace(/[\s.\-_]/g, "").toUpperCase();
    const docDelParty = a?.party_id ? (docPorParty.get(a.party_id) ?? "").replace(/[\s.\-_]/g, "").toUpperCase() : "";
    const docEfectivo = docDirecto || docDelParty;
    return docEfectivo || a?.party_id || (a?.acreedor_nombre ?? "").trim().toUpperCase() || `id-${a?.id}`;
  };

  type GrupoLocal = {
    clave: string;
    acreedor_nombre: string;
    acreedor_documento: string | null;
    capital_total: number;
    porcentaje_voto: number;
    num_creditos: number;
    votos: Array<{ voto: any; observaciones: string | null; votado_at: string | null }>;
  };
  const mapaGrupos = new Map<string, GrupoLocal>();
  for (const a of acreencias ?? []) {
    const k = claveAcreedor(a);
    if (!mapaGrupos.has(k)) {
      const docMostrar = a.acreedor_documento ?? (a.party_id ? docPorParty.get(a.party_id) ?? null : null);
      mapaGrupos.set(k, {
        clave: k,
        acreedor_nombre: a.acreedor_nombre,
        acreedor_documento: docMostrar,
        capital_total: 0,
        porcentaje_voto: 0,
        num_creditos: 0,
        votos: [],
      });
    }
    const g = mapaGrupos.get(k)!;
    g.capital_total += Number(a.con_capital || 0);
    g.porcentaje_voto += Number(a.porcentaje_voto || 0);
    g.num_creditos += 1;
    const v = votoPorAcreencia.get(a.id);
    if (v) g.votos.push(v);
  }

  // Consolidar voto del grupo: si todas sus filas votaron lo mismo → ese voto, si no → "mixto" (raro) lo dejamos como null.
  const gruposExport: GrupoVotoExport[] = Array.from(mapaGrupos.values()).map((g) => {
    const votosFila = g.votos.filter((v) => v.voto);
    let votoConsolidado: "positivo" | "negativo" | "abstiene" | null = null;
    if (votosFila.length === g.num_creditos && votosFila.every((v) => v.voto === votosFila[0].voto)) {
      votoConsolidado = votosFila[0].voto;
    }
    const obs = votosFila.map((v) => v.observaciones).filter(Boolean).join(" · ") || null;
    const votado_at = votosFila[0]?.votado_at ?? null;
    return {
      acreedor_nombre: g.acreedor_nombre,
      acreedor_documento: g.acreedor_documento,
      capital_total: g.capital_total,
      porcentaje_voto: g.porcentaje_voto,
      num_creditos: g.num_creditos,
      voto: votoConsolidado,
      observaciones: obs,
      votado_at,
    };
  });
  // Ordenar de mayor a menor % de voto
  gruposExport.sort((a, b) => b.porcentaje_voto - a.porcentaje_voto);

  // Resumen
  const totalAcreedores = gruposExport.length;
  const positivos = gruposExport.filter((g) => g.voto === "positivo");
  const negativos = gruposExport.filter((g) => g.voto === "negativo");
  const abstenciones = gruposExport.filter((g) => g.voto === "abstiene");
  const pendientes = gruposExport.filter((g) => g.voto === null);
  const pctPositivo = positivos.reduce((s, g) => s + g.porcentaje_voto, 0);
  const pctNegativo = negativos.reduce((s, g) => s + g.porcentaje_voto, 0);
  const todosVotaron = pendientes.length === 0 && totalAcreedores > 0;
  const aprobada = pctPositivo > 0.5 && positivos.length >= 2;
  const estado_resultado: ResumenVotacion["estado_resultado"] = todosVotaron
    ? aprobada
      ? "aprobada"
      : "rechazada"
    : "en_curso";

  const resumen: ResumenVotacion = {
    acreedores_positivos: positivos.length,
    acreedores_negativos: negativos.length,
    acreedores_abstuvieron: abstenciones.length,
    acreedores_pendientes: pendientes.length,
    porcentaje_positivo: pctPositivo,
    porcentaje_negativo: pctNegativo,
    total_acreedores: totalAcreedores,
    estado_resultado,
  };

  const partesAny = (caso.partes ?? []) as Array<{ rol: string; party: any }>;
  const convocante = partesAny.find((p) => p.rol === "convocante")?.party ?? null;

  const ctx = {
    caso: { numero_radicado: caso.numero_radicado, materia: caso.materia },
    centro,
    convocante,
    propuesta: {
      titulo: propuesta.titulo,
      descripcion: propuesta.descripcion,
      plazo_meses: propuesta.plazo_meses,
      tasa_interes: propuesta.tasa_interes,
      periodo_gracia_meses: propuesta.periodo_gracia_meses ?? 0,
      modo_votacion: propuesta.modo_votacion as any,
      fecha_votacion: propuesta.fecha_votacion as string | null,
    },
    votos: gruposExport,
    resumen,
  };

  const filenameBase = `acta-votacion-${caso.numero_radicado}`;

  if (format === "docx") {
    const buffer = await generarVotacionDocx(ctx);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filenameBase}.docx"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const pdf = await generarVotacionPdf(ctx);
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filenameBase}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
