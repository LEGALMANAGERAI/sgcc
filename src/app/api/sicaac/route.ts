// src/app/api/sicaac/route.ts
// GET: lista todas las actas y constancias del centro con su estado SICAAC.
// Soporta filtros via querystring: ?estado=pendiente|registrada

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const url = new URL(req.url);
  const estado = url.searchParams.get("estado");

  let query = supabaseAdmin
    .from("sgcc_actas")
    .select(
      `
        id, numero_acta, tipo, es_constancia, fecha_acta,
        sicaac_estado, sicaac_numero_registro, sicaac_fecha_registro,
        caso:sgcc_cases!inner(id, numero_radicado, center_id, tipo_tramite)
      `
    )
    .eq("caso.center_id", centerId)
    .order("fecha_acta", { ascending: false });

  if (estado === "pendiente" || estado === "registrada") {
    query = query.eq("sicaac_estado", estado);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ actas: data ?? [] });
}
