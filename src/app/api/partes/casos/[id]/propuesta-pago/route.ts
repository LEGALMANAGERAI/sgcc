// src/app/api/partes/casos/[id]/propuesta-pago/route.ts
// GET: lista todas las versiones del plan de pagos del caso, ordenadas desc.
// POST: crea una nueva versión como borrador, clonando la última presentada.
//       Body opcional: { motivo_ajuste?: string }.
//
// Solo el deudor (created_by_party) puede operar. La edición requiere caso
// en estado 'admitido' o 'citado'.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  puedeEditarPropuesta,
  requireParteDeCaso,
} from "@/lib/partes/caso-guard";

interface PaymentPlanRow {
  id: string;
  case_id: string;
  clase_prelacion: string;
  version: number;
  estado: string;
  autor_party_id: string | null;
  motivo_ajuste: string | null;
  version_anterior_id: string | null;
  presentada_at: string | null;
  updated_at: string;
  created_at: string;
  snapshot_json: unknown;
}

function agruparPorVersion(rows: PaymentPlanRow[]) {
  const byVersion = new Map<number, PaymentPlanRow[]>();
  for (const r of rows) {
    const arr = byVersion.get(r.version) ?? [];
    arr.push(r);
    byVersion.set(r.version, arr);
  }
  return Array.from(byVersion.entries())
    .map(([version, filas]) => {
      const any = filas[0];
      return {
        version,
        estado: any.estado,
        autor_party_id: any.autor_party_id,
        motivo_ajuste: any.motivo_ajuste,
        version_anterior_id: any.version_anterior_id,
        presentada_at: any.presentada_at,
        updated_at: any.updated_at,
        created_at: any.created_at,
        snapshot_json: any.snapshot_json,
        clases: filas.map((f) => f.clase_prelacion),
        filas_ids: filas.map((f) => f.id),
      };
    })
    .sort((a, b) => b.version - a.version);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const guard = await requireParteDeCaso(id);
  if ("error" in guard) return guard.error;

  const [planes, acreedores] = await Promise.all([
    supabaseAdmin
      .from("sgcc_case_payment_plan")
      .select("*")
      .eq("case_id", id)
      .order("version", { ascending: false }),
    supabaseAdmin
      .from("sgcc_case_creditors")
      .select(
        "id, nombre, tipo_doc, numero_doc, clase_prelacion, capital, intereses, mas_90_dias_mora, tasa_interes_mensual, tipo_credito",
      )
      .eq("case_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (planes.error) return NextResponse.json({ error: planes.error.message }, { status: 500 });
  if (acreedores.error)
    return NextResponse.json({ error: acreedores.error.message }, { status: 500 });

  return NextResponse.json({
    caso: {
      id: guard.caso.id,
      estado: guard.caso.estado,
      editable: puedeEditarPropuesta(guard.caso.estado),
    },
    acreedores: acreedores.data ?? [],
    versiones: agruparPorVersion((planes.data ?? []) as PaymentPlanRow[]),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const guard = await requireParteDeCaso(id);
  if ("error" in guard) return guard.error;

  if (!puedeEditarPropuesta(guard.caso.estado)) {
    return NextResponse.json(
      { error: `No se puede crear una nueva versión en estado '${guard.caso.estado}'` },
      { status: 409 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const motivoAjuste =
    typeof body.motivo_ajuste === "string" ? body.motivo_ajuste.slice(0, 1000) : null;

  // Verificar que no exista ya un borrador abierto
  const { data: borradorExistente } = await supabaseAdmin
    .from("sgcc_case_payment_plan")
    .select("version")
    .eq("case_id", id)
    .eq("estado", "borrador")
    .limit(1)
    .maybeSingle();
  if (borradorExistente) {
    return NextResponse.json(
      { error: `Ya existe un borrador abierto (versión ${borradorExistente.version}). Preséntalo o descártalo antes de crear otro.` },
      { status: 409 },
    );
  }

  // Tomar última versión presentada como base
  const { data: vigentes, error: errVig } = await supabaseAdmin
    .from("sgcc_case_payment_plan")
    .select("*")
    .eq("case_id", id)
    .eq("estado", "presentada");
  if (errVig) return NextResponse.json({ error: errVig.message }, { status: 500 });

  if (!vigentes || vigentes.length === 0) {
    return NextResponse.json(
      { error: "El caso no tiene una propuesta vigente para ajustar" },
      { status: 404 },
    );
  }

  const maxVersion = vigentes.reduce((m, r) => Math.max(m, r.version ?? 1), 1);
  const nuevaVersion = maxVersion + 1;

  const filas = vigentes.map((v) => ({
    case_id: id,
    clase_prelacion: v.clase_prelacion,
    version: nuevaVersion,
    estado: "borrador",
    autor_party_id: guard.userId,
    motivo_ajuste: motivoAjuste,
    version_anterior_id: v.id,
    snapshot_json: v.snapshot_json ?? null,
    // Campos legacy: mantenerlos sincronizados para no romper consumidores viejos
    tasa_interes_futura_mensual: v.tasa_interes_futura_mensual ?? null,
    tasa_interes_espera_mensual: v.tasa_interes_espera_mensual ?? null,
    numero_cuotas: v.numero_cuotas ?? null,
    cronograma_json: v.cronograma_json ?? null,
  }));

  const { data: insertadas, error: errIns } = await supabaseAdmin
    .from("sgcc_case_payment_plan")
    .insert(filas)
    .select("id, version");
  if (errIns) return NextResponse.json({ error: errIns.message }, { status: 500 });

  return NextResponse.json(
    { ok: true, version: nuevaVersion, filas_creadas: insertadas?.length ?? 0 },
    { status: 201 },
  );
}
