export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Users, UserCheck, Clock } from "lucide-react";
import Link from "next/link";
import type { CaseEstado } from "@/types";

export default async function PartesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const centerId = resolveCenterId(session);
  if (!centerId) redirect("/login");

  // Obtener todas las partes vinculadas a casos del centro
  const { data: caseParties } = await supabaseAdmin
    .from("sgcc_case_parties")
    .select(`
      party_id,
      rol,
      caso:sgcc_cases!inner(id, numero_radicado, estado, center_id)
    `)
    .eq("caso.center_id", centerId);

  // IDs únicos de partes
  const partyIds = [...new Set((caseParties ?? []).map((cp: any) => cp.party_id))];

  if (!partyIds.length) {
    return (
      <div>
        <PageHeader title="Partes" subtitle="Convocantes y convocados del centro" />
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center text-gray-400">
          No hay partes registradas en casos de este centro
        </div>
      </div>
    );
  }

  // Obtener datos de las partes
  const { data: parties } = await supabaseAdmin
    .from("sgcc_parties")
    .select("id, tipo_persona, nombres, apellidos, razon_social, email, numero_doc, nit_empresa, telefono, ciudad, email_verified, created_at")
    .in("id", partyIds)
    .order("created_at", { ascending: false });

  const allParties = parties ?? [];

  // Contar casos activos por parte y rol
  const casosActivosByParty: Record<string, { convocante: number; convocado: number }> = {};
  for (const cp of caseParties ?? []) {
    const c = cp as any;
    const estado = c.caso?.estado as CaseEstado;
    if (!estado || ["cerrado", "rechazado"].includes(estado)) continue;
    if (!casosActivosByParty[cp.party_id]) casosActivosByParty[cp.party_id] = { convocante: 0, convocado: 0 };
    if (cp.rol === "convocante") casosActivosByParty[cp.party_id].convocante++;
    else casosActivosByParty[cp.party_id].convocado++;
  }

  // Stats
  const totalPartes = allParties.length;
  const conCuenta = allParties.filter((p: any) => p.email_verified).length;
  const sinCuenta = totalPartes - conCuenta;

  function displayName(p: any): string {
    if (p.razon_social) return p.razon_social;
    return [p.nombres, p.apellidos].filter(Boolean).join(" ") || p.email;
  }

  return (
    <div>
      <PageHeader title="Partes" subtitle="Convocantes y convocados vinculados a los casos del centro" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total partes" value={totalPartes} icon={Users} color="navy" />
        <StatCard label="Con cuenta activa" value={conCuenta} icon={UserCheck} color="green" />
        <StatCard label="Sin cuenta" value={sinCuenta} icon={Clock} color="gold" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Nombre</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Tipo</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Documento</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Email</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Teléfono</th>
              <th className="text-center px-5 py-3 font-semibold text-gray-600">Casos activos</th>
              <th className="text-center px-5 py-3 font-semibold text-gray-600">Cuenta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {allParties.map((p: any) => {
              const casos = casosActivosByParty[p.id] ?? { convocante: 0, convocado: 0 };
              const totalCasos = casos.convocante + casos.convocado;

              return (
                <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3 font-medium text-gray-900">{displayName(p)}</td>
                  <td className="px-5 py-3 text-gray-600 capitalize">{p.tipo_persona}</td>
                  <td className="px-5 py-3 text-gray-600 font-mono text-xs">
                    {p.numero_doc || p.nit_empresa || "—"}
                  </td>
                  <td className="px-5 py-3 text-gray-600 text-xs max-w-[200px] truncate">{p.email}</td>
                  <td className="px-5 py-3 text-gray-600">{p.telefono || "—"}</td>
                  <td className="px-5 py-3 text-center">
                    {totalCasos > 0 ? (
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#0D2340]/10 text-[#0D2340] font-semibold text-xs">
                        {totalCasos}
                      </span>
                    ) : (
                      <span className="text-gray-300">0</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-center">
                    {p.email_verified ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
                        Activa
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                        Sin cuenta
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
