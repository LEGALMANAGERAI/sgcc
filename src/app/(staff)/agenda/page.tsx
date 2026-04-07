export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import Link from "next/link";

const HOURS = Array.from({ length: 11 }, (_, i) => i + 8); // 8am - 6pm
const DAY_LABELS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

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

  // Obtener audiencias de la semana
  let query = supabaseAdmin
    .from("sgcc_hearings")
    .select(`
      id, fecha, hora_inicio, hora_fin, estado, motivo,
      caso:sgcc_cases!sgcc_hearings_case_id_fkey(id, numero_radicado),
      sala:sgcc_rooms!sgcc_hearings_sala_id_fkey(nombre),
      conciliador:sgcc_staff!sgcc_hearings_conciliador_id_fkey(id, nombre)
    `)
    .eq("center_id", centerId)
    .gte("fecha", formatDate(weekStart))
    .lt("fecha", formatDate(weekEnd))
    .order("fecha", { ascending: true })
    .order("hora_inicio", { ascending: true });

  // Si es conciliador, solo sus audiencias
  if (sgccRol === "conciliador") {
    query = query.eq("conciliador_id", userId);
  }

  const { data: audiencias } = await query;
  const hearings = audiencias ?? [];

  // Organizar audiencias por dia y hora
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    return {
      date: formatDate(d),
      label: DAY_LABELS[i],
      dayNum: d.getDate(),
      month: d.toLocaleDateString("es-CO", { month: "short" }),
    };
  });

  // Mapa: "YYYY-MM-DD_HH" -> audiencias[]
  const hearingMap: Record<string, typeof hearings> = {};
  for (const h of hearings) {
    const hour = parseInt((h.hora_inicio ?? "08:00").split(":")[0]);
    const key = `${h.fecha}_${hour}`;
    if (!hearingMap[key]) hearingMap[key] = [];
    hearingMap[key].push(h);
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
                  {cellHearings.map((h: any) => (
                    <Link
                      key={h.id}
                      href={`/casos/${h.caso?.id}`}
                      className={`block rounded-md border p-1.5 mb-1 text-xs cursor-pointer hover:shadow-sm transition-shadow ${
                        stateColors[h.estado] ?? "bg-gray-100 border-gray-200 text-gray-800"
                      }`}
                    >
                      <div className="font-semibold truncate">
                        {h.hora_inicio?.slice(0, 5)} — {h.caso?.numero_radicado ?? "Sin radicado"}
                      </div>
                      <div className="truncate opacity-75">
                        {h.conciliador?.nombre ?? "Sin conciliador"}
                      </div>
                      {h.sala?.nombre && (
                        <div className="truncate opacity-60">{h.sala.nombre}</div>
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
