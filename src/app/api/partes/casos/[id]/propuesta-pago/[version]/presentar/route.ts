// src/app/api/partes/casos/[id]/propuesta-pago/[version]/presentar/route.ts
// POST: marca la versión como 'presentada' y sustituye las anteriores vigentes
//       (transacción atómica vía fn_presentar_propuesta_version). Registra
//       la actividad en sgcc_case_timeline y notifica por email al
//       conciliador del caso si está asignado.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { Resend } from "resend";
import {
  puedeEditarPropuesta,
  requireParteDeCaso,
} from "@/lib/partes/caso-guard";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY || "re_placeholder");
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; version: string }> },
) {
  const { id, version } = await params;
  const v = Number(version);
  if (!Number.isFinite(v) || v <= 0) {
    return NextResponse.json({ error: "Versión inválida" }, { status: 400 });
  }

  const guard = await requireParteDeCaso(id);
  if ("error" in guard) return guard.error;

  if (!puedeEditarPropuesta(guard.caso.estado)) {
    return NextResponse.json(
      { error: `No se puede presentar en estado '${guard.caso.estado}'` },
      { status: 409 },
    );
  }

  // Validar que exista un borrador con esa versión
  const { data: borrador, error: errBor } = await supabaseAdmin
    .from("sgcc_case_payment_plan")
    .select("id, motivo_ajuste")
    .eq("case_id", id)
    .eq("version", v)
    .eq("estado", "borrador")
    .limit(1);
  if (errBor) return NextResponse.json({ error: errBor.message }, { status: 500 });
  if (!borrador || borrador.length === 0) {
    return NextResponse.json(
      { error: "No hay borrador para esa versión" },
      { status: 404 },
    );
  }
  const motivo = borrador[0].motivo_ajuste ?? "";

  // Transición atómica en BD
  const { error: errRpc } = await supabaseAdmin.rpc(
    "fn_presentar_propuesta_version",
    { p_case_id: id, p_version: v },
  );
  if (errRpc) return NextResponse.json({ error: errRpc.message }, { status: 500 });

  // Actividad en timeline
  await supabaseAdmin.from("sgcc_case_timeline").insert({
    case_id: id,
    etapa: "propuesta",
    descripcion:
      v === 1
        ? "Se radicó la propuesta de pago inicial"
        : `El deudor presentó la versión ${v} de la propuesta de pago${motivo ? `: ${motivo}` : ""}`,
    completado: true,
    fecha: new Date().toISOString(),
    referencia_id: borrador[0].id,
  });

  // Notificación al conciliador (si hay uno asignado)
  if (guard.caso.conciliador_id) {
    const { data: conciliador } = await supabaseAdmin
      .from("sgcc_staff")
      .select("email, nombre")
      .eq("id", guard.caso.conciliador_id)
      .maybeSingle();

    if (conciliador?.email) {
      try {
        await getResend().emails.send({
          from: "SGCC <notificaciones@sgcc.app>",
          to: conciliador.email,
          subject: `Nueva versión de propuesta de pago — caso ${id.slice(0, 8)}`,
          html: `
            <p>Hola ${conciliador.nombre ?? ""},</p>
            <p>El deudor acaba de presentar la <b>versión ${v}</b> de la propuesta de pago del caso.</p>
            ${motivo ? `<p><i>Motivo del ajuste:</i> ${motivo}</p>` : ""}
            <p>Ingresa al expediente para revisarla.</p>
          `,
        });
      } catch {
        // No bloqueamos el endpoint si falla el envío; queda en timeline.
      }
    }
  }

  return NextResponse.json({ ok: true, version: v });
}
