import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { randomUUID } from "crypto";

/**
 * POST /api/casos/[id]/avanzar
 *
 * Avance/retroceso rápido del flujo del caso: mueve a un estado destino
 * sin requerir los datos completos que piden los endpoints específicos
 * por etapa (/admision, /citacion, /acta).
 *
 * Body (uno de los dos):
 *  - { etapa: "solicitud" | "admision" | "citacion" | "audiencia" | "acta" | "archivo" }
 *  - { direccion: "siguiente" | "anterior" } (legacy)
 */

const ESTADOS_FLUJO = [
  "solicitud",
  "admitido",
  "citado",
  "audiencia",
  "cerrado",
] as const;

type EstadoFlujo = (typeof ESTADOS_FLUJO)[number];

const ETAPA_POR_ESTADO: Record<EstadoFlujo, string> = {
  solicitud: "solicitud",
  admitido: "admision",
  citado: "citacion",
  audiencia: "audiencia",
  cerrado: "archivo",
};

const ETAPAS = ["solicitud", "admision", "citacion", "audiencia", "acta", "archivo"] as const;
type Etapa = (typeof ETAPAS)[number];

const ESTADO_POR_ETAPA: Record<Etapa, EstadoFlujo> = {
  solicitud: "solicitud",
  admision: "admitido",
  citacion: "citado",
  audiencia: "audiencia",
  acta: "cerrado",
  archivo: "cerrado",
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: caseId } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // Cargar el caso para conocer el estado actual
  const { data: caso } = await supabaseAdmin
    .from("sgcc_cases")
    .select("id, estado, center_id")
    .eq("id", caseId)
    .eq("center_id", centerId)
    .maybeSingle();

  if (!caso) return NextResponse.json({ error: "Caso no encontrado" }, { status: 404 });

  const estadoActual = caso.estado as EstadoFlujo;
  if (!ESTADOS_FLUJO.includes(estadoActual)) {
    return NextResponse.json(
      { error: `El caso está en estado "${estadoActual}" y no se puede mover desde ahí` },
      { status: 400 }
    );
  }

  // Resolver estado destino: { etapa } tiene prioridad; si no, { direccion }.
  let nuevoEstado: EstadoFlujo;
  let direccion: "siguiente" | "anterior";

  if (body.etapa && (ETAPAS as readonly string[]).includes(body.etapa)) {
    const etapaDestino = body.etapa as Etapa;
    nuevoEstado = ESTADO_POR_ETAPA[etapaDestino];
    if (nuevoEstado === estadoActual) {
      return NextResponse.json({ ok: true, estadoAnterior: estadoActual, estadoNuevo: nuevoEstado });
    }
    direccion =
      ESTADOS_FLUJO.indexOf(nuevoEstado) > ESTADOS_FLUJO.indexOf(estadoActual)
        ? "siguiente"
        : "anterior";
  } else {
    direccion = body.direccion === "anterior" ? "anterior" : "siguiente";
    const idxActual = ESTADOS_FLUJO.indexOf(estadoActual);
    const idxSiguiente = direccion === "siguiente" ? idxActual + 1 : idxActual - 1;
    if (idxSiguiente < 0 || idxSiguiente >= ESTADOS_FLUJO.length) {
      return NextResponse.json(
        {
          error:
            direccion === "siguiente"
              ? "El caso ya está en el último estado del flujo"
              : "El caso ya está en el primer estado del flujo",
        },
        { status: 400 }
      );
    }
    nuevoEstado = ESTADOS_FLUJO[idxSiguiente];
  }

  const now = new Date().toISOString();

  // Actualizar el estado del caso
  const caseUpdate: Record<string, any> = {
    estado: nuevoEstado,
    updated_at: now,
  };

  // Setear fechas canónicas si están vacías y aplican al nuevo estado
  if (direccion === "siguiente") {
    if (nuevoEstado === "admitido") caseUpdate.fecha_admision = now;
    if (nuevoEstado === "cerrado") caseUpdate.fecha_cierre = now;
  }

  const { error: caseErr } = await supabaseAdmin
    .from("sgcc_cases")
    .update(caseUpdate)
    .eq("id", caseId);
  if (caseErr) return NextResponse.json({ error: caseErr.message }, { status: 500 });

  // Marcar la etapa que se "completó" como completada en el timeline.
  // Si avanza, se completa la etapa del estado anterior.
  // Si retrocede, se descompleta la etapa del estado actual.
  const etapaAfectada =
    direccion === "siguiente"
      ? ETAPA_POR_ESTADO[estadoActual]
      : ETAPA_POR_ESTADO[estadoActual];

  const { data: existing } = await supabaseAdmin
    .from("sgcc_case_timeline")
    .select("id, fecha")
    .eq("case_id", caseId)
    .eq("etapa", etapaAfectada)
    .maybeSingle();

  if (direccion === "siguiente") {
    if (existing) {
      await supabaseAdmin
        .from("sgcc_case_timeline")
        .update({ completado: true, fecha: existing.fecha ?? now })
        .eq("id", existing.id);
    } else {
      await supabaseAdmin.from("sgcc_case_timeline").insert({
        id: randomUUID(),
        case_id: caseId,
        etapa: etapaAfectada,
        completado: true,
        fecha: now,
        descripcion: "Etapa marcada como completada (avance rápido)",
        created_at: now,
      });
    }
  } else if (existing) {
    await supabaseAdmin
      .from("sgcc_case_timeline")
      .update({ completado: false })
      .eq("id", existing.id);
  }

  return NextResponse.json({ ok: true, estadoAnterior: estadoActual, estadoNuevo: nuevoEstado });
}
