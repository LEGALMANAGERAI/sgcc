import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { randomUUID } from "crypto";

type Params = { params: Promise<{ id: string }> };

const MOTIVO_MIN = 20;

/**
 * POST /api/casos/[id]/eliminar
 *
 * Soft delete del expediente con auditoría.
 *  - Solo admin del mismo centro.
 *  - Body: { motivo: string } con mínimo 20 caracteres.
 *  - Setea archivado_at, archivado_por, motivo_archivado en sgcc_cases.
 *  - Registra evento en sgcc_case_timeline con email + nombre del admin.
 *  - Las filas NO se borran — la restauración se hace vía SQL en Supabase
 *    cuando el admin la solicite a los desarrolladores.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rol = (session.user as any).sgccRol as string | undefined;
  if (rol !== "admin") {
    return NextResponse.json({ error: "Solo admin puede eliminar expedientes" }, { status: 403 });
  }

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id: caseId } = await params;
  const body = await req.json().catch(() => ({}));
  const motivo: string = (body?.motivo ?? "").toString().trim();

  if (motivo.length < MOTIVO_MIN) {
    return NextResponse.json(
      { error: `El motivo debe tener al menos ${MOTIVO_MIN} caracteres` },
      { status: 400 },
    );
  }

  // Verificar que el caso exista, sea del centro y NO esté ya archivado.
  const { data: caso } = await supabaseAdmin
    .from("sgcc_cases")
    .select("id, numero_radicado, archivado_at")
    .eq("id", caseId)
    .eq("center_id", centerId)
    .maybeSingle();

  if (!caso) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
  if (caso.archivado_at) {
    return NextResponse.json({ error: "El expediente ya estaba eliminado" }, { status: 400 });
  }

  const userId = (session.user as any).id;
  const userName = (session.user as any).name ?? "staff";
  const userEmail = (session.user as any).email ?? "";
  const now = new Date().toISOString();

  const { error: updErr } = await supabaseAdmin
    .from("sgcc_cases")
    .update({
      archivado_at: now,
      archivado_por: userId,
      motivo_archivado: motivo,
      updated_at: now,
    })
    .eq("id", caseId)
    .eq("center_id", centerId);

  if (updErr) {
    return NextResponse.json({ error: `Error al eliminar: ${updErr.message}` }, { status: 500 });
  }

  // Auditoría visible en el timeline del caso (queda para histórico)
  await supabaseAdmin.from("sgcc_case_timeline").insert({
    id: randomUUID(),
    case_id: caseId,
    etapa: "archivo",
    descripcion: `Expediente eliminado por ${userName} (${userEmail}). Motivo: ${motivo}`,
    completado: true,
    fecha: now,
    referencia_id: caseId,
    created_at: now,
  });

  return NextResponse.json({
    ok: true,
    numero_radicado: caso.numero_radicado,
    archivado_at: now,
  });
}
