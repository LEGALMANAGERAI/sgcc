import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import Link from "next/link";
import type { SgccCase, CaseEstado, CaseMateria } from "@/types";
export const dynamic = "force-dynamic";

const MATERIAS: { value: CaseMateria | ""; label: string }[] = [
export const dynamic = "force-dynamic";
  { value: "", label: "Todas las materias" },
  { value: "civil", label: "Civil" },
export const dynamic = "force-dynamic";
  { value: "comercial", label: "Comercial" },
  { value: "laboral", label: "Laboral" },
export const dynamic = "force-dynamic";
  { value: "familiar", label: "Familiar" },
  { value: "consumidor", label: "Consumidor" },
export const dynamic = "force-dynamic";
  { value: "arrendamiento", label: "Arrendamiento" },
  { value: "otro", label: "Otro" },
export const dynamic = "force-dynamic";
];

export const dynamic = "force-dynamic";
const ESTADOS: { value: CaseEstado | ""; label: string }[] = [
  { value: "", label: "Todos los estados" },
export const dynamic = "force-dynamic";
  { value: "solicitud", label: "Solicitud" },
  { value: "admitido", label: "Admitido" },
export const dynamic = "force-dynamic";
  { value: "citado", label: "Citado" },
  { value: "audiencia", label: "En Audiencia" },
export const dynamic = "force-dynamic";
  { value: "cerrado", label: "Cerrado" },
  { value: "rechazado", label: "Rechazado" },
export const dynamic = "force-dynamic";
];

export const dynamic = "force-dynamic";
interface Props {
  searchParams: Promise<{ estado?: string; materia?: string; q?: string }>;
export const dynamic = "force-dynamic";
}

export const dynamic = "force-dynamic";
export default async function CasosPage({ searchParams }: Props) {
  const params = await searchParams;
export const dynamic = "force-dynamic";
  const session = await auth();
  const centerId = (session!.user as any).centerId;
export const dynamic = "force-dynamic";

  let query = supabaseAdmin
export const dynamic = "force-dynamic";
    .from("sgcc_cases")
    .select(`
export const dynamic = "force-dynamic";
      id, numero_radicado, materia, estado, cuantia, cuantia_indeterminada,
      fecha_solicitud, fecha_audiencia,
export const dynamic = "force-dynamic";
      conciliador:sgcc_staff!sgcc_cases_conciliador_id_fkey(nombre),
      partes:sgcc_case_parties(
export const dynamic = "force-dynamic";
        rol, party:sgcc_parties(nombres, apellidos, razon_social, email)
      )
export const dynamic = "force-dynamic";
    `)
    .eq("center_id", centerId)
export const dynamic = "force-dynamic";
    .order("created_at", { ascending: false });

export const dynamic = "force-dynamic";
  if (params.estado) query = query.eq("estado", params.estado);
  if (params.materia) query = query.eq("materia", params.materia);
export const dynamic = "force-dynamic";

  const { data: cases } = await query;
export const dynamic = "force-dynamic";
  let filtered = (cases ?? []) as any[];

export const dynamic = "force-dynamic";
  if (params.q) {
    const q = params.q.toLowerCase();
export const dynamic = "force-dynamic";
    filtered = filtered.filter(
      (c) =>
export const dynamic = "force-dynamic";
        c.numero_radicado.toLowerCase().includes(q) ||
        c.partes?.some((p: any) =>
export const dynamic = "force-dynamic";
          [p.party?.nombres, p.party?.apellidos, p.party?.razon_social, p.party?.email]
            .filter(Boolean)
export const dynamic = "force-dynamic";
            .join(" ")
            .toLowerCase()
export const dynamic = "force-dynamic";
            .includes(q)
        )
export const dynamic = "force-dynamic";
    );
  }
export const dynamic = "force-dynamic";

  return (
export const dynamic = "force-dynamic";
    <div>
      <PageHeader title="Casos" subtitle={`${filtered.length} caso${filtered.length !== 1 ? "s" : ""}`}>
export const dynamic = "force-dynamic";
        <Link
          href="/casos/nuevo"
export const dynamic = "force-dynamic";
          className="bg-[#0D2340] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0d2340dd] transition-colors"
        >
export const dynamic = "force-dynamic";
          + Nueva solicitud
        </Link>
export const dynamic = "force-dynamic";
      </PageHeader>

export const dynamic = "force-dynamic";
      {/* Filtros */}
      <form method="get" className="flex flex-wrap gap-3 mb-6">
export const dynamic = "force-dynamic";
        <input
          name="q"
export const dynamic = "force-dynamic";
          defaultValue={params.q}
          placeholder="Buscar por radicado o parte..."
export const dynamic = "force-dynamic";
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
        />
export const dynamic = "force-dynamic";
        <select
          name="estado"
export const dynamic = "force-dynamic";
          defaultValue={params.estado ?? ""}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
export const dynamic = "force-dynamic";
        >
          {ESTADOS.map((e) => (
export const dynamic = "force-dynamic";
            <option key={e.value} value={e.value}>{e.label}</option>
          ))}
export const dynamic = "force-dynamic";
        </select>
        <select
export const dynamic = "force-dynamic";
          name="materia"
          defaultValue={params.materia ?? ""}
export const dynamic = "force-dynamic";
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
        >
export const dynamic = "force-dynamic";
          {MATERIAS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
export const dynamic = "force-dynamic";
          ))}
        </select>
