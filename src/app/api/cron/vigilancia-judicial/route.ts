import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { randomUUID } from "crypto";
import { notify } from "@/lib/notifications";

/**
 * GET /api/cron/vigilancia-judicial
 *
 * Cron job que consulta procesos judiciales vigilados y registra
 * actuaciones nuevas automáticamente.
 *
 * Diseñado para ejecutarse via Vercel Cron cada 6 horas.
 *
 * Flujo:
 * 1. Obtener todos los procesos activos
 * 2. Consultar la API de la Rama Judicial por cada proceso
 * 3. Comparar última actuación conocida vs la nueva
 * 4. Si hay novedad → insertar en sgcc_process_updates + notificar
 */
export async function GET(req: NextRequest) {
  // Verificar CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  try {
    // 1. Obtener procesos activos con datos del centro
    const { data: procesos, error: fetchError } = await supabaseAdmin
      .from("sgcc_watched_processes")
      .select(`
        id,
        center_id,
        case_id,
        numero_proceso,
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

    // 2. Consultar cada proceso
    for (const proc of procesos) {
      consultados++;

      try {
        const resultado = await consultarRamaJudicial(proc.numero_proceso);

        if (!resultado) continue;

        // 3. Comparar con última actuación conocida
        const esNueva =
          !proc.ultima_actuacion_fecha ||
          resultado.fecha > proc.ultima_actuacion_fecha ||
          (resultado.fecha === proc.ultima_actuacion_fecha &&
            resultado.anotacion !== proc.ultima_actuacion);

        if (!esNueva) continue;

        // 4. Insertar actuación nueva
        const now = new Date().toISOString();
        await supabaseAdmin.from("sgcc_process_updates").insert({
          id: randomUUID(),
          watched_process_id: proc.id,
          fecha_actuacion: resultado.fecha,
          tipo_actuacion: resultado.tipo,
          anotacion: resultado.anotacion,
          detalles: resultado.detalles ?? null,
          leida: false,
          created_at: now,
        });

        // Actualizar última actuación en el proceso padre
        await supabaseAdmin
          .from("sgcc_watched_processes")
          .update({
            ultima_actuacion: resultado.anotacion,
            ultima_actuacion_fecha: resultado.fecha,
          })
          .eq("id", proc.id);

        // 5. Notificar al staff que solicitó la vigilancia
        if (proc.solicitado_por_staff) {
          const { data: staff } = await supabaseAdmin
            .from("sgcc_staff")
            .select("id, email")
            .eq("id", proc.solicitado_por_staff)
            .single();

          if (staff) {
            await notify({
              centerId: proc.center_id,
              caseId: proc.case_id ?? undefined,
              tipo: "vigilancia",
              titulo: `Nueva actuación en proceso ${proc.numero_proceso}`,
              mensaje: `Se detectó una nueva actuación:\n\n${resultado.tipo ? `Tipo: ${resultado.tipo}\n` : ""}Anotación: ${resultado.anotacion}\nFecha: ${resultado.fecha}`,
              recipients: [{ staffId: staff.id, email: staff.email }],
              canal: "both",
            });
          }
        }

        actualizados++;
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

/* ─── Consulta a la Rama Judicial ──────────────────────────────────────── */

interface ActuacionResultado {
  fecha: string;
  tipo: string;
  anotacion: string;
  detalles?: string;
}

/**
 * Consulta la API de consulta de procesos de la Rama Judicial.
 *
 * La Rama Judicial expone un servicio web SOAP/REST en:
 * https://consultaprocesos.ramajudicial.gov.co:448/api/v2/Procesos/Consulta/NumeroRadicacion
 *
 * Retorna la última actuación del proceso, o null si no hay resultados.
 */
async function consultarRamaJudicial(
  numeroProceso: string
): Promise<ActuacionResultado | null> {
  const baseUrl =
    "https://consultaprocesos.ramajudicial.gov.co:448/api/v2/Procesos/Consulta/NumeroRadicacion";

  try {
    // Consultar proceso
    const res = await fetch(`${baseUrl}?numero=${encodeURIComponent(numeroProceso)}&SoloActivos=false`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "SGCC-VigilanciaJudicial/1.0",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      // La API puede devolver 404 si el proceso no existe
      if (res.status === 404) return null;
      return null;
    }

    const data = await res.json();

    // La API retorna { procesos: [{ idProceso, actuaciones: [...] }] }
    const procesos = data?.procesos;
    if (!procesos || procesos.length === 0) return null;

    // Buscar actuaciones del primer proceso que coincida
    const proceso = procesos[0];

    // Consultar actuaciones del proceso
    const actRes = await fetch(
      `https://consultaprocesos.ramajudicial.gov.co:448/api/v2/Proceso/Actuaciones/${proceso.idProceso}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "SGCC-VigilanciaJudicial/1.0",
        },
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!actRes.ok) return null;

    const actData = await actRes.json();
    const actuaciones = actData?.actuaciones;
    if (!actuaciones || actuaciones.length === 0) return null;

    // Tomar la más reciente (la primera, ya vienen ordenadas DESC)
    const ultima = actuaciones[0];

    return {
      fecha: ultima.fechaActuacion?.split("T")[0] ?? new Date().toISOString().split("T")[0],
      tipo: ultima.actuacion ?? "Actuación",
      anotacion: ultima.anotacion ?? ultima.actuacion ?? "Nueva actuación detectada",
      detalles: ultima.fechaRegistro
        ? `Registrada: ${ultima.fechaRegistro.split("T")[0]}`
        : undefined,
    };
  } catch (err: any) {
    // Timeout o error de red — no es crítico, se reintenta en el próximo ciclo
    console.error(`Error consultando Rama Judicial para ${numeroProceso}:`, err.message);
    return null;
  }
}
