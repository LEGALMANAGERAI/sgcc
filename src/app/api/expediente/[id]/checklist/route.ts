import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { guardCasoStaff } from "@/lib/server-utils";
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
  const g = await guardCasoStaff(session, caseId);
  if ("error" in g) return g.error;

  const body = await req.json();
  const { checklist_id, item_index, completado, notas, documento_id } = body;

  if (!checklist_id || item_index === undefined || item_index === null) {
    return NextResponse.json(
      { error: "checklist_id e item_index son requeridos" },
      { status: 400 }
    );
  }

  const userId = (session!.user as any).id;
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
