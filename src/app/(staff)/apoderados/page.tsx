export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Users, ShieldCheck, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { ApoderadosActions } from "./ApoderadosActions";

interface Props {
  searchParams: Promise<{ filtro?: string }>;
}

export default async function ApoderadosPage({ searchParams }: Props) {
  const params = await searchParams;
  const session = await auth();
  const centerId = (session!.user as any).centerId;

  // Obtener todos los attorneys vinculados a casos del centro
  const { data: caseAttorneys } = await supabaseAdmin
    .from("sgcc_case_attorneys")
    .select(`
      attorney_id,
      case:sgcc_cases!inner(id, center_id, estado)
    `)
    .eq("case.center_id", centerId);

  // IDs únicos de apoderados del centro
  const attorneyIds = [...new Set((caseAttorneys ?? []).map((ca: any) => ca.attorney_id))];

  if (!attorneyIds.length) {
    return (
      <div>
        <PageHeader
          title="Apoderados"
          subtitle="Registro de abogados y apoderados del centro"
        />
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center text-gray-400">
          No hay apoderados registrados en casos de este centro
        </div>
      </div>
    );
  }

  // Obtener datos de los apoderados
  const { data: attorneys } = await supabaseAdmin
    .from("sgcc_attorneys")
    .select("*")
    .in("id", attorneyIds);

  const allAttorneys = attorneys ?? [];

  // Contar casos activos por attorney
  const activeCaseCounts: Record<string, number> = {};
  for (const ca of caseAttorneys ?? []) {
    const c = ca as any;
    const estado = c.case?.estado;
    if (estado && !["cerrado", "rechazado"].includes(estado)) {
      activeCaseCounts[c.attorney_id] = (activeCaseCounts[c.attorney_id] ?? 0) + 1;
    }
  }

  // Stats
  const totalVerificados = allAttorneys.filter((a: any) => a.verificado).length;
  const totalSinVerificar = allAttorneys.filter((a: any) => !a.verificado).length;

  // Filtrar según searchParams
  let filtered = allAttorneys as any[];
  if (params.filtro === "verificados") {
    filtered = filtered.filter((a: any) => a.verificado);
  } else if (params.filtro === "sin-verificar") {
    filtered = filtered.filter((a: any) => !a.verificado);
  }

  return (
    <div>
      <PageHeader
        title="Apoderados"
        subtitle="Registro de abogados y apoderados del centro"
      />

      {/* Stats rápidas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Total apoderados"
          value={allAttorneys.length}
          icon={Users}
          color="navy"
        />
        <StatCard
          label="Verificados"
          value={totalVerificados}
          icon={ShieldCheck}
          color="green"
        />
        <StatCard
          label="Sin verificar"
          value={totalSinVerificar}
          icon={AlertTriangle}
          color="gold"
        />
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-6">
        <Link
          href="/apoderados"
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            !params.filtro
              ? "bg-[#0D2340] text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Todos ({allAttorneys.length})
        </Link>
        <Link
          href="/apoderados?filtro=verificados"
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            params.filtro === "verificados"
              ? "bg-green-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Verificados ({totalVerificados})
        </Link>
        <Link
          href="/apoderados?filtro=sin-verificar"
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            params.filtro === "sin-verificar"
              ? "bg-amber-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Sin verificar ({totalSinVerificar})
        </Link>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Nombre</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">T.P.</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Documento</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Email</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Teléfono</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Verificado</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Casos activos</th>
              <th className="px-5 py-3 font-semibold text-gray-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {!filtered.length ? (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-gray-400">
                  No hay apoderados con el filtro seleccionado
                </td>
              </tr>
            ) : (
              filtered.map((a: any) => {
                const nombre = [a.nombres, a.apellidos].filter(Boolean).join(" ") || "—";
                const casosActivos = activeCaseCounts[a.id] ?? 0;

                return (
                  <tr key={a.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-900">{nombre}</td>
                    <td className="px-5 py-3 font-mono text-gray-700">{a.tarjeta_profesional || "—"}</td>
                    <td className="px-5 py-3 text-gray-600">
                      {a.tipo_documento && a.numero_documento
                        ? `${a.tipo_documento.toUpperCase()} ${a.numero_documento}`
                        : a.numero_documento || "—"}
                    </td>
                    <td className="px-5 py-3 text-gray-600 max-w-[200px] truncate">
                      {a.email || "—"}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{a.telefono || "—"}</td>
                    <td className="px-5 py-3">
                      {a.verificado ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
                          ✓ Verificado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                          Pendiente
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#0D2340]/10 text-[#0D2340] font-semibold text-xs">
                        {casosActivos}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <ApoderadosActions
                        attorneyId={a.id}
                        nombre={nombre}
                        verificado={a.verificado}
                      />
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
