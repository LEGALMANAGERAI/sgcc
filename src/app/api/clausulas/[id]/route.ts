import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId, isAdmin } from "@/lib/server-utils";

const CATEGORIAS_VALIDAS = [
  "preambulo",
  "identificacion_partes",
  "consideraciones",
  "obligacion_dar",
  "obligacion_hacer",
  "obligacion_no_hacer",
  "garantias",
  "clausula_penal",
  "confidencialidad",
  "domicilio_notificaciones",
  "desistimiento",
  "inasistencia",
  "cierre",
  "insolvencia_acuerdo_pago",
  "insolvencia_liquidacion",
  "apoyo_decision",
  "otro",
];

const TRAMITES_VALIDOS = ["conciliacion", "insolvencia", "acuerdo_apoyo", "arbitraje_ejecutivo"];

const RESULTADOS_VALIDOS = [
  "acuerdo_total",
  "acuerdo_parcial",
  "no_acuerdo",
  "inasistencia",
  "desistimiento",
  "improcedente",
];

function extractTokens(content: string): string[] {
  const matches = content.match(/\{\{([^}]+)\}\}/g) ?? [];
  return [...new Set(matches.map((m) => m.replace(/[{}]/g, "").trim()))];
}

/**
 * GET /api/clausulas/[id]
 * Detalle. Accesible si la cláusula es global o del centro.
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
    .from("sgcc_clausulas")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Cláusula no encontrada" }, { status: 404 });
  }

  // Acceso: global (null) o del centro del usuario
  if (data.center_id !== null && data.center_id !== centerId) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  return NextResponse.json(data);
}

/**
 * PATCH /api/clausulas/[id]
 * Actualizar cláusula. Solo admin y solo cláusulas del centro (globales son inmutables).
 */
export async function PATCH(
  req: NextRequest,
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
  const body = await req.json();

  const { data: existing } = await supabaseAdmin
    .from("sgcc_clausulas")
    .select("id, center_id")
    .eq("id", id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Cláusula no encontrada" }, { status: 404 });
  }

  if (existing.center_id === null) {
    return NextResponse.json(
      { error: "Las cláusulas globales no son editables. Duplíquela para personalizar." },
      { status: 403 }
    );
  }

  if (existing.center_id !== centerId) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  const updates: Record<string, any> = {};

  if (body.titulo !== undefined) {
    if (!body.titulo?.trim()) {
      return NextResponse.json({ error: "El título no puede quedar vacío" }, { status: 400 });
    }
    updates.titulo = body.titulo.trim();
  }

  if (body.categoria !== undefined) {
    if (!CATEGORIAS_VALIDAS.includes(body.categoria)) {
      return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
    }
    updates.categoria = body.categoria;
  }

  if (body.tipo_tramite !== undefined) {
    if (body.tipo_tramite !== null && !TRAMITES_VALIDOS.includes(body.tipo_tramite)) {
      return NextResponse.json({ error: "Trámite inválido" }, { status: 400 });
    }
    updates.tipo_tramite = body.tipo_tramite;
  }

  if (body.resultado_aplicable !== undefined) {
    if (body.resultado_aplicable !== null) {
      if (!Array.isArray(body.resultado_aplicable)) {
        return NextResponse.json({ error: "resultado_aplicable debe ser array o null" }, { status: 400 });
      }
      const invalidos = body.resultado_aplicable.filter(
        (r: string) => !RESULTADOS_VALIDOS.includes(r)
      );
      if (invalidos.length) {
        return NextResponse.json(
          { error: `Resultados inválidos: ${invalidos.join(", ")}` },
          { status: 400 }
        );
      }
    }
    updates.resultado_aplicable = body.resultado_aplicable;
  }

  if (body.contenido !== undefined) {
    if (!body.contenido?.trim()) {
      return NextResponse.json({ error: "El contenido no puede quedar vacío" }, { status: 400 });
    }
    updates.contenido = body.contenido.trim();
    updates.variables_requeridas = extractTokens(updates.contenido);
  }

  if (body.tags !== undefined) {
    updates.tags = Array.isArray(body.tags)
      ? body.tags.map((t: string) => t.trim()).filter(Boolean)
      : [];
  }

  if (body.activo !== undefined) {
    updates.activo = Boolean(body.activo);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("sgcc_clausulas")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

/**
 * DELETE /api/clausulas/[id]
 * Soft-delete (marca activo=false). Solo del centro, solo admin.
 */
export async function DELETE(
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

  const { data: existing } = await supabaseAdmin
    .from("sgcc_clausulas")
    .select("id, center_id")
    .eq("id", id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Cláusula no encontrada" }, { status: 404 });
  }

  if (existing.center_id === null) {
    return NextResponse.json(
      { error: "No se pueden eliminar cláusulas globales" },
      { status: 403 }
    );
  }

  if (existing.center_id !== centerId) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from("sgcc_clausulas")
    .update({ activo: false })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
