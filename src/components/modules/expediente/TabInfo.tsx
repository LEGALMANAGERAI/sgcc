import { partyDisplayName } from "@/types";
import type { TipoTramite } from "@/types";
import {
  User,
  Building2,
  Mail,
  Phone,
  FileText,
  CheckCircle2,
  Circle,
  Calendar,
} from "lucide-react";
import { AsignarConciliador } from "./AsignarConciliador";

/* ─── Props ─────────────────────────────────────────────────────────────── */

interface StaffOption {
  id: string;
  nombre: string;
}

interface TabInfoProps {
  caso: any;
  parties: any[];
  attorneys: any[];
  timeline: any[];
  puedeAsignar?: boolean;
  conciliadoresDelCentro?: StaffOption[];
  staffDelCentro?: StaffOption[];
}

/* ─── Constantes ────────────────────────────────────────────────────────── */

const TIPO_LABELS: Record<TipoTramite, string> = {
  conciliacion: "Conciliación",
  insolvencia: "Insolvencia",
  acuerdo_apoyo: "Acuerdo de Apoyo",
  arbitraje_ejecutivo: "Arbitraje Ejecutivo",
  directiva_anticipada: "Directiva anticipada",
};

const ETAPA_COLORS: Record<string, string> = {
  solicitud: "bg-yellow-100 text-yellow-800",
  admision: "bg-blue-100 text-blue-800",
  citacion: "bg-indigo-100 text-indigo-800",
  audiencia: "bg-purple-100 text-purple-800",
  acta: "bg-green-100 text-green-800",
  archivo: "bg-gray-100 text-gray-600",
};

/* ─── Component ─────────────────────────────────────────────────────────── */

export function TabInfo({
  caso,
  parties,
  attorneys,
  timeline,
  puedeAsignar = false,
  conciliadoresDelCentro = [],
  staffDelCentro = [],
}: TabInfoProps) {
  // Mapa de apoderado activo por party_id
  const activeAttorneyByParty = new Map<string, any>();
  for (const ca of attorneys) {
    if (ca.activo && ca.attorney) {
      activeAttorneyByParty.set(ca.party_id, ca.attorney);
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Información general ──────────────────────────────────────── */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-[#0D2340] mb-4 text-base">
          Información del caso
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          <InfoField label="Radicado" value={caso.numero_radicado} />
          <InfoField
            label="Tipo de trámite"
            value={TIPO_LABELS[caso.tipo_tramite as TipoTramite] ?? caso.tipo_tramite}
          />
          <InfoField
            label="Materia"
            value={caso.materia?.charAt(0).toUpperCase() + caso.materia?.slice(1)}
          />
          <InfoField
            label="Cuantía"
            value={
              caso.cuantia_indeterminada
                ? "Indeterminada"
                : caso.cuantia
                  ? `$${Number(caso.cuantia).toLocaleString("es-CO")}`
                  : "Sin cuantía"
            }
          />
          <InfoField
            label="Estado"
            value={caso.estado?.charAt(0).toUpperCase() + caso.estado?.slice(1)}
          />
          <InfoField
            label="Fecha solicitud"
            value={formatDate(caso.fecha_solicitud)}
          />
          <InfoField
            label="Fecha admisión"
            value={caso.fecha_admision ? formatDate(caso.fecha_admision) : "Pendiente"}
          />
          {puedeAsignar ? (
            <AsignarConciliador
              caseId={caso.id}
              campo="conciliador_id"
              label="Conciliador"
              valorActualId={caso.conciliador?.id ?? caso.conciliador_id ?? null}
              valorActualNombre={caso.conciliador?.nombre ?? null}
              opciones={conciliadoresDelCentro}
            />
          ) : (
            <InfoField label="Conciliador" value={caso.conciliador?.nombre ?? "Sin asignar"} />
          )}
          {puedeAsignar ? (
            <AsignarConciliador
              caseId={caso.id}
              campo="secretario_id"
              label="Secretario"
              valorActualId={caso.secretario?.id ?? caso.secretario_id ?? null}
              valorActualNombre={caso.secretario?.nombre ?? null}
              opciones={staffDelCentro}
            />
          ) : (
            <InfoField label="Secretario" value={caso.secretario?.nombre ?? "Sin asignar"} />
          )}
          <InfoField
            label="Sala"
            value={caso.sala?.nombre ?? "Sin asignar"}
          />
        </div>

        {/* Descripción */}
        {caso.descripcion && (
          <div className="mt-5 pt-5 border-t border-gray-100">
            <p className="text-xs text-gray-500 font-medium mb-1.5">
              Hechos y pretensiones
            </p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {caso.descripcion}
            </p>
          </div>
        )}
      </section>

      {/* ── Partes ───────────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-[#0D2340] mb-4 text-base">Partes</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="pb-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Nombre
                </th>
                <th className="pb-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Rol
                </th>
                <th className="pb-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Doc. identidad
                </th>
                <th className="pb-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Email
                </th>
                <th className="pb-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Teléfono
                </th>
                <th className="pb-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Apoderado actual
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {parties.map((cp: any) => {
                const party = cp.party;
                if (!party) return null;
                const attorney = activeAttorneyByParty.get(cp.party_id);

                return (
                  <tr key={cp.id} className="hover:bg-gray-50/50">
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2">
                        {party.tipo_persona === "juridica" ? (
                          <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        ) : (
                          <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        )}
                        <span className="font-medium text-gray-900">
                          {partyDisplayName(party)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          cp.rol === "convocante"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-orange-100 text-orange-700"
                        }`}
                      >
                        {cp.rol === "convocante" ? "Convocante" : "Convocado"}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-gray-600">
                      {party.tipo_persona === "juridica"
                        ? party.nit_empresa
                          ? `NIT ${party.nit_empresa}`
                          : "—"
                        : party.numero_doc
                          ? `${party.tipo_doc ?? ""} ${party.numero_doc}`
                          : "—"}
                    </td>
                    <td className="py-3 pr-3">
                      <span className="flex items-center gap-1 text-gray-600">
                        <Mail className="w-3 h-3 text-gray-400" />
                        {party.email}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-gray-600">
                      {party.telefono ? (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-gray-400" />
                          {party.telefono}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 text-gray-600">
                      {attorney ? (
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3 text-[#1B4F9B]" />
                          {attorney.nombre}
                        </span>
                      ) : (
                        <span className="text-gray-400">Sin apoderado</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {parties.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400">
                    No hay partes registradas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Timeline ─────────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-[#0D2340] mb-4 text-base">
          Timeline del caso
        </h3>
        {timeline.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            No hay eventos en el timeline
          </p>
        ) : (
          <div className="relative">
            {/* Línea vertical */}
            <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-gray-200" />

            <div className="space-y-4">
              {timeline.map((event: any, idx: number) => {
                const etapaColor =
                  ETAPA_COLORS[event.etapa] ?? "bg-gray-100 text-gray-600";

                return (
                  <div key={event.id} className="flex items-start gap-4 relative">
                    {/* Icono */}
                    <div className="flex-shrink-0 z-10 bg-white p-0.5">
                      {event.completado ? (
                        <CheckCircle2 className="w-6 h-6 text-green-500" />
                      ) : (
                        <Circle className="w-6 h-6 text-gray-300" />
                      )}
                    </div>

                    {/* Contenido */}
                    <div className="flex-1 min-w-0 pb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${etapaColor}`}
                        >
                          {event.etapa}
                        </span>
                        {event.fecha && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(event.fecha)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 mt-1">
                        {event.descripcion}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className="text-sm text-gray-900 mt-0.5">{value}</p>
    </div>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
