import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import type { CorrespondenciaEstado } from "@/types";

/**
 * GET /api/correspondencia/[id]
 * Detalle de la correspondencia con todos sus documentos adjuntos.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from("sgcc_correspondence")
    .select(`
      *,
      responsable:sgcc_staff!sgcc_correspondence_responsable_staff_id_fkey(id, nombre, email),
      caso:sgcc_cases!sgcc_correspondence_case_id_fkey(id, numero_radicado, materia, estado),
      documentos:sgcc_correspondence_docs(*)
    `)
    .eq("id", id)
    .eq("center_id", centerId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Correspondencia no encontrada" }, { status: 404 });
  }

  return NextResponse.json(data);
}

/**
 * PATCH /api/correspondencia/[id]
 * Actualizar estado, notas o responsable de la correspondencia.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id } = await params;
  const body = await req.json();

  // Verificar que la correspondencia pertenece al centro
  const { data: existing } = await supabaseAdmin
    .from("sgcc_correspondence")
    .select("id, estado")
    .eq("id", id)
    .eq("center_id", centerId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Correspondencia no encontrada" }, { status: 404 });
  }

  // Construir objeto de actualizacion
  const updates: Record<string, any> = {};

  // Actualizar estado
  if (body.estado) {
    const estadosValidos: CorrespondenciaEstado[] = ["recibido", "en_tramite", "respondido", "vencido"];
    if (!estadosValidos.includes(body.estado)) {
      return NextResponse.json(
        { error: "Estado invalido. Debe ser: recibido, en_tramite, respondido o vencido" },
        { status: 400 }
      );
    }

    // Validar transiciones logicas
    const transiciones: Record<string, string[]> = {
      recibido: ["en_tramite", "respondido"],
      en_tramite: ["respondido"],
      respondido: [], // Estado final
      vencido: ["en_tramite", "respondido"], // Se puede retomar una vencida
    };

    const permitidas = transiciones[existing.estado] ?? [];
    if (!permitidas.includes(body.estado)) {
      return NextResponse.json(
        { error: `No se puede cambiar de "${existing.estado}" a "${body.estado}"` },
        { status: 400 }
      );
    }

    updates.estado = body.estado;
  }

  // Actualizar notas
  if (body.notas !== undefined) {
    updates.notas = body.notas?.trim() || null;
  }

  // Actualizar responsable
  if (body.responsable_staff_id !== undefined) {
    if (body.responsable_staff_id) {
      const { data: staffMember } = await supabaseAdmin
        .from("sgcc_staff")
        .select("id")
        .eq("id", body.responsable_staff_id)
        .eq("center_id", centerId)
        .eq("activo", true)
        .single();
      if (!staffMember) {
        return NextResponse.json({ error: "El responsable no existe en este centro" }, { status: 400 });
      }
    }
    updates.responsable_staff_id = body.responsable_staff_id || null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("sgcc_correspondence")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

/**
 * DELETE /api/correspondencia/[id]
 * Eliminar correspondencia (solo si no tiene caso vinculado activo).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id } = await params;

  // Verificar que la correspondencia pertenece al centro
  const { data: existing } = await supabaseAdmin
    .from("sgcc_correspondence")
    .select("id, case_id")
    .eq("id", id)
    .eq("center_id", centerId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Correspondencia no encontrada" }, { status: 404 });
  }

  // No permitir eliminar si tiene caso vinculado activo
  if (existing.case_id) {
    const { data: caso } = await supabaseAdmin
      .from("sgcc_cases")
      .select("id, estado")
      .eq("id", existing.case_id)
      .single();

    if (caso && caso.estado !== "cerrado" && caso.estado !== "rechazado") {
      return NextResponse.json(
        { error: "No se puede eliminar correspondencia vinculada a un caso activo" },
        { status: 400 }
      );
    }
  }

  // Eliminar documentos asociados primero
  await supabaseAdmin
    .from("sgcc_correspondence_docs")
    .delete()
    .eq("correspondence_id", id);

  // Eliminar la correspondencia
  const { error } = await supabaseAdmin
    .from("sgcc_correspondence")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
