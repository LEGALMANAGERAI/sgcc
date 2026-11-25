import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { lmConfigured, lmDescargarConstancia } from "@/lib/firma/lm-client";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/firmas/[id]/constancia-entrega
 * Sirve el PDF "Constancia de entrega" (evidencia técnica de entrega) generado por Legal Manager.
 * Requiere sesión + pertenencia al centro (anti-IDOR).
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
    return NextResponse.json(
      { error: "La constancia de entrega solo existe para firmas hechas por Legal Manager" },
      { status: 400 },
    );
  }
  if (!lmConfigured()) {
    return NextResponse.json({ error: "La integración con Legal Manager no está configurada." }, { status: 503 });
  }

  let lmRes: Response;
  try {
    lmRes = await lmDescargarConstancia(documento.lm_solicitud_id);
  } catch {
    return NextResponse.json({ error: "No se pudo descargar la constancia de Legal Manager." }, { status: 502 });
  }
  if (!lmRes.ok || !lmRes.body) {
    return NextResponse.json({ error: `Legal Manager respondió ${lmRes.status}.` }, { status: 502 });
  }

  const nombre = (documento.nombre || "documento").replace(/[^\w.-]+/g, "_");
  return new Response(lmRes.body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="constancia-entrega-${nombre}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
