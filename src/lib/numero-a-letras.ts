/**
 * Utilidades para convertir números y fechas a su forma en letras
 * (estilo jurídico colombiano, ej.: "dos mil veintiséis", "miércoles diecisiete de abril").
 *
 * Uso previsto: generación automática de actas donde se requiere el formato
 *   "dieciséis (16) de abril del año dos mil veintiséis (16/04/2026)".
 */

const UNIDADES = [
  "",
  "uno",
  "dos",
  "tres",
  "cuatro",
  "cinco",
  "seis",
  "siete",
  "ocho",
  "nueve",
  "diez",
  "once",
  "doce",
  "trece",
  "catorce",
  "quince",
  "dieciséis",
  "diecisiete",
  "dieciocho",
  "diecinueve",
  "veinte",
  "veintiuno",
  "veintidós",
  "veintitrés",
  "veinticuatro",
  "veinticinco",
  "veintiséis",
  "veintisiete",
  "veintiocho",
  "veintinueve",
];

const DECENAS = [
  "",
  "",
  "veinte",
  "treinta",
  "cuarenta",
  "cincuenta",
  "sesenta",
  "setenta",
  "ochenta",
  "noventa",
];

const CENTENAS = [
  "",
  "ciento",
  "doscientos",
  "trescientos",
  "cuatrocientos",
  "quinientos",
  "seiscientos",
  "setecientos",
  "ochocientos",
  "novecientos",
];

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const DIAS_SEMANA = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];

/**
 * Convierte un entero 0-999 a letras.
 */
function sub1000(n: number): string {
  if (n === 0) return "";
  if (n < 30) return UNIDADES[n];
  if (n < 100) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    return u === 0 ? DECENAS[d] : `${DECENAS[d]} y ${UNIDADES[u]}`;
  }
  if (n === 100) return "cien";
  const c = Math.floor(n / 100);
  const rest = n % 100;
  return rest === 0 ? CENTENAS[c] : `${CENTENAS[c]} ${sub1000(rest)}`;
}

/**
 * Convierte un entero no negativo a letras (hasta 999 999 999).
 * Suficiente para montos en pesos colombianos típicos.
 */
export function numeroALetras(n: number): string {
  if (!Number.isFinite(n) || n < 0) return String(n);
  n = Math.floor(n);
  if (n === 0) return "cero";

  if (n < 1000) return sub1000(n);

  if (n < 1_000_000) {
    const miles = Math.floor(n / 1000);
    const resto = n % 1000;
    const milesTxt = miles === 1 ? "mil" : `${sub1000(miles)} mil`;
    return resto === 0 ? milesTxt : `${milesTxt} ${sub1000(resto)}`;
  }

  const millones = Math.floor(n / 1_000_000);
  const resto = n % 1_000_000;
  const millonesTxt = millones === 1 ? "un millón" : `${numeroALetras(millones)} millones`;
  return resto === 0 ? millonesTxt : `${millonesTxt} ${numeroALetras(resto)}`;
}

/**
 * Convierte un monto de pesos colombianos al formato jurídico:
 *   1425000000 → "mil cuatrocientos veinticinco millones de pesos m/cte. ($1.425.000.000)"
 */
export function montoEnLetras(monto: number): string {
  const letras = numeroALetras(monto);
  const numero = monto.toLocaleString("es-CO");
  return `${letras} pesos m/cte. ($${numero})`;
}

/**
 * Convierte una fecha al formato jurídico colombiano extenso:
 *   new Date("2026-04-17") → "miércoles diecisiete (17) de abril del año dos mil veintiséis (17/04/2026)"
 */
export function fechaEnLetras(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";

  const dia = d.getDate();
  const mes = d.getMonth();
  const anio = d.getFullYear();
  const diaSemana = DIAS_SEMANA[d.getDay()];

  const diaLetras = numeroALetras(dia);
  const anioLetras = numeroALetras(anio);
  const fechaCorta = `${String(dia).padStart(2, "0")}/${String(mes + 1).padStart(2, "0")}/${anio}`;

  return `${diaSemana} ${diaLetras} (${dia}) de ${MESES[mes]} del año ${anioLetras} (${fechaCorta})`;
}

/**
 * Convierte una hora (Date o "HH:MM") al formato "tres y cinco (03:05 pm)".
 */
export function horaEnLetras(date: Date | string): string {
  let h: number;
  let m: number;
  if (typeof date === "string") {
    // Soporta "HH:MM" o ISO
    if (/^\d{1,2}:\d{2}/.test(date)) {
      const [hh, mm] = date.split(":").map(Number);
      h = hh;
      m = mm;
    } else {
      const d = new Date(date);
      h = d.getHours();
      m = d.getMinutes();
    }
  } else {
    h = date.getHours();
    m = date.getMinutes();
  }

  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;

  const horasLetras = numeroALetras(h12);
  const minutosTxt = m === 0 ? "en punto" : `y ${numeroALetras(m)}`;
  const horaCorta = `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;

  return `${horasLetras} ${minutosTxt} (${horaCorta})`;
}
