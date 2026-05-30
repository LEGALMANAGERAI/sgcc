import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enviarEmailRecordatorio } from "@/lib/emails-suscripcion";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Cron diario que envía recordatorios de vencimiento de plan por email.
 *
 * Tres hitos sobre sgcc_centers.plan_expires_at:
 *  - 7 días antes del vencimiento (entre hoy+7 y hoy+8)
 *  - Día 0 (venció hoy)
 *  - Día 7 vencido (a partir de hoy entra en modo solo lectura)
 *
 * Destinatario: admin del centro (sgcc_staff rol=admin). Fallback:
 * wompi_customer_email de la suscripción ACTIVA más reciente del centro.
 *
 * Auth: Bearer CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const msDia = 1000 * 60 * 60 * 24;

    const ventanas: Array<{ tipo: "7d_antes" | "dia_0" | "dia_7_vencido"; inicio: Date; fin: Date; diasRestantes: number }> = [
      { tipo: "7d_antes", inicio: new Date(hoy.getTime() + 7 * msDia), fin: new Date(hoy.getTime() + 8 * msDia), diasRestantes: 7 },
      { tipo: "dia_0", inicio: hoy, fin: new Date(hoy.getTime() + msDia), diasRestantes: 0 },
      { tipo: "dia_7_vencido", inicio: new Date(hoy.getTime() - 7 * msDia), fin: new Date(hoy.getTime() - 6 * msDia), diasRestantes: -7 },
    ];

    const resultados: Record<string, number> = {};

    for (const v of ventanas) {
      const { data: centros, error } = await supabaseAdmin
        .from("sgcc_centers")
        .select("id, nombre, tipo_tier, plan_expires_at")
        .gte("plan_expires_at", v.inicio.toISOString())
        .lt("plan_expires_at", v.fin.toISOString())
        .not("tipo_tier", "is", null);

      if (error) {
        console.error(`[cron/recordatorio-plan] error ${v.tipo}`, error);
        continue;
      }

      let enviados = 0;
      for (const centro of centros ?? []) {
        if (centro.tipo_tier === "SIGECC_ACADEMICO") continue;

        // Buscar admin del centro
        const { data: admin } = await supabaseAdmin
          .from("sgcc_staff")
          .select("email, nombre")
          .eq("center_id", centro.id)
          .eq("rol", "admin")
          .eq("activo", true)
          .limit(1)
          .maybeSingle();

        let to: string | null = admin?.email ?? null;
        let nombre: string | null = admin?.nombre ?? centro.nombre ?? null;

        if (!to) {
          // Fallback: email de la suscripción
          const { data: sus } = await supabaseAdmin
            .from("sgcc_suscripciones")
            .select("wompi_customer_email")
            .eq("center_id", centro.id)
            .eq("estado", "ACTIVA")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          to = sus?.wompi_customer_email ?? null;
        }

        if (!to) continue;

        await enviarEmailRecordatorio({
          to,
          nombre,
          planKey: centro.tipo_tier ?? "",
          tipo: v.tipo,
          diasRestantes: v.diasRestantes,
        });
        enviados++;
      }

      resultados[v.tipo] = enviados;
    }

    return NextResponse.json({ ok: true, ...resultados });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error desconocido";
    console.error("[cron/recordatorio-plan] error general", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
