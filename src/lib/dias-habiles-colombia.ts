/**
 * Motor de dias habiles de Colombia
 *
 * Incluye:
 * - Festivos fijos
 * - Festivos trasladados al lunes (Ley Emiliani 51 de 1983)
 * - Festivos dependientes de Semana Santa (Pascua)
 *
 * Referencia normativa: Ley 51 de 1983 (Ley Emiliani)
 */

// ─── Helpers internos ──────────────────────────────────────────────────────

/** Compara solo la parte de fecha (sin hora) */
function isSameDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Clona una fecha sin referencia */
function cloneDate(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Si la fecha cae en lunes, se retorna tal cual.
 * Si no, se traslada al lunes siguiente (Ley Emiliani).
 */
function trasladarAlLunes(date: Date): Date {
  const d = cloneDate(date);
  const dow = d.getDay(); // 0=dom, 1=lun, ..., 6=sab
  if (dow === 1) return d;
  // Calcular dias hasta el proximo lunes
  const diasHastaLunes = dow === 0 ? 1 : 8 - dow;
  d.setDate(d.getDate() + diasHastaLunes);
  return d;
}

/** Crea una fecha local sin problemas de timezone */
function createDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

// ─── Calculo de Pascua ─────────────────────────────────────────────────────

/**
 * Calcula la fecha de Pascua para un anio dado.
 * Algoritmo anonimo de Meeus/Jones/Butcher.
 */
export function calcularPascua(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return createDate(year, month, day);
}

// ─── Festivos de Colombia ──────────────────────────────────────────────────

export interface FestivoConNombre {
  fecha: Date;
  nombre: string;
}

/**
 * Retorna todos los festivos de Colombia para un anio dado.
 * Incluye festivos fijos, trasladados (Ley Emiliani) y dependientes de Pascua.
 */
export function festivosColombia(year: number): Date[] {
  return festivosColombiaConNombre(year).map((f) => f.fecha);
}

/**
 * Retorna festivos de Colombia con su nombre legible para mostrar en UI.
 */
export function festivosColombiaConNombre(year: number): FestivoConNombre[] {
  const festivos: FestivoConNombre[] = [];

  // ── 1. Festivos fijos (no se trasladan) ──
  festivos.push({ fecha: createDate(year, 1, 1), nombre: "Año Nuevo" });
  festivos.push({ fecha: createDate(year, 5, 1), nombre: "Día del Trabajo" });
  festivos.push({ fecha: createDate(year, 7, 20), nombre: "Día de la Independencia" });
  festivos.push({ fecha: createDate(year, 8, 7), nombre: "Batalla de Boyacá" });
  festivos.push({ fecha: createDate(year, 12, 8), nombre: "Inmaculada Concepción" });
  festivos.push({ fecha: createDate(year, 12, 17), nombre: "Día de la Rama Judicial" });
  festivos.push({ fecha: createDate(year, 12, 25), nombre: "Navidad" });

  // ── 2. Festivos trasladados al lunes (Ley Emiliani) ──
  festivos.push({ fecha: trasladarAlLunes(createDate(year, 1, 6)), nombre: "Reyes Magos" });
  festivos.push({ fecha: trasladarAlLunes(createDate(year, 3, 19)), nombre: "San José" });
  festivos.push({
    fecha: trasladarAlLunes(createDate(year, 6, 29)),
    nombre: "San Pedro y San Pablo",
  });
  festivos.push({
    fecha: trasladarAlLunes(createDate(year, 8, 15)),
    nombre: "Asunción de la Virgen",
  });
  festivos.push({ fecha: trasladarAlLunes(createDate(year, 10, 12)), nombre: "Día de la Raza" });
  festivos.push({ fecha: trasladarAlLunes(createDate(year, 11, 1)), nombre: "Todos los Santos" });
  festivos.push({
    fecha: trasladarAlLunes(createDate(year, 11, 11)),
    nombre: "Independencia de Cartagena",
  });

  // ── 3. Festivos dependientes de Pascua ──
  const pascua = calcularPascua(year);

  const juevesSanto = cloneDate(pascua);
  juevesSanto.setDate(juevesSanto.getDate() - 3);
  festivos.push({ fecha: juevesSanto, nombre: "Jueves Santo" });

  const viernesSanto = cloneDate(pascua);
  viernesSanto.setDate(viernesSanto.getDate() - 2);
  festivos.push({ fecha: viernesSanto, nombre: "Viernes Santo" });

  const ascension = cloneDate(pascua);
  ascension.setDate(ascension.getDate() + 43);
  festivos.push({ fecha: trasladarAlLunes(ascension), nombre: "Ascensión del Señor" });

  const corpus = cloneDate(pascua);
  corpus.setDate(corpus.getDate() + 64);
  festivos.push({ fecha: trasladarAlLunes(corpus), nombre: "Corpus Christi" });

  const sagradoCorazon = cloneDate(pascua);
  sagradoCorazon.setDate(sagradoCorazon.getDate() + 71);
  festivos.push({ fecha: trasladarAlLunes(sagradoCorazon), nombre: "Sagrado Corazón" });

  return festivos;
}

// ─── Funciones publicas ────────────────────────────────────────────────────

/** Cache interno de festivos por anio para evitar recalculos */
const _cache = new Map<number, Date[]>();

function festivosDelAnio(year: number): Date[] {
  if (!_cache.has(year)) {
    _cache.set(year, festivosColombia(year));
  }
  return _cache.get(year)!;
}

/**
 * Verifica si una fecha es festivo en Colombia.
 */
export function esFestivo(date: Date): boolean {
  const festivos = festivosDelAnio(date.getFullYear());
  return festivos.some((f) => isSameDate(f, date));
}

/** Cache interno de festivos con nombre por año */
const _cacheNombre = new Map<number, FestivoConNombre[]>();

function festivosConNombreDelAnio(year: number): FestivoConNombre[] {
  if (!_cacheNombre.has(year)) {
    _cacheNombre.set(year, festivosColombiaConNombre(year));
  }
  return _cacheNombre.get(year)!;
}

/**
 * Devuelve el nombre del festivo si la fecha es festivo en Colombia, null en otro caso.
 */
export function nombreFestivo(date: Date): string | null {
  const festivos = festivosConNombreDelAnio(date.getFullYear());
  const f = festivos.find((x) => isSameDate(x.fecha, date));
  return f ? f.nombre : null;
}

/**
 * Vacancia judicial colombiana (Ley 270 de 1996, art. 146):
 * del 19 de diciembre al 10 de enero del año siguiente.
 *
 * En centros de conciliación no aplica con la misma fuerza que en la
 * jurisdicción ordinaria, pero se observa por convención del centro y
 * para no programar audiencias en ese rango.
 */
export function enVacanciaJudicial(date: Date): boolean {
  const m = date.getMonth(); // 0=enero ... 11=diciembre
  const d = date.getDate();
  if (m === 11 && d >= 19) return true; // 19-31 diciembre
  if (m === 0 && d <= 10) return true; // 1-10 enero
  return false;
}

/**
 * Verifica si una fecha es dia habil en Colombia.
 * Un dia habil es aquel que no es sabado, domingo ni festivo.
 */
export function esDiaHabil(date: Date): boolean {
  const dow = date.getDay();
  // Sabado (6) o domingo (0)
  if (dow === 0 || dow === 6) return false;
  return !esFestivo(date);
}

/**
 * Suma N dias habiles a una fecha.
 * Si la fecha inicial no es habil, empieza desde el siguiente dia habil.
 */
export function sumarDiasHabiles(date: Date, dias: number): Date {
  const result = cloneDate(date);
  let added = 0;
  while (added < dias) {
    result.setDate(result.getDate() + 1);
    if (esDiaHabil(result)) added++;
  }
  return result;
}

/**
 * Resta N dias habiles a una fecha.
 */
export function restarDiasHabiles(date: Date, dias: number): Date {
  const result = cloneDate(date);
  let removed = 0;
  while (removed < dias) {
    result.setDate(result.getDate() - 1);
    if (esDiaHabil(result)) removed++;
  }
  return result;
}

/**
 * Cuenta los dias habiles entre dos fechas (exclusivo en ambos extremos).
 * Si inicio > fin, retorna numero negativo.
 */
export function diasHabilesEntre(inicio: Date, fin: Date): number {
  const a = cloneDate(inicio);
  const b = cloneDate(fin);

  if (a.getTime() === b.getTime()) return 0;

  const forward = a < b;
  const from = forward ? a : b;
  const to = forward ? b : a;

  let count = 0;
  const cursor = cloneDate(from);
  cursor.setDate(cursor.getDate() + 1);

  while (cursor < to) {
    if (esDiaHabil(cursor)) count++;
    cursor.setDate(cursor.getDate() + 1);
  }

  return forward ? count : -count;
}

/**
 * Retorna el siguiente dia habil.
 * Si la fecha dada ya es habil, la retorna tal cual.
 */
export function siguienteDiaHabil(date: Date): Date {
  const result = cloneDate(date);
  while (!esDiaHabil(result)) {
    result.setDate(result.getDate() + 1);
  }
  return result;
}