export const dynamic = "force-dynamic";
        <button
          type="submit"
export const dynamic = "force-dynamic";
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm transition-colors"
        >
export const dynamic = "force-dynamic";
          Filtrar
        </button>
export const dynamic = "force-dynamic";
        {(params.estado || params.materia || params.q) && (
          <a
export const dynamic = "force-dynamic";
            href="/casos"
            className="text-sm text-red-500 hover:underline flex items-center"
export const dynamic = "force-dynamic";
          >
            Limpiar
export const dynamic = "force-dynamic";
          </a>
        )}
export const dynamic = "force-dynamic";
      </form>

export const dynamic = "force-dynamic";
      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
export const dynamic = "force-dynamic";
        <table className="w-full text-sm">
          <thead>
export const dynamic = "force-dynamic";
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Radicado</th>
export const dynamic = "force-dynamic";
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Materia</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Convocante</th>
export const dynamic = "force-dynamic";
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Cuantía</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Estado</th>
export const dynamic = "force-dynamic";
              <th className="text-left px-5 py-3 font-semibold text-gray-600">F. Solicitud</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Conciliador</th>
export const dynamic = "force-dynamic";
              <th className="px-5 py-3"></th>
            </tr>
export const dynamic = "force-dynamic";
          </thead>
          <tbody className="divide-y divide-gray-50">
export const dynamic = "force-dynamic";
            {!filtered.length ? (
              <tr>
export const dynamic = "force-dynamic";
                <td colSpan={8} className="px-5 py-10 text-center text-gray-400">
                  No hay casos con los filtros seleccionados
export const dynamic = "force-dynamic";
                </td>
              </tr>
export const dynamic = "force-dynamic";
            ) : (
              filtered.map((c: any) => {
export const dynamic = "force-dynamic";
                const convocante = c.partes?.find((p: any) => p.rol === "convocante");
                const cnombre = convocante?.party
export const dynamic = "force-dynamic";
                  ? [convocante.party.nombres, convocante.party.apellidos, convocante.party.razon_social]
                      .filter(Boolean)
export const dynamic = "force-dynamic";
                      .join(" ") || convocante.party.email
                  : "—";
export const dynamic = "force-dynamic";

                return (
export const dynamic = "force-dynamic";
                  <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 font-mono font-medium text-[#0D2340]">
export const dynamic = "force-dynamic";
                      {c.numero_radicado}
                    </td>
export const dynamic = "force-dynamic";
                    <td className="px-5 py-3 capitalize text-gray-700">{c.materia}</td>
                    <td className="px-5 py-3 text-gray-700 max-w-[200px] truncate">{cnombre}</td>
export const dynamic = "force-dynamic";
                    <td className="px-5 py-3 text-gray-600">
                      {c.cuantia_indeterminada
export const dynamic = "force-dynamic";
                        ? "Indet."
                        : c.cuantia
export const dynamic = "force-dynamic";
                        ? `$${Number(c.cuantia).toLocaleString("es-CO")}`
                        : "—"}
export const dynamic = "force-dynamic";
                    </td>
                    <td className="px-5 py-3">
export const dynamic = "force-dynamic";
                      <StatusChip value={c.estado} type="case" />
                    </td>
export const dynamic = "force-dynamic";
                    <td className="px-5 py-3 text-gray-500">
                      {new Date(c.fecha_solicitud).toLocaleDateString("es-CO")}
export const dynamic = "force-dynamic";
                    </td>
                    <td className="px-5 py-3 text-gray-500 max-w-[140px] truncate">
export const dynamic = "force-dynamic";
                      {c.conciliador?.nombre ?? <span className="text-amber-500">Sin asignar</span>}
                    </td>
export const dynamic = "force-dynamic";
                    <td className="px-5 py-3 text-right">
                      <Link
export const dynamic = "force-dynamic";
                        href={`/casos/${c.id}`}
                        className="text-[#B8860B] hover:underline font-medium text-xs"
export const dynamic = "force-dynamic";
                      >
                        Ver →
export const dynamic = "force-dynamic";
                      </Link>
                    </td>
export const dynamic = "force-dynamic";
                  </tr>
                );
export const dynamic = "force-dynamic";
              })
            )}
export const dynamic = "force-dynamic";
          </tbody>
        </table>
export const dynamic = "force-dynamic";
      </div>
    </div>
export const dynamic = "force-dynamic";
  );
}
