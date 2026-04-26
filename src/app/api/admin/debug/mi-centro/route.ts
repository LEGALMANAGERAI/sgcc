import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";

/**
 * GET /api/admin/debug/mi-centro
 *
 * Devuelve el centro del admin logueado con su codigo_corto exacto
 * (incluye representacion JSON con quotes para detectar espacios o
 * caracteres invisibles), estado activo y un test de busqueda con
 * ilike "3MUQYXLC" para validar el matching.
 */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rol = (session.user as any).sgccRol as string | undefined;
  if (rol !== "admin" && rol !== "secretario") {
    return NextResponse.json({ error: "Solo admin o secretario" }, { status: 403 });
  }

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { data: centro } = await supabaseAdmin
    .from("sgcc_centers")
    .select("id, codigo_corto, nombre, activo, ciudad, departamento")
    .eq("id", centerId)
    .single();

  // Test paralelo: buscar por ilike el codigo_corto que devuelve la fila
  const codigoQueDeberiaServir = centro?.codigo_corto ?? "";
  const { data: porIlike } = await supabaseAdmin
    .from("sgcc_centers")
    .select("id, codigo_corto, activo")
    .ilike("codigo_corto", codigoQueDeberiaServir);

  // Listar TODOS los centros activos del proyecto para descartar duplicados
  const { data: todosActivos } = await supabaseAdmin
    .from("sgcc_centers")
    .select("id, codigo_corto, nombre, activo")
    .eq("activo", true);

  return NextResponse.json({
    centro,
    codigo_con_quotes: centro?.codigo_corto ? JSON.stringify(centro.codigo_corto) : null,
    longitud_codigo: centro?.codigo_corto?.length ?? null,
    test_busqueda_ilike: porIlike,
    total_centros_activos: todosActivos?.length ?? 0,
    centros_activos_con_codigo_similar: (todosActivos ?? []).filter((c) =>
      c.codigo_corto?.toLowerCase().includes("3muqy"),
    ),
  });
}
