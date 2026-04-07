import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro asignado" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const weekParam = searchParams.get("week");

  // Calcular lunes de la semana
  const baseDate = weekParam ? new Date(weekParam + "T00:00:00") : new Date();
  const day = baseDate.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  baseDate.setDate(baseDate.getDate() + diff);
  baseDate.setHours(0, 0, 0, 0);

  const weekStart = baseDate.toISOString().split("T")[0];
  const weekEndDate = new Date(baseDate);
  weekEndDate.setDate(weekEndDate.getDate() + 7);
  const weekEnd = weekEndDate.toISOString().split("T")[0];

  const sgccRol = (session.user as any).sgccRol;
  const userId = (session.user as any).id;

  let query = supabaseAdmin
    .from("sgcc_hearings")
    .select(`
      id, fecha, hora_inicio, hora_fin, estado, motivo,
      caso:sgcc_cases!sgcc_hearings_case_id_fkey(id, numero_radicado, materia, estado),
      sala:sgcc_rooms!sgcc_hearings_sala_id_fkey(id, nombre, tipo),
      conciliador:sgcc_staff!sgcc_hearings_conciliador_id_fkey(id, nombre, email)
    `)
    .eq("center_id", centerId)
    .gte("fecha", weekStart)
    .lt("fecha", weekEnd)
    .order("fecha", { ascending: true })
    .order("hora_inicio", { ascending: true });

  // Si es conciliador, solo sus audiencias
  if (sgccRol === "conciliador") {
    query = query.eq("conciliador_id", userId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    semana: { inicio: weekStart, fin: weekEnd },
    audiencias: data ?? [],
    total: data?.length ?? 0,
  });
}
