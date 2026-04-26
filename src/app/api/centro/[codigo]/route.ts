import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

type Params = { params: Promise<{ codigo: string }> };

/**
 * GET /api/centro/[codigo]
 *
 * PÚBLICA — devuelve datos no sensibles del centro (logo, nombre, ciudad,
 * color de marca) para landing pages y botones embebibles. Si no existe
 * o está inactivo, 404.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { codigo } = await params;
  const codigoLimpio = codigo.trim();
  if (codigoLimpio.length < 4 || codigoLimpio.length > 16) {
    return NextResponse.json({ error: "Código inválido" }, { status: 400 });
  }

  // ilike para case-insensitive — el código se guarda en BD con la capitalización
  // que puso el creador del centro y no es seguro asumir mayúsculas.
  const { data: centro } = await supabaseAdmin
    .from("sgcc_centers")
    .select("id, codigo_corto, nombre, ciudad, departamento, logo_url, color_primario, color_secundario, activo")
    .ilike("codigo_corto", codigoLimpio)
    .maybeSingle();

  if (!centro || !centro.activo) {
    return NextResponse.json({ error: "Centro no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    id: centro.id,
    codigo_corto: centro.codigo_corto,
    nombre: centro.nombre,
    ciudad: centro.ciudad,
    departamento: centro.departamento,
    logo_url: centro.logo_url,
    color_primario: centro.color_primario,
    color_secundario: centro.color_secundario,
  });
}
