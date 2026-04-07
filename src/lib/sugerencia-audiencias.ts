/**
 * Motor de sugerencia inteligente de horarios para audiencias.
 *
 * Analiza disponibilidad de conciliadores, salas y dias habiles
 * para sugerir los mejores slots de audiencia.
 */

import { supabaseAdmin } from "./supabase";
import { esDiaHabil, siguienteDiaHabil } from "./dias-habiles-colombia";

// ─── Tipos ─────────────────────────────────────────────────────────────────

export interface SlotDisponible {
  fecha: Date;
  horaInicio: string; // "09:00"
  horaFin: string; // "10:00"
  sala: { id: string; nombre: string; tipo: string };
  conciliador: { id: string; nombre: string };
  score: number; // 0-100, mayor = mejor opcion
}

export interface SugerenciaOptions {
  centerId: string;
  conciliadorId?: string; // si se quiere con un conciliador especifico
  salaId?: string; // si se quiere en una sala especifica
  duracionMin: number; // duracion de la audiencia en minutos
  diasDesde?: Date; // buscar desde esta fecha (default: hoy)
  diasHasta?: Date; // buscar hasta esta fecha (default: hoy + 30 dias)
  maxResultados?: number; // maximo de sugerencias (default: 5)
}

// ─── Helpers internos ──────────────────────────────────────────────────────

/** Convierte "HH:MM" a minutos desde medianoche */
function horaAMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

