import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";

/**
 * GET /api/expediente/[id]/acreencias/[acreenciaId]/detalle-edicion
 *
 * Devuelve los datos completos del acreedor para precargar el modal de edicion:
 *   - acreencia (basicos)
 *   - party (email, telefono, direccion, ciudad, etc. — datos personales)
 *   - apoderado activo (si existe): attorney + case_attorney + signed URL del PDF
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; acreenciaId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id: caseId, acreenciaId } = await params;

  // 1. Acreencia (validar que pertenece al caso + centro)
  const { data: acreencia } = await supabaseAdmin
    .from("sgcc_acreencias")
    .select("id, case_id, center_id, party_id, acreedor_tipo, acreedor_nombre, acreedor_documento")
    .eq("id", acreenciaId)
    .eq("case_id", caseId)
    .eq("center_id", centerId)
    .maybeSingle();

  if (!acreencia) {
    return NextResponse.json({ error: "Acreencia no encontrada" }, { status: 404 });
  }

  // 2. Party (si la acreencia ya esta vinculada a una parte)
  let party: any = null;
  if (acreencia.party_id) {
    const { data: partyRow } = await supabaseAdmin
      .from("sgcc_parties")
      .select(
        "id, tipo_persona, nombres, apellidos, razon_social, tipo_doc, numero_doc, nit_empresa, email, telefono, direccion, ciudad",
      )
      .eq("id", acreencia.party_id)
      .maybeSingle();
    party = partyRow ?? null;
  }

  // 3. Apoderado activo en este caso (si la party existe)
  let apoderado: any = null;
  if (acreencia.party_id) {
    const { data: caRow } = await supabaseAdmin
      .from("sgcc_case_attorneys")
      .select(
        "id, attorney_id, poder_url, poder_vigente_desde, poder_vigente_hasta, attorney:sgcc_attorneys(id, nombre, tipo_doc, numero_doc, tarjeta_profesional, email, telefono)",
      )
      .eq("case_id", caseId)
      .eq("party_id", acreencia.party_id)
      .eq("activo", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (caRow) {
      apoderado = {
        case_attorney_id: caRow.id,
        attorney_id: caRow.attorney_id,
        poder_url: caRow.poder_url ? `/api/apoderados-poder/${caRow.id}/view` : null,
        poder_vigente_desde: caRow.poder_vigente_desde,
        poder_vigente_hasta: caRow.poder_vigente_hasta,
        attorney: caRow.attorney ?? null,
      };
    }
  }

  return NextResponse.json({ acreencia, party, apoderado });
}
