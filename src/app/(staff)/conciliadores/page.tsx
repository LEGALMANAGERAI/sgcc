export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConciliadoresClient } from "./ConciliadoresClient";

const ROLES = [
  { value: "", label: "Todos los roles" },
  { value: "admin", label: "Administrador" },
  { value: "conciliador", label: "Conciliador" },
  { value: "secretario", label: "Secretario" },
];

interface Props {
  searchParams: Promise<{ rol?: string }>;
}

export default async function ConciliadoresPage({ searchParams }: Props) {
  const params = await searchParams;
  const session = await auth();
  const centerId = (session!.user as any).centerId;

  // Obtener staff del centro con conteo de casos activos
  let query = supabaseAdmin
    .from("sgcc_staff")
    .select("id, nombre, email, telefono, tarjeta_profesional, codigo_interno, rol, activo, supervisor_id, created_at")
    .eq("center_id", centerId)
    .order("nombre", { ascending: true });

  if (params.rol) {
    query = query.eq("rol", params.rol);
  }

  const { data: staff } = await query;
  const staffList = staff ?? [];

  // Contar casos activos por conciliador
  const staffIds = staffList.map((s) => s.id);
  const caseCounts: Record<string, number> = {};

  if (staffIds.length > 0) {
    const { data: cases } = await supabaseAdmin
      .from("sgcc_cases")
      .select("conciliador_id")
      .eq("center_id", centerId)
      .in("conciliador_id", staffIds)
      .not("estado", "in", '("cerrado","rechazado")');

    for (const c of cases ?? []) {
      if (c.conciliador_id) {
        caseCounts[c.conciliador_id] = (caseCounts[c.conciliador_id] ?? 0) + 1;
      }
    }
  }

  // Mapear supervisor_id a nombre
  const supervisorMap: Record<string, string> = {};
  for (const s of staffList) {
    supervisorMap[s.id] = s.nombre;
  }

  const enriched = staffList.map((s) => ({
    ...s,
    casos_activos: caseCounts[s.id] ?? 0,
    supervisor_nombre: s.supervisor_id ? supervisorMap[s.supervisor_id] ?? "—" : "—",
  }));

  // Lista de conciliadores para select de supervisor
  const conciliadores = staffList
    .filter((s) => s.rol === "conciliador" && s.activo)
    .map((s) => ({ id: s.id, nombre: s.nombre }));

  return (
    <div>
      <PageHeader title="Conciliadores" subtitle={`${enriched.length} miembro${enriched.length !== 1 ? "s" : ""} del equipo`} />

      {/* Filtro por rol */}
      <form method="get" className="flex gap-3 mb-6">
        <select
          name="rol"
          defaultValue={params.rol ?? ""}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <button
          type="submit"
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm transition-colors"
        >
          Filtrar
        </button>
        {params.rol && (
          <a href="/conciliadores" className="text-sm text-red-500 hover:underline flex items-center">
            Limpiar
          </a>
        )}
      </form>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Nombre</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Email</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Telefono</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">T.P.</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Rol</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Secretario asignado</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Casos activos</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Estado</th>
              <th className="px-5 py-3 font-semibold text-gray-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {!enriched.length ? (
              <tr>
                <td colSpan={9} className="px-5 py-10 text-center text-gray-400">
                  No hay miembros del equipo registrados
                </td>
              </tr>
            ) : (
              enriched.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3 font-medium text-[#0D2340]">{s.nombre}</td>
                  <td className="px-5 py-3 text-gray-600">{s.email}</td>
                  <td className="px-5 py-3 text-gray-600">{s.telefono ?? "—"}</td>
                  <td className="px-5 py-3 text-gray-600 font-mono text-xs">{s.tarjeta_profesional ?? "—"}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                      {s.rol}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{s.supervisor_nombre}</td>
                  <td className="px-5 py-3">
                    <span className={`font-semibold ${s.casos_activos > 0 ? "text-[#1B4F9B]" : "text-gray-400"}`}>
                      {s.casos_activos}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        s.activo ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                      }`}
                    >
                      {s.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right" id={`actions-${s.id}`}>
                    {/* Acciones se manejan en ConciliadoresClient */}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Formulario y acciones client-side */}
      <ConciliadoresClient staff={enriched} conciliadores={conciliadores} />
    </div>
  );
}
