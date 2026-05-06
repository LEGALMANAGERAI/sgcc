export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { PageHeader } from "@/components/ui/PageHeader";
import { AgendaGrid } from "./AgendaGrid";
import type { AgendaItem } from "./AgendaItemModal";

const HOURS = Array.from({ length: 11 }, (_, i) => i + 8); // 8am - 6pm
const DAY_LABELS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
const TZ = "America/Bogota";

function getWeekStart(dateStr?: string): Date {
  const d = dateStr ? new Date(dateStr + "T00:00:00") : new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getBogotaParts(iso: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date(iso));
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const hourStr = map.hour === "24" ? "00" : map.hour;
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    hour: parseInt(hourStr, 10),
    timeStr: `${hourStr}:${map.minute}`,
  };
}

interface Props {
  searchParams: Promise<{ week?: string }>;
}

export default async function AgendaPage({ searchParams }: Props) {
  const params = await searchParams;
  const session = await auth();
  const centerId = (session!.user as any).centerId;
  const sgccRol = (session!.user as any).sgccRol;
  const userId = (session!.user as any).id;

  const weekStart = getWeekStart(params.week);
  const weekEnd = addDays(weekStart, 7);
  const weekStartStr = formatDate(weekStart);
  const weekEndStr = formatDate(weekEnd);

  const prevWeek = formatDate(addDays(weekStart, -7));
  const nextWeek = formatDate(addDays(weekStart, 7));
  const today = formatDate(getWeekStart());

  // Audiencias de la semana
  let hearingsQuery = supabaseAdmin
    .from("sgcc_hearings")
    .select(`
      id, fecha_hora, duracion_min, estado, tipo, notas_previas,
      caso:sgcc_cases!inner(id, numero_radicado, center_id, archivado_at),
      sala:sgcc_rooms(nombre),
      conciliador:sgcc_staff(id, nombre)
    `)
    .eq("caso.center_id", centerId)
    .is("caso.archivado_at", null)
    .gte("fecha_hora", weekStart.toISOString())
    .lt("fecha_hora", weekEnd.toISOString())
    .order("fecha_hora", { ascending: true });

  if (sgccRol === "conciliador") {
    const email = (session!.user as any).email as string | undefined;
    const ids = new Set<string>();
    if (userId) ids.add(userId);
    if (email) {
      const { data: staffRows } = await supabaseAdmin
        .from("sgcc_staff")
        .select("id")
        .ilike("email", email)
        .eq("center_id", centerId);
      for (const s of staffRows ?? []) ids.add(s.id);
    }
    hearingsQuery = hearingsQuery.in("conciliador_id", Array.from(ids));
  }

  // Items de agenda (compromisos / pendientes)
  let itemsQuery = supabaseAdmin
    .from("sgcc_agenda_items")
    .select(
      `id, tipo, titulo, descripcion, fecha, hora_inicio, duracion_min, caso_id,
       completado, completado_at, staff_id, created_at, updated_at`
    )
    .eq("center_id", centerId)
    .gte("fecha", weekStartStr)
    .lt("fecha", weekEndStr);

  if (sgccRol === "conciliador") {
    itemsQuery = itemsQuery.eq("staff_id", userId);
  }

  // Casos del centro para el dropdown del modal
  const casosQuery = supabaseAdmin
    .from("sgcc_cases")
    .select("id, numero_radicado")
    .eq("center_id", centerId)
    .is("archivado_at", null)
    .order("numero_radicado", { ascending: false })
    .limit(200);

  const [{ data: audiencias }, { data: itemsRaw }, { data: casos }] = await Promise.all([
    hearingsQuery,
    itemsQuery,
    casosQuery,
  ]);

  // Normalizar audiencias: aplanar y derivar fecha+hora locales
  const hearings = (audiencias ?? []).map((h: any) => {
    const { date, hour, timeStr } = getBogotaParts(h.fecha_hora as string);
    return {
      id: h.id as string,
      caso_id: (h.caso?.id as string | null) ?? null,
      caso_radicado: (h.caso?.numero_radicado as string | null) ?? null,
      conciliador_nombre: (h.conciliador?.nombre as string | null) ?? null,
      sala_nombre: (h.sala?.nombre as string | null) ?? null,
      estado: h.estado as string,
      _dateKey: date,
      _hour: hour,
      _timeStr: timeStr,
    };
  });

  const items: AgendaItem[] = (itemsRaw ?? []).map((it: any) => ({
    id: it.id,
    tipo: it.tipo,
    titulo: it.titulo,
    descripcion: it.descripcion,
    fecha: it.fecha,
    hora_inicio: it.hora_inicio,
    duracion_min: it.duracion_min,
    caso_id: it.caso_id,
    completado: it.completado,
    staff_id: it.staff_id,
  }));

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    return {
      date: formatDate(d),
      label: DAY_LABELS[i],
      dayNum: d.getDate(),
      month: d.toLocaleDateString("es-CO", { month: "short" }),
    };
  });

  return (
    <div>
      <PageHeader
        title="Agenda"
        subtitle={
          sgccRol === "conciliador"
            ? "Mis audiencias y compromisos"
            : "Audiencias, compromisos y pendientes del centro"
        }
      />

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <a
            href={`/agenda?week=${prevWeek}`}
            className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
          >
            ← Anterior
          </a>
          <a
            href={`/agenda?week=${today}`}
            className="bg-[#0D2340] text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-[#0d2340dd] transition-colors"
          >
            Hoy
          </a>
          <a
            href={`/agenda?week=${nextWeek}`}
            className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
          >
            Siguiente →
          </a>
        </div>
        <div className="text-sm text-gray-600 font-medium">
          {weekStart.toLocaleDateString("es-CO", { day: "numeric", month: "long" })} —{" "}
          {addDays(weekStart, 6).toLocaleDateString("es-CO", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-3">
        Haz clic en una celda vacía para agregar un compromiso o pendiente. Click sobre uno
        existente para editarlo.
      </p>

      <AgendaGrid
        weekDays={weekDays}
        hours={HOURS}
        hearings={hearings}
        items={items}
        casos={(casos ?? []) as any}
        currentStaffId={userId}
        todayKey={formatDate(new Date())}
      />
    </div>
  );
}
