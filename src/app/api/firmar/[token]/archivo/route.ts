import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { pathDeArchivo } from "@/lib/archivos-ref";
import { urlFirmada } from "@/lib/archivos-acceso";

type Params = { params: Promise<{ token: string }> };

const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * GET /api/firmar/[token]/archivo?tipo=original|firmado
 * PÚBLICA (firmante externo sin sesión) — el token es la credencial.
 * Valida el token igual que GET /api/firmar/[token] y redirige a una URL
 * firmada de 5 min del documento (bucket sgcc-documents privado).
 * - original: solo mientras el firmante puede firmar (no firmado/rechazado/expirado).
 * - firmado: solo si ESTE firmante ya firmó (para descargar tras firmar).
 */
export async function GET(req: NextRequest, { params }: Params) {
  const { token } = await params;
  const tipo = req.nextUrl.searchParams.get("tipo") === "firmado" ? "firmado" : "original";

  // Mismo lookup que src/app/api/firmar/[token]/route.ts
  const { data: firmante, error } = await supabaseAdmin
    .from("sgcc_firmantes")
    .select(`
      id, estado, lm_signing_url,
      documento:sgcc_firma_documentos(
        id, archivo_url, archivo_firmado_url, fecha_expiracion, proveedor
      )
    `)
    .eq("token", token)
    .single();

  if (error || !firmante) {
    return NextResponse.json({ error: "Token inválido o no encontrado" }, { status: 404 });
  }

  const documento = firmante.documento as any;

  // Documentos LM se firman en el portal de LM: aquí no se sirven.
  if (!documento || (documento.proveedor === "lm" && firmante.lm_signing_url)) {
    return NextResponse.json({ error: "Documento no disponible" }, { status: 404 });
  }

  if (tipo === "original") {
    if (firmante.estado === "firmado") {
      return NextResponse.json({ error: "Este documento ya fue firmado" }, { status: 400 });
    }
    if (firmante.estado === "rechazado") {
      return NextResponse.json({ error: "Este documento fue rechazado" }, { status: 400 });
    }
  } else if (firmante.estado !== "firmado") {
    return NextResponse.json({ error: "Documento no disponible" }, { status: 404 });
  }

  if (documento.fecha_expiracion && new Date(documento.fecha_expiracion) < new Date()) {
    return NextResponse.json({ error: "Este documento ha expirado" }, { status: 400 });
  }

  const ref: string | null =
    tipo === "firmado" ? documento.archivo_firmado_url : documento.archivo_url;
  if (!ref) return NextResponse.json({ error: "Documento no disponible" }, { status: 404 });

  const path = pathDeArchivo(ref);
  if (path) {
    const url = await urlFirmada(path, 300);
    if (!url) return NextResponse.json({ error: "Documento no disponible" }, { status: 404 });
    return NextResponse.redirect(url, { status: 302, headers: NO_STORE });
  }

  // ponytail: /api/firmas/{id}/documento-firmado es de staff (requiere sesión);
  // solo lo escribe la sincronización LM, que el firmante no usa aquí → 404.
  if (ref.startsWith("/api/firmas/")) {
    return NextResponse.json({ error: "Documento no disponible" }, { status: 404 });
  }

  return NextResponse.redirect(new URL(ref, req.url), { status: 302, headers: NO_STORE });
}
