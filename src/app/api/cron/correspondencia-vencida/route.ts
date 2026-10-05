import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { BOGOTA_TZ } from "@/lib/fecha-colombia";
import { notify } from "@/lib/notifications";

/**
 * GET /api/cron/correspondencia-vencida  (Vercel Cron, diario 6:00 a. m. Colombia)
 *
 * 1. Marca 'vencido' lo pendiente (recibido / en_tramite) cuya fecha límite ya
 *    pasó (antes de HOY en Colombia; lo que vence hoy sigue vigente todo el día).
 * 2. Avisa a cada responsable (o a los admins del centro si no tiene) con un
 *    resumen: lo que se venció y lo que vence hoy o mañana.
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

  // Fechas de calendario en Colombia (YYYY-MM-DD), comparables con la columna DATE.
  const ymd = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: BOGOTA_TZ });
  const hoy = ymd(new Date());
  const manana = ymd(new Date(Date.now() + 24 * 60 * 60 * 1000));

  try {
    const { data: pendientes, error } = await supabaseAdmin
      .from("sgcc_correspondence")
      .select("id, tipo, asunto, center_id, case_id, fecha_limite_respuesta, responsable_staff_id")
      .in("estado", ["recibido", "en_tramite"])
      .not("fecha_limite_respuesta", "is", null)
      .lte("fecha_limite_respuesta", manana);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const vencidas = (pendientes ?? []).filter((c) => c.fecha_limite_respuesta < hoy);
    const porVencer = (pendientes ?? []).filter((c) => c.fecha_limite_respuesta >= hoy);

    if (vencidas.length) {
      const { error: updErr } = await supabaseAdmin
        .from("sgcc_correspondence")
        .update({ estado: "vencido" })
        .in("id", vencidas.map((v) => v.id));
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    // Agrupar por destinatario: responsable, o admins del centro si no hay.
    const TIPO: Record<string, string> = {
      tutela: "Tutela",
      derecho_peticion: "Derecho de petición",
      requerimiento: "Requerimiento",
      oficio: "Oficio",
    };
    const linea = (c: any, cuando: string) => `• ${TIPO[c.tipo] ?? c.tipo}: ${c.asunto} — ${cuando}`;
    const porDestino = new Map<string, { centerId: string; lineas: string[] }>();
    const adminsCache = new Map<string, string[]>();

    const destinosDe = async (c: any): Promise<string[]> => {
      if (c.responsable_staff_id) return [c.responsable_staff_id];
      if (!adminsCache.has(c.center_id)) {
        const { data } = await supabaseAdmin
          .from("sgcc_staff")
          .select("id")
          .eq("center_id", c.center_id)
          .eq("rol", "admin")
          .eq("activo", true);
        adminsCache.set(c.center_id, (data ?? []).map((a) => a.id));
      }
      return adminsCache.get(c.center_id)!;
    };

    const agregar = async (c: any, cuando: string) => {
      for (const id of await destinosDe(c)) {
        const d = porDestino.get(id) ?? { centerId: c.center_id as string, lineas: [] as string[] };
        d.lineas.push(linea(c, cuando));
        porDestino.set(id, d);
      }
    };
    for (const c of vencidas) await agregar(c, `VENCIDA (límite ${c.fecha_limite_respuesta})`);
    for (const c of porVencer) await agregar(c, c.fecha_limite_respuesta === hoy ? "vence HOY" : "vence mañana");

    if (porDestino.size) {
      const { data: staff } = await supabaseAdmin
        .from("sgcc_staff")
        .select("id, email")
        .in("id", Array.from(porDestino.keys()));
      const emailDe = new Map((staff ?? []).map((s) => [s.id, s.email]));
      for (const [staffId, d] of porDestino) {
        await notify({
          centerId: d.centerId,
          tipo: "correspondencia_vencida",
          titulo: `Correspondencia con término: ${d.lineas.length} pendiente(s)`,
          mensaje: `Tienes correspondencia jurídica que requiere atención:\n\n${d.lineas.join("\n")}\n\nRevísala en el módulo Correspondencia.`,
          recipients: [{ staffId, email: emailDe.get(staffId) }],
        });
      }
    }

    return NextResponse.json({
      ok: true,
      hoy,
      marcadas_vencidas: vencidas.length,
      por_vencer: porVencer.length,
      avisos_enviados: porDestino.size,
    });
  } catch (err: any) {
    return NextResponse.json({ error: `Error en cron: ${err.message}` }, { status: 500 });
  }
}
