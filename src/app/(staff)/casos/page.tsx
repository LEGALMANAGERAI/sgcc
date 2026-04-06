import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import Link from "next/link";
import type { SgccCase, CaseEstado, CaseMateria } from "@/types";

const MATERIAS: { value: CaseMateria | ""; label: string }[] = [
  { value: "", label: "Todas las materias" },
  { value: "civil", label: "Civil" },
  { value: "comercial", label: "Comercial" },
  { value: "laboral", label: "Laboral" },
  { value: "familiar", label: "Familiar" },
  { value: "consumidor", label: "Consumidor" },
  { value: "arrendamiento", label: "Arrendamiento" },
  { value: "otro", label: "Otro" },
];

const ESTADOS: { value: CaseEstado | ""; label: string }[] = [
  { value: "", label: "Todos los estados" },
  { value: "solicitud", label: "Solicitud" },
  { value: "admitido", label: "Admitido" },
  { value: "citado", label: "Citado" },
  { value: "audiencia", label: "En Audiencia" },
  { value: "cerrado", label: "Cerrado" },
  { value: "rechazado", label: "Rechazado" },
];

interface Props {
  searchParams: Promise<{ estado?: string; materia?: string; q?: string }>;
}

export default async function CasosPage({ searchParams }: Props) {
  const params = await searchParams;
  const session = await auth();
  const centerId = (session!.user as any).centerId;

  let query = supabaseAdmin
    .from("sgcc_cases")
    .select(`
      id, numero_radicado, materia, estado, cuantia, cuantia_indeterminada,
      fecha_solicitud, fecha_audiencia,
      conciliador:sgcc_staff!sgcc_cases_conciliador_id_fkey(nombre),
      partes:sgcc_case_parties(
        rol, party:sgcc_parties(nombres, apellidos, razon_social, email)
      )
    `)
    .eq("center_id", centerId)
    .order("created_at", { ascending: false });

  if (params.estado) query = query.eq("estado", params.estado);
  if (params.materia) query = query.eq("materia", params.materia);

  const { data: cases } = await query;
  let filtered = (cases ?? []) as any[];

  if (params.q) {
    const q = params.q.toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.numero_radicado.toLowerCase().includes(q) ||
        c.partes?.some((p: any) =>
          [p.party?.nombres, p.party?.apellidos, p.party?.razon_social, p.party?.email]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(q)
        )
    );
  }

  return (
    <div>
      <PageHeader title="Casos" subtitle={`${filtered.length} caso${filtered.length !== 1 ? "s" : ""}`}>
        <Link
          href="/casos/nuevo"
          className="bg-[#0D2340] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0d2340dd] transition-colors"
        >
          + Nueva solicitud
        </Link>
      </PageHeader>

      {/* Filtros */}
      <form method="get" className="flex flex-wrap gap-3 mb-6">
        <input
          name="q"
          defaultValue={params.q}
          placeholder="Buscar por radicado o parte..."
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
        />
        <select
          name="estado"
          defaultValue={params.estado ?? ""}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
        >
          {ESTADOS.map((e) => (
            <option key={e.value} value={e.value}>{e.label}</option>
          ))}
        </select>
        <select
          name="materia"
          defaultValue={params.materia ?? ""}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
        >
          {MATERIAS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        <button
          type="submit"
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm transition-colors"
        >
          Filtrar
        </button>
        {(params.estado || params.materia || params.q) && (
          <a
            href="/casos"
            className="text-sm text-red-500 hover:underline flex items-center"
          >
            Limpiar
          </a>
        )}
      </form>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Radicado</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Materia</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Convocante</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Cuantía</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Estado</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">F. Solicitud</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Conciliador</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {!filtered.length ? (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-gray-400">
                  No hay casos con los filtros seleccionados
                </td>
              </tr>
            ) : (
              filtered.map((c: any) => {
                const convocante = c.partes?.find((p: any) => p.rol === "convocante");
                const cnombre = convocante?.party
                  ? [convocante.party.nombres, convocante.party.apellidos, convocante.party.razon_social]
                      .filter(Boolean)
                      .join(" ") || convocante.party.email
                  : "—";

                return (
                  <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 font-mono font-medium text-[#0D2340]">
                      {c.numero_radicado}
                    </td>
                    <td className="px-5 py-3 capitalize text-gray-700">{c.materia}</td>
                    <td className="px-5 py-3 text-gray-700 max-w-[200px] truncate">{cnombre}</td>
                    <td className="px-5 py-3 text-gray-600">
                      {c.cuantia_indeterminada
                        ? "Indet."
                        : c.cuantia
                        ? `$${Number(c.cuantia).toLocaleString("es-CO")}`
                        : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <StatusChip value={c.estado} type="case" />
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {new Date(c.fecha_solicitud).toLocaleDateString("es-CO")}
                    </td>
                    <td className="px-5 py-3 text-gray-500 max-w-[140px] truncate">
                      {c.conciliador?.nombre ?? <span className="text-amber-500">Sin asignar</span>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/casos/${c.id}`}
                        className="text-[#B8860B] hover:underline font-medium text-xs"
                      >
                        Ver →
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
