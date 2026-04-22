/**
 * Cliente para la API pública de la Rama Judicial de Colombia.
 *
 * Base: https://consultaprocesos.ramajudicial.gov.co:448/api/v2
 *
 * Esta API es pública pero inestable: manejamos timeout, reintentos y
 * headers específicos (Origin/Referer) porque el servicio los valida.
 *
 * Portado 1:1 desde Legal Manager (legados).
 */

const BASE = "https://consultaprocesos.ramajudicial.gov.co:448/api/v2";
const TIMEOUT_MS = 30000;
const MAX_REINTENTOS = 1;
const PAUSA_REINTENTO_MS = 2000;

export interface ProcesoRama {
  idProceso: number;
  llaveProceso: string;
  fechaProceso: string;
  fechaUltimaActuacion: string;
  despacho: string;
  departamento: string;
  sujetosProcesales: string;
  esPrivado: boolean;
  actuaciones?: ActuacionRama[];
  actuacionesError?: boolean;
}

export interface ActuacionRama {
  idRegActuacion: number;
  fechaActuacion: string;
  actuacion: string;
  anotacion: string;
  fechaInicial?: string;
  fechaFinal?: string;
  fechaRegistro?: string;
}

async function fetchRamaInterno(url: string, timeoutMs: number): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "es-CO,es;q=0.9",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Origin: "https://consultaprocesos.ramajudicial.gov.co",
        Referer: "https://consultaprocesos.ramajudicial.gov.co/",
      },
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchRama(
  url: string,
  opts?: { reintentos?: number; timeoutMs?: number }
): Promise<any> {
  const maxReintentos = opts?.reintentos ?? MAX_REINTENTOS;
  const timeoutMs = opts?.timeoutMs ?? TIMEOUT_MS;
  let lastError: unknown;
  for (let intento = 0; intento <= maxReintentos; intento++) {
    try {
      return await fetchRamaInterno(url, timeoutMs);
    } catch (err) {
      lastError = err;
      if (intento < maxReintentos) {
        await new Promise((r) => setTimeout(r, PAUSA_REINTENTO_MS));
        continue;
      }
    }
  }
  throw lastError;
}

/** Busca procesos por número de radicación (número completo o corto). */
export async function buscarPorRadicado(radicado: string): Promise<ProcesoRama[]> {
  const data = await fetchRama(
    `${BASE}/Procesos/Consulta/NumeroRadicacion?numero=${encodeURIComponent(radicado)}&SoloActivos=false&pagina=1`
  );
  return (data?.procesos ?? []) as ProcesoRama[];
}

export type TipoPersona = "nat" | "jur";

/**
 * Busca procesos por nombre de persona natural o razón social.
 *
 * La API de la Rama filtra distinto dependiendo de si el sujeto es persona
 * natural o jurídica. Sin `tipoPersona` a veces devuelve 0 cuando con el
 * filtro sí hay resultados. Por eso exponemos el parámetro y en el handler
 * de API hacemos fallback automático.
 */
export async function buscarPorNombre(
  nombre: string,
  tipoPersona?: TipoPersona
): Promise<ProcesoRama[]> {
  const tpParam = tipoPersona ? `&tipoPersona=${tipoPersona}` : "";
  const data = await fetchRama(
    `${BASE}/Procesos/Consulta/NombreRazonSocial?nombre=${encodeURIComponent(nombre)}&SoloActivos=false&pagina=1${tpParam}`
  );
  return (data?.procesos ?? []) as ProcesoRama[];
}

/**
 * Busca por nombre con fallback automático. Si la búsqueda sin filtro
 * devuelve 0 resultados, reintenta como persona natural y luego como
 * jurídica, y deduplica por idProceso. Esto maximiza el recall sin
 * costo extra cuando la primera llamada ya trae resultados.
 */
export async function buscarPorNombreConFallback(
  nombre: string
): Promise<ProcesoRama[]> {
  const directos = await buscarPorNombre(nombre);
  if (directos.length > 0) return directos;

  const [naturales, juridicas] = await Promise.all([
    buscarPorNombre(nombre, "nat").catch(() => [] as ProcesoRama[]),
    buscarPorNombre(nombre, "jur").catch(() => [] as ProcesoRama[]),
  ]);

  const mapa = new Map<number, ProcesoRama>();
  for (const p of [...naturales, ...juridicas]) {
    if (!mapa.has(p.idProceso)) mapa.set(p.idProceso, p);
  }
  return Array.from(mapa.values());
}

/**
 * Obtiene las últimas actuaciones de un proceso por su idProceso.
 *
 * Este endpoint de la Rama es especialmente inestable desde serverless
 * (Vercel), por lo que usamos hasta 3 reintentos con 2s de pausa.
 */
export async function obtenerActuaciones(
  idProceso: number,
  cantidad: number = 50
): Promise<ActuacionRama[]> {
  const data = await fetchRama(
    `${BASE}/Proceso/Actuaciones/${idProceso}?pagina=1&cantidadActuaciones=${cantidad}`,
    { reintentos: 3 }
  );
  return (data?.actuaciones ?? []) as ActuacionRama[];
}

/**
 * Detecta la posición procesal de un centro/empresa dentro de un proceso,
 * mirando los sujetos procesales. Copiado del cron vigilancia-demandas de
 * Legados.
 */
export function detectarTipoParte(
  sujetosProcesales: string | null,
  nombre: string,
  nit: string | null
): "demandado" | "demandante" | "indeterminado" {
  if (!sujetosProcesales) return "indeterminado";
  const texto = sujetosProcesales.toUpperCase();
  const candidatos = [nombre, nit].filter(Boolean).map((s) => (s as string).toUpperCase());

  const posDemandado = texto.indexOf("DEMANDADO");
  const posDemandante = texto.indexOf("DEMANDANTE");

  for (const c of candidatos) {
    const pos = texto.indexOf(c);
    if (pos === -1) continue;
    if (posDemandado !== -1 && pos > posDemandado) return "demandado";
    if (posDemandante !== -1 && pos > posDemandante) return "demandante";
  }
  return "indeterminado";
}
