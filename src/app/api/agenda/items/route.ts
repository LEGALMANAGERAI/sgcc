import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId, staffSoloVeSusCasos } from "@/lib/server-utils";

const TIPOS = new Set(["compromiso", "pendiente"]);

function lunesDeLaSemana(dateStr?: string | null): Date {
  const d = dateStr ? new Date(dateStr + "T00:00:00") : new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtFecha(d: Date): string {
  return d.toISOString().split("T")[0];
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro asignado" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const week = searchParams.get("week");

  const inicio = lunesDeLaSemana(week);
  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + 7);

  const userId = (session.user as any).id as string | undefined;

  let query = supabaseAdmin
    .from("sgcc_agenda_items")
    .select(
      `id, tipo, titulo, descripcion, fecha, hora_inicio, duracion_min, caso_id,
       completado, completado_at, staff_id, created_at, updated_at,
       caso:sgcc_cases(id, numero_radicado),
       creador:sgcc_staff!sgcc_agenda_items_staff_id_fkey(id, nombre, sgcc_rol)`
    )
    .eq("center_id", centerId)
    .gte("fecha", fmtFecha(inicio))
    .lt("fecha", fmtFecha(fin))
    .order("fecha", { ascending: true })
    .order("hora_inicio", { ascending: true, nullsFirst: true });

  // Conciliador solo ve los suyos. Admin/secretario ven todos los del centro.
  if (staffSoloVeSusCasos(session)) {
    if (!userId) return NextResponse.json({ items: [] });
    query = query.eq("staff_id", userId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    semana: { inicio: fmtFecha(inicio), fin: fmtFecha(fin) },
    items: data ?? [],
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro asignado" }, { status: 400 });

  const userId = (session.user as any).id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Sesión inválida" }, { status: 400 });

  const body = await req.json();
  const tipo = String(body.tipo ?? "").trim();
  const titulo = String(body.titulo ?? "").trim();
  const fecha = String(body.fecha ?? "").trim();

  if (!TIPOS.has(tipo)) {
    return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
  }
  if (!titulo) return NextResponse.json({ error: "Título requerido" }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ error: "Fecha inválida (YYYY-MM-DD)" }, { status: 400 });
  }

  const horaInicio = body.hora_inicio ? String(body.hora_inicio) : null;
  if (horaInicio && !/^\d{2}:\d{2}(:\d{2})?$/.test(horaInicio)) {
    return NextResponse.json({ error: "Hora inválida (HH:MM)" }, { status: 400 });
  }

  const duracion = Number.isFinite(body.duracion_min) ? Math.max(15, Math.min(600, body.duracion_min)) : 60;

  // Si caso_id viene, validar que pertenezca al mismo centro.
  let casoId: string | null = body.caso_id ? String(body.caso_id) : null;
  if (casoId) {
    const { data: caso } = await supabaseAdmin
      .from("sgcc_cases")
      .select("id, center_id")
      .eq("id", casoId)
      .maybeSingle();
    if (!caso || caso.center_id !== centerId) {
      return NextResponse.json({ error: "Expediente no pertenece al centro" }, { status: 400 });
    }
  }

  const { data, error } = await supabaseAdmin
    .from("sgcc_agenda_items")
    .insert({
      center_id: centerId,
      staff_id: userId,
      tipo,
      titulo,
      descripcion: body.descripcion ? String(body.descripcion) : null,
      fecha,
      hora_inicio: horaInicio,
      duracion_min: duracion,
      caso_id: casoId,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
