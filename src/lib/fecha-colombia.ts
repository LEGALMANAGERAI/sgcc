/**
 * Utilidades de fecha en horario de Colombia.
 *
 * El servidor (Vercel) corre en UTC, así que `new Date()` y los TIMESTAMPTZ
 * deben proyectarse explícitamente a America/Bogota para no estampar el día
 * siguiente en documentos generados de noche.
 */

export const BOGOTA_TZ = "America/Bogota";

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export interface PartesFecha {
  year: number;
  month: number; // 0-11
  day: number;
  weekday: number; // 0=domingo
  hour: number; // 0-23
  minute: number;
}

/**
 * Parte de calendario de una fecha leída en horario de Colombia.
 *
 * Una cadena "YYYY-MM-DD" proviene de una columna DATE: es una fecha de
 * calendario sin instante, así que se respeta tal cual. Cualquier otro valor
 * se interpreta como instante (TIMESTAMPTZ o `new Date()`) y se proyecta a
 * America/Bogota.
 */
export function partesFechaBogota(input: Date | string): PartesFecha {
  if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [year, month, day] = input.split("-").map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    return { year, month: month - 1, day, weekday, hour: 0, minute: 0 };
  }

  const date = typeof input === "string" ? new Date(input) : input;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BOGOTA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  return {
    year: Number(get("year")),
    month: Number(get("month")) - 1,
    day: Number(get("day")),
    weekday: WEEKDAY_INDEX[get("weekday")] ?? 0,
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
  };
}
