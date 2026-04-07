import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Users, ShieldCheck, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { VerificarButton } from "./VerificarButton";
export const dynamic = "force-dynamic";

interface Props {
export const dynamic = "force-dynamic";
  searchParams: Promise<{ filtro?: string }>;
}
export const dynamic = "force-dynamic";

export default async function ApoderadosPage({ searchParams }: Props) {
export const dynamic = "force-dynamic";
  const params = await searchParams;
  const session = await auth();
export const dynamic = "force-dynamic";
  const centerId = (session!.user as any).centerId;

export const dynamic = "force-dynamic";
  // Obtener todos los attorneys vinculados a casos del centro
  const { data: caseAttorneys } = await supabaseAdmin
export const dynamic = "force-dynamic";
    .from("sgcc_case_attorneys")
    .select(`
export const dynamic = "force-dynamic";
      attorney_id,
      case:sgcc_cases!inner(id, center_id, estado)
export const dynamic = "force-dynamic";
    `)
    .eq("case.center_id", centerId);
export const dynamic = "force-dynamic";

  // IDs únicos de apoderados del centro
export const dynamic = "force-dynamic";
  const attorneyIds = [...new Set((caseAttorneys ?? []).map((ca: any) => ca.attorney_id))];

export const dynamic = "force-dynamic";
  if (!attorneyIds.length) {
    return (
export const dynamic = "force-dynamic";
      <div>
        <PageHeader
export const dynamic = "force-dynamic";
          title="Apoderados"
          subtitle="Registro de abogados y apoderados del centro"
export const dynamic = "force-dynamic";
        />
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center text-gray-400">
export const dynamic = "force-dynamic";
          No hay apoderados registrados en casos de este centro
        </div>
export const dynamic = "force-dynamic";
      </div>
    );
export const dynamic = "force-dynamic";
  }

export const dynamic = "force-dynamic";
  // Obtener datos de los apoderados
  const { data: attorneys } = await supabaseAdmin
export const dynamic = "force-dynamic";
    .from("sgcc_attorneys")
    .select("*")
export const dynamic = "force-dynamic";
    .in("id", attorneyIds);

export const dynamic = "force-dynamic";
  const allAttorneys = attorneys ?? [];

export const dynamic = "force-dynamic";
  // Contar casos activos por attorney
  const activeCaseCounts: Record<string, number> = {};
export const dynamic = "force-dynamic";
  for (const ca of caseAttorneys ?? []) {
    const c = ca as any;
export const dynamic = "force-dynamic";
    const estado = c.case?.estado;
    if (estado && !["cerrado", "rechazado"].includes(estado)) {
export const dynamic = "force-dynamic";
      activeCaseCounts[c.attorney_id] = (activeCaseCounts[c.attorney_id] ?? 0) + 1;
    }
export const dynamic = "force-dynamic";
  }

export const dynamic = "force-dynamic";
  // Stats
  const totalVerificados = allAttorneys.filter((a: any) => a.verificado).length;
export const dynamic = "force-dynamic";
  const totalSinVerificar = allAttorneys.filter((a: any) => !a.verificado).length;

export const dynamic = "force-dynamic";
  // Filtrar según searchParams
  let filtered = allAttorneys as any[];
export const dynamic = "force-dynamic";
  if (params.filtro === "verificados") {
    filtered = filtered.filter((a: any) => a.verificado);
export const dynamic = "force-dynamic";
  } else if (params.filtro === "sin-verificar") {
    filtered = filtered.filter((a: any) => !a.verificado);
export const dynamic = "force-dynamic";
  }

export const dynamic = "force-dynamic";
  return (
    <div>
export const dynamic = "force-dynamic";
      <PageHeader
        title="Apoderados"
export const dynamic = "force-dynamic";
        subtitle="Registro de abogados y apoderados del centro"
      />
export const dynamic = "force-dynamic";

      {/* Stats rápidas */}
export const dynamic = "force-dynamic";
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
export const dynamic = "force-dynamic";
          label="Total apoderados"
          value={allAttorneys.length}
export const dynamic = "force-dynamic";
          icon={Users}
          color="navy"
export const dynamic = "force-dynamic";
        />
        <StatCard
export const dynamic = "force-dynamic";
          label="Verificados"
          value={totalVerificados}
export const dynamic = "force-dynamic";
          icon={ShieldCheck}
          color="green"
export const dynamic = "force-dynamic";
        />
        <StatCard
export const dynamic = "force-dynamic";
          label="Sin verificar"
          value={totalSinVerificar}
export const dynamic = "force-dynamic";
          icon={AlertTriangle}
          color="gold"
export const dynamic = "force-dynamic";
        />
      </div>
export const dynamic = "force-dynamic";

      {/* Filtros */}
export const dynamic = "force-dynamic";
      <div className="flex gap-2 mb-6">
        <Link
export const dynamic = "force-dynamic";
          href="/apoderados"
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
export const dynamic = "force-dynamic";
            !params.filtro
              ? "bg-[#0D2340] text-white"
export const dynamic = "force-dynamic";
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
export const dynamic = "force-dynamic";
        >
          Todos ({allAttorneys.length})
export const dynamic = "force-dynamic";
        </Link>
        <Link
export const dynamic = "force-dynamic";
          href="/apoderados?filtro=verificados"
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
export const dynamic = "force-dynamic";
            params.filtro === "verificados"
              ? "bg-green-600 text-white"
export const dynamic = "force-dynamic";
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
export const dynamic = "force-dynamic";
        >
          Verificados ({totalVerificados})
export const dynamic = "force-dynamic";
        </Link>
        <Link
export const dynamic = "force-dynamic";
          href="/apoderados?filtro=sin-verificar"
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
export const dynamic = "force-dynamic";
            params.filtro === "sin-verificar"
              ? "bg-amber-600 text-white"
export const dynamic = "force-dynamic";
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
export const dynamic = "force-dynamic";
        >
          Sin verificar ({totalSinVerificar})
export const dynamic = "force-dynamic";
        </Link>
      </div>
export const dynamic = "force-dynamic";

      {/* Tabla */}
export const dynamic = "force-dynamic";
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
export const dynamic = "force-dynamic";
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
export const dynamic = "force-dynamic";
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Nombre</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">T.P.</th>
export const dynamic = "force-dynamic";
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Documento</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Email</th>
export const dynamic = "force-dynamic";
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Teléfono</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Verificado</th>
export const dynamic = "force-dynamic";
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Casos activos</th>
              <th className="px-5 py-3 font-semibold text-gray-600">Acciones</th>
export const dynamic = "force-dynamic";
            </tr>
          </thead>
export const dynamic = "force-dynamic";
          <tbody className="divide-y divide-gray-50">
            {!filtered.length ? (
export const dynamic = "force-dynamic";
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-gray-400">
export const dynamic = "force-dynamic";
                  No hay apoderados con el filtro seleccionado
                </td>
export const dynamic = "force-dynamic";
              </tr>
            ) : (
export const dynamic = "force-dynamic";
              filtered.map((a: any) => {
                const nombre = [a.nombres, a.apellidos].filter(Boolean).join(" ") || "—";
export const dynamic = "force-dynamic";
                const casosActivos = activeCaseCounts[a.id] ?? 0;

export const dynamic = "force-dynamic";
                return (
                  <tr key={a.id} className="hover:bg-gray-50/50 transition-colors">
export const dynamic = "force-dynamic";
                    <td className="px-5 py-3 font-medium text-gray-900">{nombre}</td>
                    <td className="px-5 py-3 font-mono text-gray-700">{a.tarjeta_profesional || "—"}</td>
export const dynamic = "force-dynamic";
                    <td className="px-5 py-3 text-gray-600">
                      {a.tipo_documento && a.numero_documento
export const dynamic = "force-dynamic";
                        ? `${a.tipo_documento.toUpperCase()} ${a.numero_documento}`
                        : a.numero_documento || "—"}
export const dynamic = "force-dynamic";
                    </td>
                    <td className="px-5 py-3 text-gray-600 max-w-[200px] truncate">
export const dynamic = "force-dynamic";
                      {a.email || "—"}
                    </td>
export const dynamic = "force-dynamic";
                    <td className="px-5 py-3 text-gray-600">{a.telefono || "—"}</td>
                    <td className="px-5 py-3">
export const dynamic = "force-dynamic";
                      {a.verificado ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
export const dynamic = "force-dynamic";
                          ✓ Verificado
                        </span>
export const dynamic = "force-dynamic";
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
export const dynamic = "force-dynamic";
                          Pendiente
                        </span>
export const dynamic = "force-dynamic";
                      )}
                    </td>
export const dynamic = "force-dynamic";
                    <td className="px-5 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#0D2340]/10 text-[#0D2340] font-semibold text-xs">
export const dynamic = "force-dynamic";
                        {casosActivos}
                      </span>
export const dynamic = "force-dynamic";
                    </td>
                    <td className="px-5 py-3">
export const dynamic = "force-dynamic";
                      <div className="flex items-center justify-end gap-2">
                        {!a.verificado && (
export const dynamic = "force-dynamic";
                          <VerificarButton attorneyId={a.id} nombre={nombre} />
                        )}
export const dynamic = "force-dynamic";
                        <Link
                          href={`/apoderados?filtro=casos&attorney=${a.id}`}
export const dynamic = "force-dynamic";
                          className="text-[#B8860B] hover:underline font-medium text-xs"
                        >
export const dynamic = "force-dynamic";
                          Ver casos
                        </Link>
export const dynamic = "force-dynamic";
                      </div>
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
