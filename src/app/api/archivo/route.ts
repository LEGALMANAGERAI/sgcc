// src/app/api/archivo/route.ts
// GET /api/archivo?path=<path en sgcc-documents>
// Único acceso con sesión a los archivos del bucket privado: autoriza con
// puedeLeerArchivo y redirige a una URL firmada de 60 s. Los links se arman
// con archivoHref() (lib/archivos-ref). El firmante externo sin sesión usa
// /api/firmar/[token]/archivo.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pathDeArchivo } from "@/lib/archivos-ref";
import { puedeLeerArchivo, urlFirmada } from "@/lib/archivos-acceso";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const path = pathDeArchivo(req.nextUrl.searchParams.get("path"));
  // 404 y no 403: no confirmar que el archivo existe a quien no tiene acceso.
  const noEncontrado = NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
  if (!path || !(await puedeLeerArchivo(session, path))) return noEncontrado;

  const descargar = req.nextUrl.searchParams.get("descargar")?.slice(0, 200) || undefined;
  const firmada = await urlFirmada(path, 60, descargar);
  if (!firmada) return noEncontrado;

  const res = NextResponse.redirect(firmada, 302);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
