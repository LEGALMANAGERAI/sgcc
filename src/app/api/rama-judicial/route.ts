import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  buscarPorNombreConFallback,
  buscarPorRadicado,
  obtenerActuaciones,
  type ProcesoRama,
} from "@/lib/rama-judicial";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * GET /api/rama-judicial
 *
 * Consulta la Rama Judicial en tiempo real.
 *
 * Query params:
 *   - tipo: "nombre" | "radicado" (default: "radicado")
 *   - nombre: string (si tipo=nombre)
 *   - radicado: string (si tipo=radicado)
 *
 * Respuesta: { procesos: ProcesoRama[] }
 *
 * Portado desde legados/src/app/api/rama-judicial/route.ts.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const radicado = req.nextUrl.searchParams.get("radicado")?.trim();
  const nombre = req.nextUrl.searchParams.get("nombre")?.trim();
  const tipoBusqueda = req.nextUrl.searchParams.get("tipo") ?? "radicado";

  if (!radicado && !nombre) {
    return NextResponse.json(
      { error: "Ingresa un número de radicado o un nombre para buscar" },
      { status: 400 }
    );
  }

  let procesos: ProcesoRama[] = [];
  try {
    if (tipoBusqueda === "nombre" && nombre) {
      procesos = await buscarPorNombreConFallback(nombre);
    } else if (radicado) {
      procesos = await buscarPorRadicado(radicado);
    }
  } catch (err: any) {
    if (err.name === "AbortError") {
      return NextResponse.json(
        { error: "Tiempo de espera agotado. La API de la Rama Judicial no respondió." },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { error: "No se pudo conectar con la Rama Judicial. Intenta de nuevo." },
      { status: 502 }
    );
  }

  if (procesos.length === 0) {
    const msg =
      tipoBusqueda === "nombre"
        ? `No se encontraron procesos para "${nombre}" en la Rama Judicial.`
        : "No se encontraron procesos con ese número de radicado en la Rama Judicial.";
    return NextResponse.json({ error: msg }, { status: 404 });
  }

  // Búsqueda por nombre: limitar a 20 y no cargar actuaciones (muchos resultados)
  const limiteProcesos = tipoBusqueda === "nombre" ? procesos.slice(0, 20) : procesos;

  const resultados = await Promise.all(
    limiteProcesos.map(async (proc) => {
      let actuaciones: any[] = [];
      let actuacionesError = false;
      if (tipoBusqueda === "radicado" || limiteProcesos.length <= 3) {
        try {
          actuaciones = await obtenerActuaciones(proc.idProceso, 10);
        } catch {
          actuacionesError = true;
        }
      }
      return { ...proc, actuaciones, actuacionesError };
    })
  );

  return NextResponse.json({ procesos: resultados });
}
