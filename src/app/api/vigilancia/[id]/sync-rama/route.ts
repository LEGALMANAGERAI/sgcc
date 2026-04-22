import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import {
  buscarPorRadicado,
  obtenerActuaciones,
  type ActuacionRama,
} from "@/lib/rama-judicial";
import { randomUUID } from "crypto";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * POST /api/vigilancia/[id]/sync-rama
 *
 * Sincroniza manualmente las actuaciones de un proceso vigilado contra la
 * API de la Rama Judicial:
 *   1. Busca el proceso en la Rama por su número.
 *   2. Obtiene las últimas 50 actuaciones.
 *   3. Inserta las nuevas en sgcc_process_updates (dedup por descripción+fecha).
 *   4. Actualiza metadatos del watched_process.
 *
 * Portado desde legados/src/app/api/procesos/[id]/sync-rama/route.ts.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id } = await params;

  // Obtener proceso vigilado del centro actual
  const { data: proceso } = await supabaseAdmin
    .from("sgcc_watched_processes")
    .select(
      "id, numero_proceso, rama_id_proceso, rama_ultima_actuacion_fecha, center_id"
    )
    .eq("id", id)
    .eq("center_id", centerId)
    .single();

  if (!proceso) {
    return NextResponse.json({ error: "Proceso no encontrado" }, { status: 404 });
  }

  if (!proceso.numero_proceso) {
    return NextResponse.json(
      { error: "Proceso sin número de radicado" },
      { status: 400 }
    );
  }

  // Consultar Rama Judicial
  let procesosRama: any[] = [];
  try {
    procesosRama = await buscarPorRadicado(proceso.numero_proceso);
  } catch (err: any) {
    if (err.name === "AbortError") {
      return NextResponse.json(
        { error: "Tiempo agotado consultando Rama Judicial" },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { error: "No se pudo conectar con Rama Judicial" },
      { status: 502 }
    );
  }

  if (procesosRama.length === 0) {
    return NextResponse.json({
      nuevas: 0,
      mensaje: "Sin resultados en Rama Judicial",
    });
  }

  const ramaProc = proceso.rama_id_proceso
    ? procesosRama.find((p: any) => p.idProceso === proceso.rama_id_proceso) ??
      procesosRama[0]
    : procesosRama[0];

  // Obtener actuaciones de la Rama
  let actuacionesRama: ActuacionRama[] = [];
  try {
    actuacionesRama = await obtenerActuaciones(ramaProc.idProceso, 50);
  } catch {
    return NextResponse.json({
      nuevas: 0,
      errorActuaciones: true,
      mensaje:
        "El servicio de actuaciones de la Rama Judicial no está disponible en este momento. Intenta sincronizar más tarde.",
    });
  }

  if (actuacionesRama.length === 0) {
    return NextResponse.json({ nuevas: 0, mensaje: "Sin actuaciones registradas" });
  }

  // Actuaciones existentes en BD para deduplicación
  const { data: existentes } = await supabaseAdmin
    .from("sgcc_process_updates")
    .select("anotacion, tipo_actuacion, fecha_actuacion")
    .eq("watched_process_id", id);

  const existentesSet = new Set(
    (existentes ?? []).map((a: any) => {
      const f = a.fecha_actuacion
        ? String(a.fecha_actuacion).split("T")[0]
        : "";
      const desc = `${a.tipo_actuacion ?? ""}|${a.anotacion ?? ""}`;
      return `${desc}|${f}`;
    })
  );

  const now = new Date().toISOString();

  const rows = actuacionesRama
    .filter((act: ActuacionRama) => act.actuacion)
    .map((act: ActuacionRama) => {
      const tipo = act.actuacion;
      const anotacion = act.anotacion || act.actuacion;
      const fecha = act.fechaActuacion
        ? new Date(act.fechaActuacion).toISOString().split("T")[0]
        : now.split("T")[0];
      const detalles = act.fechaFinal
        ? `Término vence: ${String(act.fechaFinal).split("T")[0]}`
        : act.fechaRegistro
          ? `Registrada: ${String(act.fechaRegistro).split("T")[0]}`
          : null;
      return { tipo, anotacion, fecha, detalles, raw: act };
    })
    .filter(
      ({ tipo, anotacion, fecha }) =>
        !existentesSet.has(`${tipo}|${anotacion}|${fecha}`)
    );

  if (rows.length > 0) {
    const inserts = rows.map(({ tipo, anotacion, fecha, detalles }) => ({
      id: randomUUID(),
      watched_process_id: id,
      tipo_actuacion: tipo,
      anotacion,
      fecha_actuacion: fecha,
      detalles,
      leida: false,
      created_at: now,
    }));

    const { error: insertError } = await supabaseAdmin
      .from("sgcc_process_updates")
      .insert(inserts);

    if (insertError) {
      console.error("[sync-rama] Error insertando actuaciones:", insertError);
      return NextResponse.json(
        { error: "Error guardando actuaciones", detail: insertError.message },
        { status: 500 }
      );
    }
  }

  // Actualizar metadatos del proceso (siempre, aunque no haya nuevas actuaciones)
  const primeraActuacion = actuacionesRama[0];
  await supabaseAdmin
    .from("sgcc_watched_processes")
    .update({
      rama_id_proceso: ramaProc.idProceso,
      rama_ultima_actuacion_fecha: ramaProc.fechaUltimaActuacion ?? null,
      despacho: ramaProc.despacho ?? undefined,
      departamento: ramaProc.departamento ?? undefined,
      sujetos_procesales: ramaProc.sujetosProcesales ?? undefined,
      fecha_proceso: ramaProc.fechaProceso ?? undefined,
      es_privado: ramaProc.esPrivado ?? undefined,
      ultima_actuacion: primeraActuacion?.anotacion || primeraActuacion?.actuacion,
      ultima_actuacion_fecha: primeraActuacion?.fechaActuacion
        ? new Date(primeraActuacion.fechaActuacion).toISOString().split("T")[0]
        : undefined,
    })
    .eq("id", id);

  return NextResponse.json({
    nuevas: rows.length,
    total: actuacionesRama.length,
    despacho: ramaProc.despacho,
    ultimaActuacion: primeraActuacion?.actuacion,
  });
}
