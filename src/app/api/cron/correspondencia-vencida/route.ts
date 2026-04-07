import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/cron/correspondencia-vencida
 *
 * Endpoint para marcar correspondencia vencida automaticamente.
 * Diseñado para ejecutarse via Vercel Cron.
 *
 * Busca correspondencia donde:
 * - fecha_limite_respuesta < NOW()
 * - estado IN ('recibido', 'en_tramite')
 *
 * Actualiza estado → 'vencido'
 */
export async function GET(req: NextRequest) {
  // Verificar CRON_SECRET si esta configurado
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  const now = new Date().toISOString();

  try {
    // Buscar correspondencia vencida que aun no esta marcada como tal
    const { data: vencidas, error: fetchError } = await supabaseAdmin
      .from("sgcc_correspondence")
      .select("id, tipo, asunto, center_id")
      .lt("fecha_limite_respuesta", now)
      .in("estado", ["recibido", "en_tramite"])
      .not("fecha_limite_respuesta", "is", null);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!vencidas || vencidas.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No hay correspondencia vencida para actualizar",
        actualizadas: 0,
      });
    }

    // Actualizar todas a estado 'vencido'
    const ids = vencidas.map((v: any) => v.id);
    const { error: updateError } = await supabaseAdmin
      .from("sgcc_correspondence")
      .update({ estado: "vencido" })
      .in("id", ids);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Log de lo que se actualizo
    const resumen = vencidas.map((v: any) => ({
      id: v.id,
      tipo: v.tipo,
      asunto: v.asunto,
    }));

    return NextResponse.json({
      ok: true,
      message: `${vencidas.length} correspondencia(s) marcada(s) como vencida(s)`,
      actualizadas: vencidas.length,
      detalle: resumen,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Error en cron: ${err.message}` },
      { status: 500 }
    );
  }
}
