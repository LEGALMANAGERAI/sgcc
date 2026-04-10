import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { randomUUID } from "crypto";

const TIPOS_VALIDOS = [
  "citacion",
  "acta_acuerdo",
  "acta_no_acuerdo",
  "acta_inasistencia",
  "constancia",
  "admision",
  "rechazo",
];

/**
 * GET /api/plantillas
 * Listar plantillas del centro + plantillas globales (center_id IS NULL).
 */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  // Plantillas del centro + globales (default)
  const { data, error } = await supabaseAdmin
    .from("sgcc_templates")
    .select("*")
    .or(`center_id.eq.${centerId},center_id.is.null`)
    .eq("activo", true)
    .order("tipo")
    .order("nombre");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}

/**
 * POST /api/plantillas
 * Crear nueva plantilla para el centro.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.sgccRol !== "admin") {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  }

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const body = await req.json();
  const { tipo, nombre, contenido } = body;

  if (!tipo || !TIPOS_VALIDOS.includes(tipo)) {
    return NextResponse.json({ error: `Tipo inválido. Opciones: ${TIPOS_VALIDOS.join(", ")}` }, { status: 400 });
  }
  if (!nombre?.trim()) {
    return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
  }
  if (!contenido?.trim()) {
    return NextResponse.json({ error: "El contenido es requerido" }, { status: 400 });
  }

  // Extraer variables {{...}} del contenido
  const variableMatches = contenido.match(/\{\{([^}]+)\}\}/g) ?? [];
  const variables = [...new Set(variableMatches.map((m: string) => m.replace(/[{}]/g, "")))];

  const { data, error } = await supabaseAdmin
    .from("sgcc_templates")
    .insert({
      id: randomUUID(),
      center_id: centerId,
      tipo,
      nombre: nombre.trim(),
      contenido: contenido.trim(),
      variables,
      es_default: false,
      activo: true,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
