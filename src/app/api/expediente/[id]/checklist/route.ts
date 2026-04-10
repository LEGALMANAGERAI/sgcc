import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { randomUUID } from "crypto";

/**
 * PATCH /api/expediente/[id]/checklist
 * Marcar/desmarcar item de checklist para un caso.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: caseId } = await params;
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Solo staff
  if ((session.user as any).userType !== "staff") {
    return NextResponse.json(
      { error: "Solo el personal del centro puede gestionar checklists" },
      { status: 403 }
    );
  }

  const centerId = resolveCenterId(session);
  if (!centerId) {
    return NextResponse.json({ error: "Sin centro asignado" }, { status: 400 });
  }

  // Verificar que el caso existe y pertenece al centro
  const { data: caso } = await supabaseAdmin
    .from("sgcc_cases")
    .select("id, center_id")
    .eq("id", caseId)
    .eq("center_id", centerId)
    .single();

  if (!caso) {
    return NextResponse.json({ error: "Caso no encontrado" }, { status: 404 });
  }

  const body = await req.json();
  const { checklist_id, item_index, completado, notas, documento_id } = body;

  if (!checklist_id || item_index === undefined || item_index === null) {
    return NextResponse.json(
      { error: "checklist_id e item_index son requeridos" },
      { status: 400 }
    );
  }

  const userId = (session.user as any).id;
  const now = new Date().toISOString();

  // Upsert parcial en sgcc_checklist_responses
  const upsertData: Record<string, any> = {
    case_id: caseId,
    checklist_id,
    item_index,
    updated_at: now,
  };

  // Solo actualizar campos que vienen en el body
  if (completado !== undefined) {
    upsertData.completado = !!completado;
    if (completado) {
      upsertData.verificado_por_staff = userId;
      upsertData.completed_at = now;
    } else {
      upsertData.verificado_por_staff = null;
      upsertData.completed_at = null;
    }
  }
  if (notas !== undefined) upsertData.notas = notas;
  if (documento_id !== undefined) upsertData.documento_id = documento_id;

  // Intentar buscar registro existente
  const { data: existing } = await supabaseAdmin
    .from("sgcc_checklist_responses")
    .select("id")
    .eq("case_id", caseId)
    .eq("checklist_id", checklist_id)
    .eq("item_index", item_index)
    .single();

  let result;
  let error;

  if (existing) {
    // Update
    const { data, error: updateError } = await supabaseAdmin
      .from("sgcc_checklist_responses")
      .update(upsertData)
      .eq("id", existing.id)
      .select()
      .single();
    result = data;
    error = updateError;
  } else {
    // Insert
    upsertData.id = randomUUID();
    upsertData.created_at = now;
    const { data, error: insertError } = await supabaseAdmin
      .from("sgcc_checklist_responses")
      .insert(upsertData)
      .select()
      .single();
    result = data;
    error = insertError;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(result);
}