/** Convierte minutos desde medianoche a "HH:MM" */
function minutosAHora(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Formatea fecha a YYYY-MM-DD */
function fechaISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Verifica si dos rangos de tiempo se traslapan */
function hayTraslape(
  inicioA: number,
  finA: number,
  inicioB: number,
  finB: number
): boolean {
  return inicioA < finB && finA > inicioB;
}

// ─── Motor de sugerencia ───────────────────────────────────────────────────

interface AudienciaExistente {
  conciliador_id: string | null;
  sala_id: string | null;
  fecha_hora: string;
  duracion_min: number;
}

/**
 * Sugiere los mejores horarios disponibles para una audiencia.
 *
 * Logica:
 * 1. Obtener config del centro (horarios, dias habiles)
 * 2. Obtener audiencias ya programadas en el rango
 * 3. Obtener conciliadores y salas activos
 * 4. Generar slots y verificar disponibilidad
 * 5. Calcular score y ordenar
 */
export async function sugerirHorariosAudiencia(
  opts: SugerenciaOptions
): Promise<SlotDisponible[]> {
  const {
    centerId,
    conciliadorId,
    salaId,
    duracionMin,
    maxResultados = 5,
  } = opts;

  const hoy = new Date();
  const desde = opts.diasDesde ?? hoy;
  const hasta =
    opts.diasHasta ??
    new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 30);

  // ── 1. Configuracion del centro ──
  const { data: center } = await supabaseAdmin
    .from("sgcc_centers")
    .select("hora_inicio_audiencias, hora_fin_audiencias, dias_habiles_citacion")
    .eq("id", centerId)
    .single();

  const horaInicioCentro = center?.hora_inicio_audiencias ?? "08:00";
  const horaFinCentro = center?.hora_fin_audiencias ?? "17:00";
  const inicioMin = horaAMinutos(horaInicioCentro);
  const finMin = horaAMinutos(horaFinCentro);

  // ── 2. Audiencias existentes en el rango ──
  const desdeISO = fechaISO(desde);
  const hastaISO = fechaISO(hasta);

  const { data: audienciasRaw } = await supabaseAdmin
    .from("sgcc_hearings")
    .select("conciliador_id, sala_id, fecha_hora, duracion_min")
    .eq("case:sgcc_cases!inner(center_id)", centerId)
    .gte("fecha_hora", `${desdeISO}T00:00:00`)
    .lte("fecha_hora", `${hastaISO}T23:59:59`)
    .in("estado", ["programada", "en_curso"]);

  // Fallback: query directa si el join falla
  let audiencias: AudienciaExistente[] = audienciasRaw ?? [];

  if (!audienciasRaw) {
    // Obtener IDs de casos del centro
    const { data: casosDelCentro } = await supabaseAdmin
      .from("sgcc_cases")
      .select("id")
      .eq("center_id", centerId);

    const caseIds = (casosDelCentro ?? []).map((c) => c.id);

    if (caseIds.length > 0) {
      const { data: audienciasFallback } = await supabaseAdmin
        .from("sgcc_hearings")
        .select("conciliador_id, sala_id, fecha_hora, duracion_min")
        .in("case_id", caseIds)
        .gte("fecha_hora", `${desdeISO}T00:00:00`)
        .lte("fecha_hora", `${hastaISO}T23:59:59`)
        .in("estado", ["programada", "en_curso"]);

      audiencias = audienciasFallback ?? [];
    }
  }

  // ── 3. Conciliadores activos ──
  let conciliadoresQuery = supabaseAdmin
    .from("sgcc_staff")
    .select("id, nombre")
    .eq("center_id", centerId)
    .eq("activo", true)
    .in("rol", ["conciliador", "admin"]);

  if (conciliadorId) {
    conciliadoresQuery = conciliadoresQuery.eq("id", conciliadorId);
  }

  const { data: conciliadores } = await conciliadoresQuery;

  if (!conciliadores || conciliadores.length === 0) {
    return [];
  }

  // ── 4. Salas activas ──
  let salasQuery = supabaseAdmin
    .from("sgcc_rooms")
    .select("id, nombre, tipo")
    .eq("center_id", centerId)
    .eq("activa", true);

  if (salaId) {
    salasQuery = salasQuery.eq("id", salaId);
  }

  const { data: salas } = await salasQuery;

  if (!salas || salas.length === 0) {
    return [];
  }

  // ── 5. Indexar audiencias existentes por fecha para busqueda rapida ──
  const audienciasPorFecha = new Map<
    string,
    Array<{
      conciliadorId: string | null;
      salaId: string | null;
      inicioMin: number;
      finMin: number;
    }>
  >();

  for (const a of audiencias) {
    const fechaStr = a.fecha_hora.split("T")[0];
    const horaParts = a.fecha_hora.split("T")[1];
    const horaMinutos = horaAMinutos(horaParts?.substring(0, 5) ?? "00:00");

    if (!audienciasPorFecha.has(fechaStr)) {
      audienciasPorFecha.set(fechaStr, []);
    }
    audienciasPorFecha.get(fechaStr)!.push({
      conciliadorId: a.conciliador_id,
      salaId: a.sala_id,
      inicioMin: horaMinutos,
      finMin: horaMinutos + a.duracion_min,
    });
  }

  // ── 6. Generar slots disponibles ──
  const slots: SlotDisponible[] = [];
  const cursor = siguienteDiaHabil(
    new Date(desde.getFullYear(), desde.getMonth(), desde.getDate())
  );

  // Asegurar que empezamos desde manana si "desde" es hoy
  if (
    cursor.getFullYear() === hoy.getFullYear() &&
    cursor.getMonth() === hoy.getMonth() &&
    cursor.getDate() === hoy.getDate()
  ) {
    cursor.setDate(cursor.getDate() + 1);
    while (!esDiaHabil(cursor)) {
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  const hastaTime = hasta.getTime();
  const totalDias = Math.ceil(
    (hastaTime - cursor.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Limitar iteraciones para evitar loops infinitos
  let diasRevisados = 0;
  const maxDias = Math.min(totalDias + 1, 90);

  while (cursor.getTime() <= hastaTime && diasRevisados < maxDias) {
    if (!esDiaHabil(cursor)) {
      cursor.setDate(cursor.getDate() + 1);
      diasRevisados++;
      continue;
    }

    const fechaStr = fechaISO(cursor);
    const audienciasDelDia = audienciasPorFecha.get(fechaStr) ?? [];

    // Generar bloques de tiempo segun duracion solicitada
    for (
      let slotInicio = inicioMin;
      slotInicio + duracionMin <= finMin;
      slotInicio += 30 // Avanzar de 30 en 30 minutos
    ) {
      const slotFin = slotInicio + duracionMin;

      for (const conciliador of conciliadores) {
        // Verificar que el conciliador no tenga audiencia en ese horario
        const conciliadorOcupado = audienciasDelDia.some(
          (a) =>
            a.conciliadorId === conciliador.id &&
            hayTraslape(slotInicio, slotFin, a.inicioMin, a.finMin)
        );
        if (conciliadorOcupado) continue;

        for (const sala of salas) {
          // Verificar que la sala no este ocupada
          const salaOcupada = audienciasDelDia.some(
            (a) =>
              a.salaId === sala.id &&
              hayTraslape(slotInicio, slotFin, a.inicioMin, a.finMin)
          );
          if (salaOcupada) continue;

          // Calcular score
          const score = calcularScore(cursor, slotInicio, sala.tipo, hoy);

          slots.push({
            fecha: new Date(
              cursor.getFullYear(),
              cursor.getMonth(),
              cursor.getDate()
            ),
            horaInicio: minutosAHora(slotInicio),
            horaFin: minutosAHora(slotFin),
            sala: { id: sala.id, nombre: sala.nombre, tipo: sala.tipo },
            conciliador: { id: conciliador.id, nombre: conciliador.nombre },
            score,
          });
        }
      }
    }

    cursor.setDate(cursor.getDate() + 1);
    diasRevisados++;
  }

  // ── 7. Ordenar por score descendente y retornar top N ──
  slots.sort((a, b) => b.score - a.score);

  return slots.slice(0, maxResultados);
}

// ─── Calculo de score ──────────────────────────────────────────────────────

/**
 * Calcula un score de 0-100 para un slot de audiencia.
 *
 * Criterios:
 * - Cercania temporal: dias mas cercanos tienen mayor score (40 pts max)
 * - Horario de manana: preferencia sobre tarde (25 pts max)
 * - Tipo de sala: presencial > virtual para primera audiencia (15 pts max)
 * - Horario optimo: slots que empiezan en hora exacta (10 pts max)
 * - Evitar extremos: no muy temprano ni muy tarde (10 pts max)
 */
function calcularScore(
  fecha: Date,
  slotInicioMin: number,
  tipoSala: string,
  hoy: Date
): number {
  let score = 0;

  // ── Cercania temporal (40 pts) ──
  const diasDiferencia = Math.ceil(
    (fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
  );
  // Entre 1 y 5 dias: maximo puntaje, decrece linealmente hasta 30 dias
  if (diasDiferencia <= 5) {
    score += 40;
  } else if (diasDiferencia <= 30) {
    score += Math.round(40 * (1 - (diasDiferencia - 5) / 25));
  }

  // ── Horario de manana (25 pts) ──
  // Antes de las 12:00 (720 min) = mejor
  if (slotInicioMin < 720) {
    // Escala: 9:00-10:00 es optimo
    if (slotInicioMin >= 540 && slotInicioMin <= 600) {
      score += 25;
    } else if (slotInicioMin >= 480 && slotInicioMin < 540) {
      score += 20;
    } else if (slotInicioMin > 600 && slotInicioMin < 720) {
      score += 15;
    } else {
      score += 10;
    }
  } else {
    // Tarde: menor puntaje
    if (slotInicioMin < 840) {
      // Antes de las 2pm
      score += 10;
    } else {
      score += 5;
    }
  }

  // ── Tipo de sala (15 pts) ──
  if (tipoSala === "presencial") {
    score += 15;
  } else {
    score += 8;
  }

  // ── Horario en hora exacta (10 pts) ──
  if (slotInicioMin % 60 === 0) {
    score += 10;
  } else if (slotInicioMin % 30 === 0) {
    score += 5;
  }

  // ── Evitar extremos del dia (10 pts) ──
  // Ni muy temprano (antes de 8:30) ni muy tarde (despues de 4pm)
  if (slotInicioMin >= 510 && slotInicioMin <= 960) {
    score += 10;
  } else if (slotInicioMin >= 480 || slotInicioMin <= 1020) {
    score += 5;
  }

  return Math.min(100, score);
}
