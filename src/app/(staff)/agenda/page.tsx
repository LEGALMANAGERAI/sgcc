export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { PageHeader } from "@/components/ui/PageHeader";
import Link from "next/link";

const HOURS = Array.from({ length: 11 }, (_, i) => i + 8); // 8am - 6pm
const DAY_LABELS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
const TZ = "America/Bogota";

function getWeekStart(dateStr?: string): Date {
  const d = dateStr ? new Date(dateStr + "T00:00:00") : new Date();
  const day = d.getDay(); // 0=dom, 1=lun...
  const diff = day === 0 ? -6 : 1 - day; // lunes de la semana
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
  // "24" aparece a medianoche en es-CO; normalizamos a "00"
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

  const prevWeek = formatDate(addDays(weekStart, -7));
  const nextWeek = formatDate(addDays(weekStart, 7));
  const today = formatDate(getWeekStart());

  // Audiencias de la semana — filtramos por centro via join a sgcc_cases
  let query = supabaseAdmin
    .from("sgcc_hearings")
    .select(`
      id, fecha_hora, duracion_min, estado, tipo, notas_previas,
      caso:sgcc_cases!inner(id, numero_radicado, center_id),
      sala:sgcc_rooms(nombre),
      conciliador:sgcc_staff(id, nombre)
    `)
    .eq("caso.center_id", centerId)
    .gte("fecha_hora", weekStart.toISOString())
    .lt("fecha_hora", weekEnd.toISOString())
    .order("fecha_hora", { ascending: true });

  // Si es conciliador, solo sus audiencias. Usamos todos los staff_ids que
  // comparten email en el centro (cubre duplicados por capitalización).
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
    query = query.in("conciliador_id", Array.from(ids));
  }

  const { data: audiencias } = await query;
  const hearings = audiencias ?? [];

  // Organizar audiencias por dia y hora (en zona horaria Bogotá)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    return {
      date: formatDate(d),
      label: DAY_LABELS[i],
      dayNum: d.getDate(),
      month: d.toLocaleDateString("es-CO", { month: "short" }),
    };
  });

  type HearingRow = (typeof hearings)[number] & {
    _dateKey: string;
    _hour: number;
    _timeStr: string;
  };

  const hearingMap: Record<string, HearingRow[]> = {};
  for (const h of hearings) {
    const { date, hour, timeStr } = getBogotaParts(h.fecha_hora as string);
    const key = `${date}_${hour}`;
    const row: HearingRow = { ...(h as any), _dateKey: date, _hour: hour, _timeStr: timeStr };
    if (!hearingMap[key]) hearingMap[key] = [];
    hearingMap[key].push(row);
  }

  // Colores por estado
  const stateColors: Record<string, string> = {
    programada: "bg-blue-100 border-blue-300 text-blue-900",
    en_curso: "bg-purple-100 border-purple-300 text-purple-900",
    suspendida: "bg-orange-100 border-orange-300 text-orange-900",
    finalizada: "bg-green-100 border-green-300 text-green-900",
    cancelada: "bg-red-100 border-red-300 text-red-900",
  };

  return (
    <div>
      <PageHeader
        title="Agenda"
        subtitle={sgccRol === "conciliador" ? "Mis audiencias" : "Todas las audiencias"}
      />

      {/* Navegacion semanal */}
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
          {addDays(weekStart, 6).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}
        </div>
      </div>

      {/* Grid semanal */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Encabezado dias */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-gray-200">
          <div className="p-2 bg-gray-50" />
          {weekDays.map((day) => {
            const isToday = day.date === formatDate(new Date());
            return (
              <div
                key={day.date}
                className={`p-3 text-center border-l border-gray-100 ${
                  isToday ? "bg-[#0D2340] text-white" : "bg-gray-50"
                }`}
              >
                <div className={`text-xs font-semibold ${isToday ? "text-white/80" : "text-gray-500"}`}>
                  {day.label}
                </div>
                <div className={`text-lg font-bold ${isToday ? "text-white" : "text-gray-800"}`}>
                  {day.dayNum}
                </div>
                <div className={`text-xs ${isToday ? "text-white/60" : "text-gray-400"}`}>
                  {day.month}
                </div>
              </div>
            );
          })}
        </div>

        {/* Filas por hora */}
        {HOURS.map((hour) => (
          <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-gray-50 min-h-[60px]">
            {/* Hora */}
            <div className="p-2 text-xs text-gray-400 font-mono text-right pr-3 pt-3 border-r border-gray-100">
              {hour.toString().padStart(2, "0")}:00
            </div>

            {/* Celdas por dia */}
            {weekDays.map((day) => {
              const key = `${day.date}_${hour}`;
              const cellHearings = hearingMap[key] ?? [];

              return (
                <div key={key} className="border-l border-gray-50 p-1 min-h-[60px]">
                  {cellHearings.map((h) => (
                    <Link
                      key={h.id}
                      href={`/casos/${(h as any).caso?.id}`}
                      className={`block rounded-md border p-1.5 mb-1 text-xs cursor-pointer hover:shadow-sm transition-shadow ${
                        stateColors[h.estado] ?? "bg-gray-100 border-gray-200 text-gray-800"
                      }`}
                    >
                      <div className="font-semibold truncate">
                        {h._timeStr} — {(h as any).caso?.numero_radicado ?? "Sin radicado"}
                      </div>
                      <div className="truncate opacity-75">
                        {(h as any).conciliador?.nombre ?? "Sin conciliador"}
                      </div>
                      {(h as any).sala?.nombre && (
                        <div className="truncate opacity-60">{(h as any).sala.nombre}</div>
                      )}
                    </Link>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Resumen debajo */}
      <div className="mt-6 flex gap-4 text-xs">
        {Object.entries(stateColors).map(([estado, cls]) => (
          <div key={estado} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${cls.split(" ")[0]}`} />
            <span className="text-gray-600 capitalize">{estado.replace(/_/g, " ")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
