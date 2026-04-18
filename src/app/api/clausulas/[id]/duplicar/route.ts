import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId, isAdmin } from "@/lib/server-utils";
import { randomUUID } from "crypto";

/**
 * POST /api/clausulas/[id]/duplicar
 * Duplica una cláusula (global o del centro) como nueva cláusula del centro
 * para que pueda personalizarse. Solo admin.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  }

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id } = await params;

  const { data: original, error: fetchError } = await supabaseAdmin
    .from("sgcc_clausulas")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !original) {
    return NextResponse.json({ error: "Cláusula no encontrada" }, { status: 404 });
  }

  // Solo se puede duplicar globales o propias (no de otros centros)
  if (original.center_id !== null && original.center_id !== centerId) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  const { data: copia, error } = await supabaseAdmin
    .from("sgcc_clausulas")
    .insert({
      id: randomUUID(),
      center_id: centerId,
      titulo: `${original.titulo} (personalizada)`,
      categoria: original.categoria,
      tipo_tramite: original.tipo_tramite,
      resultado_aplicable: original.resultado_aplicable,
      contenido: original.contenido,
      variables_requeridas: original.variables_requeridas,
      tags: original.tags,
      es_default: false,
      activo: true,
      created_by: (session.user as any).id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(copia, { status: 201 });
}
