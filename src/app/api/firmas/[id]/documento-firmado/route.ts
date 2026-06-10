import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { lmConfigured, lmDescargarDocumento } from "@/lib/firma/lm-client";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/firmas/[id]/documento-firmado
 * Sirve el PDF firmado de un documento gestionado por Legal Manager (proveedor "lm").
 * Pide a LM el documento en cada solicitud (las signed URL de LM caducan rápido),
 * así el enlace de descarga nunca queda roto. Requiere sesión + pertenencia al centro.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id } = await params;

  const { data: documento } = await supabaseAdmin
    .from("sgcc_firma_documentos")
    .select("id, nombre, proveedor, lm_solicitud_id")
    .eq("id", id)
    .eq("center_id", centerId)
    .single();

  if (!documento) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  if (documento.proveedor !== "lm" || !documento.lm_solicitud_id) {
    return NextResponse.json({ error: "El documento no tiene PDF firmado en Legal Manager." }, { status: 404 });
  }
  if (!lmConfigured()) {
    return NextResponse.json({ error: "La integración con Legal Manager no está configurada." }, { status: 503 });
  }

  let lmRes: Response;
  try {
    lmRes = await lmDescargarDocumento(documento.lm_solicitud_id);
  } catch {
    return NextResponse.json({ error: "No se pudo descargar el documento de Legal Manager." }, { status: 502 });
  }

  if (lmRes.status === 409) {
    return NextResponse.json({ error: "El documento aún no tiene firmas." }, { status: 409 });
  }
  if (!lmRes.ok || !lmRes.body) {
    return NextResponse.json({ error: `Legal Manager respondió ${lmRes.status}.` }, { status: 502 });
  }

  const filename = `${(documento.nombre || "documento").replace(/[^\w.-]+/g, "_")}-firmado.pdf`;
  return new Response(lmRes.body, {
    status: 200,
    headers: {
      "Content-Type": lmRes.headers.get("content-type") || "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
