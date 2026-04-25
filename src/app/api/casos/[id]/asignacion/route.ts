import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { randomUUID } from "crypto";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/casos/[id]/asignacion
 *
 * Permite al admin/secretario asignar o cambiar el conciliador y/o secretario
 * de un expediente. Body opcional:
 *   { conciliador_id?: string | null, secretario_id?: string | null }
 *
 * Cualquier campo omitido no se toca. Pasar null limpia la designación.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rol = (session.user as any).sgccRol as string | undefined;
  if (rol !== "admin" && rol !== "secretario") {
    return NextResponse.json(
      { error: "Solo admin o secretario pueden cambiar la designación" },
      { status: 403 },
    );
  }

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id: caseId } = await params;
  const body = await req.json().catch(() => ({}));

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  let touched = false;

  if (Object.prototype.hasOwnProperty.call(body, "conciliador_id")) {
    const v = body.conciliador_id;
    if (v !== null && v !== undefined) {
      const { data: staff } = await supabaseAdmin
        .from("sgcc_staff")
        .select("id, rol, activo, center_id")
        .eq("id", v)
        .single();
      if (!staff || staff.center_id !== centerId || !staff.activo) {
        return NextResponse.json({ error: "Conciliador inválido" }, { status: 400 });
      }
    }
    updates.conciliador_id = v ?? null;
    touched = true;
  }

  if (Object.prototype.hasOwnProperty.call(body, "secretario_id")) {
    const v = body.secretario_id;
    if (v !== null && v !== undefined) {
      const { data: staff } = await supabaseAdmin
        .from("sgcc_staff")
        .select("id, activo, center_id")
        .eq("id", v)
        .single();
      if (!staff || staff.center_id !== centerId || !staff.activo) {
        return NextResponse.json({ error: "Secretario inválido" }, { status: 400 });
      }
    }
    updates.secretario_id = v ?? null;
    touched = true;
  }

  if (!touched) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  const { data: caso, error } = await supabaseAdmin
    .from("sgcc_cases")
    .update(updates)
    .eq("id", caseId)
    .eq("center_id", centerId)
    .select(
      "id, conciliador_id, secretario_id, conciliador:sgcc_staff!sgcc_cases_conciliador_id_fkey(id, nombre), secretario:sgcc_staff!sgcc_cases_secretario_id_fkey(id, nombre)",
    )
    .single();

  if (error || !caso) {
    return NextResponse.json({ error: error?.message ?? "Error al actualizar" }, { status: 500 });
  }

  // Timeline
  await supabaseAdmin.from("sgcc_case_timeline").insert({
    id: randomUUID(),
    case_id: caseId,
    etapa: "audiencia",
    descripcion:
      Object.prototype.hasOwnProperty.call(body, "conciliador_id") && Object.prototype.hasOwnProperty.call(body, "secretario_id")
        ? "Designación de conciliador y secretario actualizada"
        : Object.prototype.hasOwnProperty.call(body, "conciliador_id")
          ? "Designación de conciliador actualizada"
          : "Designación de secretario actualizada",
    completado: true,
    fecha: new Date().toISOString(),
    referencia_id: caseId,
    created_at: new Date().toISOString(),
  });

  return NextResponse.json(caso);
}
