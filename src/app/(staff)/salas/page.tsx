export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { PageHeader } from "@/components/ui/PageHeader";
import { SalasClient } from "./SalasClient";

export default async function SalasPage() {
  const session = await auth();
  const centerId = (session!.user as any).centerId;

  const { data: salas } = await supabaseAdmin
    .from("sgcc_rooms")
    .select("id, nombre, tipo, capacidad, link_virtual, activo, created_at")
    .eq("center_id", centerId)
    .order("nombre", { ascending: true });

  const salasList = salas ?? [];

  return (
    <div>
      <PageHeader title="Salas" subtitle={`${salasList.length} sala${salasList.length !== 1 ? "s" : ""} registrada${salasList.length !== 1 ? "s" : ""}`} />

      {/* Grid de cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {!salasList.length ? (
          <div className="col-span-full bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center text-gray-400">
            No hay salas registradas. Agrega la primera sala.
          </div>
        ) : (
          salasList.map((sala) => (
            <div
              key={sala.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-[#0D2340] text-lg">{sala.nombre}</h3>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    sala.activo ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                  }`}
                >
                  {sala.activo ? "Activa" : "Inactiva"}
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    sala.tipo === "presencial"
                      ? "bg-blue-100 text-blue-800"
                      : sala.tipo === "virtual"
                      ? "bg-purple-100 text-purple-800"
                      : "bg-amber-100 text-amber-800"
                  }`}>
                    {sala.tipo === "presencial" ? "Presencial" : sala.tipo === "virtual" ? "Virtual" : "Hibrida"}
                  </span>
                </div>

                <p className="text-gray-600">
                  <span className="font-medium">Capacidad:</span> {sala.capacidad ?? "—"} personas
                </p>

                {sala.link_virtual && (
                  <p className="text-gray-600 truncate">
                    <span className="font-medium">Link:</span>{" "}
                    <a
                      href={sala.link_virtual}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#1B4F9B] hover:underline"
                    >
                      {sala.link_virtual}
                    </a>
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Formulario y acciones client-side */}
      <SalasClient salas={salasList} />
    </div>
  );
}
