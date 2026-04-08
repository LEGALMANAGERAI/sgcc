export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import Link from "next/link";
import type { CaseEstado, CaseRolParty, TipoTramite, CaseMateria } from "@/types";

/* ─── Helpers de presentación ───────────────────────────────────────────── */

const estadoBadge: Record<CaseEstado, { label: string; color: string }> = {
  solicitud: { label: "Solicitud", color: "bg-gray-100 text-gray-700" },
  admitido: { label: "Admitido", color: "bg-blue-100 text-blue-700" },
  citado: { label: "Citado", color: "bg-yellow-100 text-yellow-800" },
  audiencia: { label: "En audiencia", color: "bg-purple-100 text-purple-700" },
  cerrado: { label: "Cerrado", color: "bg-green-100 text-green-700" },
  rechazado: { label: "Rechazado", color: "bg-red-100 text-red-700" },
};

const rolLabel: Record<CaseRolParty, string> = {
  convocante: "Convocante",
  convocado: "Convocado",
};

const tramiteLabel: Record<TipoTramite, string> = {
  conciliacion: "Conciliación",
  insolvencia: "Insolvencia",
  acuerdo_apoyo: "Acuerdo de apoyo",
  arbitraje_ejecutivo: "Arbitraje Ejecutivo",
};

const materiaLabel: Record<CaseMateria, string> = {
  civil: "Civil",
  comercial: "Comercial",
  laboral: "Laboral",
  familiar: "Familiar",
  consumidor: "Consumidor",
  arrendamiento: "Arrendamiento",
  otro: "Otro",
};

/* ─── Página ────────────────────────────────────────────────────────────── */

export default async function MisCasosPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const userId = (session.user as any).id as string;

  // Obtener los casos de la parte, con join al caso y al centro
  const { data: caseParties, error } = await supabaseAdmin
    .from("sgcc_case_parties")
    .select(`
      id,
      rol,
      case_id,
      caso:sgcc_cases(
        id,
        numero_radicado,
        center_id,
        tipo_tramite,
        materia,
        estado,
        fecha_solicitud,
        fecha_audiencia,
        centro:sgcc_centers(nombre)
      )
    `)
    .eq("party_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error cargando casos:", error);
  }

  const casos = caseParties ?? [];

  // Obtener próximas audiencias para cada caso
  const caseIds = casos.map((cp: any) => cp.caso?.id).filter(Boolean);
  let audienciasMap: Record<string, string> = {};

  if (caseIds.length > 0) {
    const { data: hearings } = await supabaseAdmin
      .from("sgcc_hearings")
      .select("case_id, fecha_hora")
      .in("case_id", caseIds)
      .eq("estado", "programada")
      .order("fecha_hora", { ascending: true });

    if (hearings) {
      for (const h of hearings) {
        if (!audienciasMap[h.case_id]) {
          audienciasMap[h.case_id] = h.fecha_hora;
        }
      }
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#0D2340] mb-6">Mis Casos</h1>

      {casos.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <p className="text-gray-500 text-lg">No tiene casos registrados.</p>
          <p className="text-gray-400 text-sm mt-1">
            Sus casos aparecerán aquí cuando sea vinculado a un trámite.
          </p>
        </div>
      ) : (
        <>
          {/* Vista desktop: tabla */}
          <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">
                    Radicado
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">
                    Centro
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">
                    Trámite
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">
                    Materia
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">
                    Estado
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">
                    Mi Rol
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">
                    Próx. Audiencia
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {casos.map((cp: any) => {
                  const caso = cp.caso;
                  if (!caso) return null;
                  const badge = estadoBadge[caso.estado as CaseEstado];
                  const proxAudiencia = audienciasMap[caso.id];

                  return (
                    <tr
                      key={cp.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/mis-casos/${caso.id}`}
                          className="text-[#1B4F9B] font-medium hover:underline"
                        >
                          {caso.numero_radicado}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {caso.centro?.nombre ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {tramiteLabel[caso.tipo_tramite as TipoTramite]}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {materiaLabel[caso.materia as CaseMateria]}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${badge?.color}`}
                        >
                          {badge?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {rolLabel[cp.rol as CaseRolParty]}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {proxAudiencia
                          ? new Date(proxAudiencia).toLocaleDateString("es-CO", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Vista móvil: cards */}
          <div className="md:hidden flex flex-col gap-4">
            {casos.map((cp: any) => {
              const caso = cp.caso;
              if (!caso) return null;
              const badge = estadoBadge[caso.estado as CaseEstado];
              const proxAudiencia = audienciasMap[caso.id];

              return (
                <Link
                  key={cp.id}
                  href={`/mis-casos/${caso.id}`}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-[#1B4F9B]">
                      {caso.numero_radicado}
                    </span>
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${badge?.color}`}
                    >
                      {badge?.label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-1">
                    {caso.centro?.nombre ?? "—"} &middot;{" "}
                    {tramiteLabel[caso.tipo_tramite as TipoTramite]}
                  </p>
                  <p className="text-sm text-gray-500">
                    {materiaLabel[caso.materia as CaseMateria]} &middot; Rol:{" "}
                    {rolLabel[cp.rol as CaseRolParty]}
                  </p>
                  {proxAudiencia && (
                    <p className="text-xs text-[#0D2340] mt-2 font-medium">
                      Próx. audiencia:{" "}
                      {new Date(proxAudiencia).toLocaleDateString("es-CO", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
