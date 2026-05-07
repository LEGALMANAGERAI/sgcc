export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { PageHeader } from "@/components/ui/PageHeader";
import { AgendaGrid } from "./AgendaGrid";
import { AgendaMonthGrid } from "./AgendaMonthGrid";
import type { AgendaItem } from "./AgendaItemModal";
import { nombreFestivo, enVacanciaJudicial } from "@/lib/dias-habiles-colombia";

export interface DayMeta {
  tipoEspecial: "festivo" | "vacancia" | null;
  etiqueta: string | null;
}

function buildDayMetaMap(fechas: string[]): Record<string, DayMeta> {
  const out: Record<string, DayMeta> = {};
  for (const f of fechas) {
    const [y, m, d] = f.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const fest = nombreFestivo(date);
    if (fest) {
      out[f] = { tipoEspecial: "festivo", etiqueta: fest };
    } else if (enVacanciaJudicial(date)) {
      out[f] = { tipoEspecial: "vacancia", etiqueta: "Vacancia judicial" };
    } else {
      out[f] = { tipoEspecial: null, etiqueta: null };
    }
  }
  return out;
}

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
  searchParams: Promise<{ week?: string; month?: string; view?: string }>;
}

function parseMonthParam(monthParam?: string): { year: number; month: number } {
  // monthParam = YYYY-MM. Si no viene, usa el mes actual.
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    return { year: y, month: m - 1 };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

function buildMonthDays(year: number, month: number) {
  // Primer día del mes y su offset hasta lunes (lun=0)
  const firstOfMonth = new Date(year, month, 1);
  const firstDow = firstOfMonth.getDay(); // 0=dom, 1=lun
  const offsetToMonday = firstDow === 0 ? 6 : firstDow - 1;
  const gridStart = new Date(year, month, 1 - offsetToMonday);

  // Último día del mes y celdas restantes hasta completar 6 semanas (42 celdas)
  const days: { date: string; dayNum: number; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push({
      date: formatDate(d),
      dayNum: d.getDate(),
      inMonth: d.getMonth() === month,
    });
  }
  // Si la última fila completa solo tiene celdas fuera del mes, recortar a 5 semanas (35).
  const lastRowAllOut = days.slice(35).every((d) => !d.inMonth);
  return lastRowAllOut ? days.slice(0, 35) : days;
}

export default async function AgendaPage({ searchParams }: Props) {
  const params = await searchParams;
  const session = await auth();
  const centerId = (session!.user as any).centerId;
  const sgccRol = (session!.user as any).sgccRol;
  const userId = (session!.user as any).id;

  const view = params.view === "month" ? "month" : "week";

  const weekStart = getWeekStart(params.week);
  const weekEnd = addDays(weekStart, 7);

  // Para vista mensual, calcular rango del mes (incluye días de relleno)
  const { year: monthYear, month: monthNum } = parseMonthParam(params.month);
  const monthDays = view === "month" ? buildMonthDays(monthYear, monthNum) : [];
  const monthRangeStart = view === "month" ? new Date(monthDays[0].date + "T00:00:00") : weekStart;
  const monthRangeEnd =
    view === "month"
      ? addDays(new Date(monthDays[monthDays.length - 1].date + "T00:00:00"), 1)
      : weekEnd;

  // Rangos efectivos según vista
  const rangeStart = view === "month" ? monthRangeStart : weekStart;
  const rangeEnd = view === "month" ? monthRangeEnd : weekEnd;
  const rangeStartStr = formatDate(rangeStart);
  const rangeEndStr = formatDate(rangeEnd);

  const prevWeek = formatDate(addDays(weekStart, -7));
  const nextWeek = formatDate(addDays(weekStart, 7));
  const today = formatDate(getWeekStart());

  // Mes anterior / siguiente
  const prevMonthDate = new Date(monthYear, monthNum - 1, 1);
  const nextMonthDate = new Date(monthYear, monthNum + 1, 1);
  const prevMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}`;
  const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}`;
  const todayMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  // Audiencias del rango (semana o mes)
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
    .gte("fecha_hora", rangeStart.toISOString())
    .lt("fecha_hora", rangeEnd.toISOString())
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

  // Items de agenda (compromisos / pendientes) del rango
  let itemsQuery = supabaseAdmin
    .from("sgcc_agenda_items")
    .select(
      `id, tipo, titulo, descripcion, fecha, hora_inicio, duracion_min, caso_id,
       completado, completado_at, staff_id, created_at, updated_at`
    )
    .eq("center_id", centerId)
    .gte("fecha", rangeStartStr)
    .lt("fecha", rangeEndStr);

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

  // Staff conciliadores y salas para el form de audiencia
  const conciliadoresQuery = supabaseAdmin
    .from("sgcc_staff")
    .select("id, nombre, rol")
    .eq("center_id", centerId)
    .eq("activo", true)
    .order("nombre", { ascending: true });

  const salasQuery = supabaseAdmin
    .from("sgcc_rooms")
    .select("id, nombre")
    .eq("center_id", centerId)
    .order("nombre", { ascending: true });

  const [
    { data: audiencias },
    { data: itemsRaw },
    { data: casos },
    { data: staffRows },
    { data: salas },
  ] = await Promise.all([
    hearingsQuery,
    itemsQuery,
    casosQuery,
    conciliadoresQuery,
    salasQuery,
  ]);

  const conciliadores = (staffRows ?? [])
    .filter((s: any) => s.rol === "conciliador")
    .map((s: any) => ({ id: s.id, nombre: s.nombre }));

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
      fecha_iso: h.fecha_hora as string,
      duracion_min: (h.duracion_min as number) ?? 60,
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

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={
              view === "month"
                ? `/agenda?view=month&month=${prevMonth}`
                : `/agenda?week=${prevWeek}`
            }
            className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
          >
            ← Anterior
          </a>
          <a
            href={
              view === "month" ? `/agenda?view=month&month=${todayMonth}` : `/agenda?week=${today}`
            }
            className="bg-[#0D2340] text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-[#0d2340dd] transition-colors"
          >
            Hoy
          </a>
          <a
            href={
              view === "month"
                ? `/agenda?view=month&month=${nextMonth}`
                : `/agenda?week=${nextWeek}`
            }
            className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
          >
            Siguiente →
          </a>

          {/* Toggle de vista */}
          <div className="ml-2 inline-flex rounded-lg border border-gray-200 bg-white overflow-hidden">
            <a
              href={`/agenda?week=${today}`}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                view === "week"
                  ? "bg-[#0D2340] text-white"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              Semana
            </a>
            <a
              href={`/agenda?view=month&month=${todayMonth}`}
              className={`px-3 py-2 text-sm font-medium border-l border-gray-200 transition-colors ${
                view === "month"
                  ? "bg-[#0D2340] text-white"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              Mes
            </a>
          </div>
        </div>

        <div className="text-sm text-gray-600 font-medium">
          {view === "month"
            ? new Date(monthYear, monthNum, 1).toLocaleDateString("es-CO", {
                month: "long",
                year: "numeric",
              })
            : `${weekStart.toLocaleDateString("es-CO", {
                day: "numeric",
                month: "long",
              })} — ${addDays(weekStart, 6).toLocaleDateString("es-CO", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}`}
        </div>
      </div>

      {view === "week" ? (
        <>
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
            conciliadores={conciliadores}
            salas={(salas ?? []) as any}
            currentStaffId={userId}
            todayKey={formatDate(new Date())}
            dayMeta={buildDayMetaMap(weekDays.map((d) => d.date))}
          />
        </>
      ) : (
        <AgendaMonthGrid
          monthDays={monthDays}
          hearings={hearings}
          items={items}
          todayKey={formatDate(new Date())}
          dayMeta={buildDayMetaMap(monthDays.map((d) => d.date))}
        />
      )}
    </div>
  );
}
