import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { randomUUID } from "crypto";
import { notify } from "@/lib/notifications";
import {
  buscarPorRadicado,
  obtenerActuaciones,
  type ActuacionRama,
} from "@/lib/rama-judicial";

export const maxDuration = 300;

/**
 * GET /api/cron/vigilancia-judicial
 *
 * Cron que recorre todos los procesos vigilados activos y sincroniza sus
 * actuaciones contra la Rama Judicial. Portado desde Legados.
 *
 * Schedule: diario 12:00 UTC (vercel.json).
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  try {
    const { data: procesos, error: fetchError } = await supabaseAdmin
      .from("sgcc_watched_processes")
      .select(`
        id,
        center_id,
        case_id,
        numero_proceso,
        rama_id_proceso,
        rama_ultima_actuacion_fecha,
        ultima_actuacion,
        ultima_actuacion_fecha,
        solicitado_por_staff,
        centro:sgcc_centers!sgcc_watched_processes_center_id_fkey(nombre)
      `)
      .eq("estado", "activo");

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!procesos || procesos.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No hay procesos activos para consultar",
        consultados: 0,
        actualizados: 0,
      });
    }

    let consultados = 0;
    let actualizados = 0;
    const errores: string[] = [];

    for (const proc of procesos as any[]) {
      consultados++;

      try {
        const procesosRama = await buscarPorRadicado(proc.numero_proceso);
        if (procesosRama.length === 0) continue;

        const ramaProc = proc.rama_id_proceso
          ? procesosRama.find((p: any) => p.idProceso === proc.rama_id_proceso) ??
            procesosRama[0]
          : procesosRama[0];

        // Short-circuit: si la fecha de última actuación de la Rama no cambió,
        // no consultamos actuaciones (ahorra llamados a la API inestable).
        const ramaFecha = ramaProc.fechaUltimaActuacion ?? null;
        if (
          ramaFecha &&
          proc.rama_ultima_actuacion_fecha &&
          new Date(ramaFecha).getTime() ===
            new Date(proc.rama_ultima_actuacion_fecha).getTime()
        ) {
          continue;
        }

        let actuacionesRama: ActuacionRama[] = [];
        try {
          actuacionesRama = await obtenerActuaciones(ramaProc.idProceso, 10);
        } catch {
          errores.push(`Proceso ${proc.numero_proceso}: actuaciones no disponibles`);
          continue;
        }

        if (actuacionesRama.length === 0) continue;

        // Dedup contra las existentes
        const { data: existentes } = await supabaseAdmin
          .from("sgcc_process_updates")
          .select("anotacion, tipo_actuacion, fecha_actuacion")
          .eq("watched_process_id", proc.id);

        const existentesSet = new Set(
          (existentes ?? []).map((a: any) => {
            const f = a.fecha_actuacion
              ? String(a.fecha_actuacion).split("T")[0]
              : "";
            return `${a.tipo_actuacion ?? ""}|${a.anotacion ?? ""}|${f}`;
          })
        );

        const now = new Date().toISOString();
        const nuevas = actuacionesRama
          .filter((act) => act.actuacion)
          .map((act) => {
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

        if (nuevas.length === 0) continue;

        const inserts = nuevas.map(({ tipo, anotacion, fecha, detalles }) => ({
          id: randomUUID(),
          watched_process_id: proc.id,
          tipo_actuacion: tipo,
          anotacion,
          fecha_actuacion: fecha,
          detalles,
          leida: false,
          created_at: now,
        }));

        await supabaseAdmin.from("sgcc_process_updates").insert(inserts);

        const primera = actuacionesRama[0];
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
            ultima_actuacion: primera?.anotacion || primera?.actuacion,
            ultima_actuacion_fecha: primera?.fechaActuacion
              ? new Date(primera.fechaActuacion).toISOString().split("T")[0]
              : undefined,
          })
          .eq("id", proc.id);

        // Notificar al staff solicitante
        if (proc.solicitado_por_staff) {
          const { data: staff } = await supabaseAdmin
            .from("sgcc_staff")
            .select("id, email")
            .eq("id", proc.solicitado_por_staff)
            .single();

          if (staff) {
            const titulo =
              nuevas.length === 1
                ? `Nueva actuación en proceso ${proc.numero_proceso}`
                : `${nuevas.length} nuevas actuaciones en proceso ${proc.numero_proceso}`;

            await notify({
              centerId: proc.center_id,
              caseId: proc.case_id ?? undefined,
              tipo: "vigilancia",
              titulo,
              mensaje: `Última: ${nuevas[0].tipo}\n${nuevas[0].anotacion}\nFecha: ${nuevas[0].fecha}`,
              recipients: [{ staffId: staff.id, email: staff.email }],
              canal: "both",
            });
          }
        }

        actualizados++;

        // Pausa 1s entre procesos para no saturar la API pública
        await new Promise((r) => setTimeout(r, 1000));
      } catch (err: any) {
        errores.push(`Proceso ${proc.numero_proceso}: ${err.message}`);
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Consulta completada: ${consultados} procesos consultados, ${actualizados} con actuaciones nuevas`,
      consultados,
      actualizados,
      errores: errores.length > 0 ? errores : undefined,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Error en cron vigilancia: ${err.message}` },
      { status: 500 }
    );
  }
}
