import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId, isAdmin } from "@/lib/server-utils";
import { randomUUID } from "crypto";

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
 * GET /api/clausulas
 * Listar cláusulas del centro + globales. Filtros:
 *   ?categoria=...
 *   ?tipo_tramite=...
 *   ?resultado=acuerdo_total         (coincide si array es null o contiene el valor)
 *   ?search=texto                    (busca en titulo, contenido, tags)
 *   ?solo_activas=true (default)
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const categoria = searchParams.get("categoria");
  const tipoTramite = searchParams.get("tipo_tramite");
  const resultado = searchParams.get("resultado");
  const search = searchParams.get("search")?.trim();
  const soloActivas = searchParams.get("solo_activas") !== "false";

  let query = supabaseAdmin
    .from("sgcc_clausulas")
    .select("*")
    .or(`center_id.eq.${centerId},center_id.is.null`);

  if (soloActivas) query = query.eq("activo", true);
  if (categoria) query = query.eq("categoria", categoria);
  if (tipoTramite) {
    // Aplica la cláusula si tipo_tramite es null (cualquiera) o coincide
    query = query.or(`tipo_tramite.eq.${tipoTramite},tipo_tramite.is.null`);
  }
  if (search) {
    // Buscar en título, contenido o tags (array de texto)
    query = query.or(
      `titulo.ilike.%${search}%,contenido.ilike.%${search}%,tags.cs.{${search}}`
    );
  }

  query = query.order("categoria").order("titulo");

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let result = data ?? [];

  // Filtrar por resultado en memoria: array PostgreSQL con operadores OR se vuelve
  // ruidoso; lo hacemos aquí porque la lista total por centro es pequeña.
  if (resultado) {
    result = result.filter(
      (c: any) =>
        c.resultado_aplicable === null ||
        (Array.isArray(c.resultado_aplicable) &&
          c.resultado_aplicable.includes(resultado))
    );
  }

  return NextResponse.json(result);
}

/**
 * POST /api/clausulas
 * Crear nueva cláusula para el centro. Solo admin.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  }

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const body = await req.json();
  const {
    titulo,
    categoria,
    tipo_tramite,
    resultado_aplicable,
    contenido,
    tags,
  } = body;

  if (!titulo?.trim()) {
    return NextResponse.json({ error: "El título es requerido" }, { status: 400 });
  }
  if (!categoria || !CATEGORIAS_VALIDAS.includes(categoria)) {
    return NextResponse.json(
      { error: `Categoría inválida. Opciones: ${CATEGORIAS_VALIDAS.join(", ")}` },
      { status: 400 }
    );
  }
  if (!contenido?.trim()) {
    return NextResponse.json({ error: "El contenido es requerido" }, { status: 400 });
  }
  if (tipo_tramite && !TRAMITES_VALIDOS.includes(tipo_tramite)) {
    return NextResponse.json(
      { error: `Trámite inválido. Opciones: ${TRAMITES_VALIDOS.join(", ")} o null` },
      { status: 400 }
    );
  }
  if (resultado_aplicable) {
    if (!Array.isArray(resultado_aplicable)) {
      return NextResponse.json({ error: "resultado_aplicable debe ser array" }, { status: 400 });
    }
    const invalidos = resultado_aplicable.filter((r: string) => !RESULTADOS_VALIDOS.includes(r));
    if (invalidos.length) {
      return NextResponse.json(
        { error: `Resultados inválidos: ${invalidos.join(", ")}` },
        { status: 400 }
      );
    }
  }

  const variablesRequeridas = extractTokens(contenido);

  const { data, error } = await supabaseAdmin
    .from("sgcc_clausulas")
    .insert({
      id: randomUUID(),
      center_id: centerId,
      titulo: titulo.trim(),
      categoria,
      tipo_tramite: tipo_tramite ?? null,
      resultado_aplicable: resultado_aplicable ?? null,
      contenido: contenido.trim(),
      variables_requeridas: variablesRequeridas,
      tags: Array.isArray(tags) ? tags.map((t: string) => t.trim()).filter(Boolean) : [],
      es_default: false,
      activo: true,
      created_by: (session.user as any).id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
