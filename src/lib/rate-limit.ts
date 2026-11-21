/**
 * Limitador de ventana fija en memoria, por clave (ej. IP).
 *
 * ponytail: vive en la memoria de cada instancia serverless — un atacante
 * repartido entre instancias frías lo esquiva. Por eso el widget además tiene
 * un tope por centro contado en BD. Si hace falta precisión global, mover a
 * Upstash Redis o a una tabla.
 *
 * @returns función que devuelve true si la clave aún tiene cupo (y lo consume).
 */
export function crearLimitador(max: number, ventanaMs: number) {
  const hits = new Map<string, { n: number; desde: number }>();
  return (clave: string, ahora = Date.now()): boolean => {
    const h = hits.get(clave);
    if (!h || ahora - h.desde >= ventanaMs) {
      if (hits.size > 10_000) hits.clear(); // evita crecer sin límite
      hits.set(clave, { n: 1, desde: ahora });
      return true;
    }
    if (h.n >= max) return false;
    h.n++;
    return true;
  };
}

/** IP del cliente detrás del proxy de Vercel (primer valor de x-forwarded-for). */
export function ipDe(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}
