export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import Link from "next/link";
import type {
  CaseEstado,
  CaseRolParty,
  TipoTramite,
  CaseMateria,
  HearingEstado,
  HearingTipo,
  DocTipo,
} from "@/types";
import { ConfirmarAsistenciaButton } from "./ConfirmarAsistenciaButton";

/* ─── Labels ────────────────────────────────────────────────────────────── */

const estadoBadge: Record<CaseEstado, { label: string; color: string }> = {
  solicitud: { label: "Solicitud", color: "bg-gray-100 text-gray-700" },
  admitido: { label: "Admitido", color: "bg-blue-100 text-blue-700" },
  citado: { label: "Citado", color: "bg-yellow-100 text-yellow-800" },
  audiencia: { label: "En audiencia", color: "bg-purple-100 text-purple-700" },
  cerrado: { label: "Cerrado", color: "bg-green-100 text-green-700" },
  rechazado: { label: "Rechazado", color: "bg-red-100 text-red-700" },
};

const hearingEstadoBadge: Record<HearingEstado, { label: string; color: string }> = {
  programada: { label: "Programada", color: "bg-blue-100 text-blue-700" },
  en_curso: { label: "En curso", color: "bg-purple-100 text-purple-700" },
  suspendida: { label: "Suspendida", color: "bg-yellow-100 text-yellow-800" },
  finalizada: { label: "Finalizada", color: "bg-green-100 text-green-700" },
  cancelada: { label: "Cancelada", color: "bg-red-100 text-red-700" },
};

const hearingTipoLabel: Record<HearingTipo, string> = {
  inicial: "Inicial",
  continuacion: "Continuación",
  complementaria: "Complementaria",
};

const tramiteLabel: Record<TipoTramite, string> = {
  conciliacion: "Conciliación",
  insolvencia: "Insolvencia",
  acuerdo_apoyo: "Acuerdo de apoyo",
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

const docTipoLabel: Record<DocTipo, string> = {
  solicitud: "Solicitud",
  poder: "Poder",
  prueba: "Prueba",
  citacion: "Citación",
  acta_borrador: "Acta (borrador)",
  acta_firmada: "Acta firmada",
  constancia: "Constancia",
  admision: "Admisión",
  rechazo: "Rechazo",
  otro: "Otro",
};

/* ─── Página ────────────────────────────────────────────────────────────── */

export default async function CasoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: caseId } = await params;

  const session = await auth();
  if (!session) redirect("/login");

  const userId = (session.user as any).id as string;

  // Verificar que el usuario es parte de este caso
  const { data: caseParty } = await supabaseAdmin
    .from("sgcc_case_parties")
    .select("id, rol, citacion_confirmada_at")
    .eq("case_id", caseId)
    .eq("party_id", userId)
    .single();

  if (!caseParty) notFound();

  // Obtener datos del caso
  const { data: caso } = await supabaseAdmin
    .from("sgcc_cases")
    .select(`
      *,
      centro:sgcc_centers(nombre),
      conciliador:sgcc_staff!sgcc_cases_conciliador_id_fkey(nombre, email)
    `)
    .eq("id", caseId)
    .single();

  if (!caso) notFound();

  // Audiencias del caso
  const { data: hearings } = await supabaseAdmin
    .from("sgcc_hearings")
    .select(`
      *,
      sala:sgcc_rooms(nombre, tipo, link_virtual)
    `)
    .eq("case_id", caseId)
    .order("fecha_hora", { ascending: true });

  // Asistencia del usuario a las audiencias
  const hearingIds = (hearings ?? []).map((h: any) => h.id);
  let attendanceMap: Record<string, any> = {};

  if (hearingIds.length > 0) {
    const { data: attendance } = await supabaseAdmin
      .from("sgcc_hearing_attendance")
      .select("*")
      .in("hearing_id", hearingIds)
      .eq("party_id", userId);

    if (attendance) {
      for (const a of attendance) {
        attendanceMap[a.hearing_id] = a;
      }
    }
  }

  // Documentos del caso (solo los que la parte puede ver)
  const tiposPermitidos: DocTipo[] = [
    "citacion",
    "acta_firmada",
    "constancia",
    "admision",
    "rechazo",
  ];
  const { data: documentos } = await supabaseAdmin
    .from("sgcc_documents")
    .select("*")
    .eq("case_id", caseId)
    .in("tipo", tiposPermitidos)
    .order("created_at", { ascending: false });

  const badge = estadoBadge[caso.estado as CaseEstado];

  return (
    <div>
      {/* Header con breadcrumb */}
      <div className="mb-6">
        <Link
          href="/mis-casos"
          className="text-sm text-gray-500 hover:text-[#B8860B] transition-colors"
        >
          &larr; Volver a mis casos
        </Link>
      </div>

      {/* Título y estado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#0D2340]">
            Caso {caso.numero_radicado}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Mi rol: <strong>{caseParty.rol === "convocante" ? "Convocante" : "Convocado"}</strong>
          </p>
        </div>
        <span
          className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${badge?.color}`}
        >
          {badge?.label}
        </span>
      </div>

      {/* Datos del caso */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-[#0D2340] mb-4">
          Información del caso
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-500 block">Centro</span>
            <span className="font-medium text-gray-800">
              {caso.centro?.nombre ?? "—"}
            </span>
          </div>
          <div>
            <span className="text-gray-500 block">Tipo de trámite</span>
            <span className="font-medium text-gray-800">
              {tramiteLabel[caso.tipo_tramite as TipoTramite]}
            </span>
          </div>
          <div>
            <span className="text-gray-500 block">Materia</span>
            <span className="font-medium text-gray-800">
              {materiaLabel[caso.materia as CaseMateria]}
            </span>
          </div>
          <div>
            <span className="text-gray-500 block">Fecha de solicitud</span>
            <span className="font-medium text-gray-800">
              {new Date(caso.fecha_solicitud).toLocaleDateString("es-CO", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
          <div>
            <span className="text-gray-500 block">Conciliador asignado</span>
            <span className="font-medium text-gray-800">
              {caso.conciliador?.nombre ?? "Por asignar"}
            </span>
          </div>
          {caso.cuantia && (
            <div>
              <span className="text-gray-500 block">Cuantía</span>
              <span className="font-medium text-gray-800">
                ${Number(caso.cuantia).toLocaleString("es-CO")}
              </span>
            </div>
          )}
          {caso.cuantia_indeterminada && (
            <div>
              <span className="text-gray-500 block">Cuantía</span>
              <span className="font-medium text-gray-800">Indeterminada</span>
            </div>
          )}
        </div>
        {caso.descripcion && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <span className="text-gray-500 text-sm block mb-1">Descripción</span>
            <p className="text-sm text-gray-700 leading-relaxed">
              {caso.descripcion}
            </p>
          </div>
        )}
      </section>

      {/* Audiencias */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-[#0D2340] mb-4">
          Mis Audiencias
        </h2>

        {!hearings || hearings.length === 0 ? (
          <p className="text-gray-500 text-sm">
            No hay audiencias programadas para este caso.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-3 py-2 font-semibold text-gray-600">
                    Fecha y hora
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600">
                    Tipo
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600">
                    Sala
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600">
                    Estado
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600">
                    Asistencia
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {hearings.map((h: any) => {
                  const hBadge = hearingEstadoBadge[h.estado as HearingEstado];
                  const attendance = attendanceMap[h.id];
                  const yaConfirmo = !!caseParty.citacion_confirmada_at;

                  return (
                    <tr key={h.id} className="hover:bg-gray-50">
                      <td className="px-3 py-3 text-gray-700">
                        {new Date(h.fecha_hora).toLocaleDateString("es-CO", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-3 py-3 text-gray-600">
                        {hearingTipoLabel[h.tipo as HearingTipo]}
                      </td>
                      <td className="px-3 py-3 text-gray-600">
                        {h.sala?.nombre ?? "—"}
                        {h.sala?.tipo === "virtual" && h.sala?.link_virtual && (
                          <a
                            href={h.sala.link_virtual}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-xs text-[#B8860B] hover:underline mt-0.5"
                          >
                            Enlace virtual
                          </a>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${hBadge?.color}`}
                        >
                          {hBadge?.label}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-gray-600 text-xs">
                        {attendance?.asistio === true
                          ? "Asistió"
                          : attendance?.asistio === false && h.estado === "finalizada"
                          ? "No asistió"
                          : yaConfirmo
                          ? "Confirmada"
                          : "—"}
                      </td>
                      <td className="px-3 py-3">
                        {h.estado === "programada" && !yaConfirmo && (
                          <ConfirmarAsistenciaButton
                            hearingId={h.id}
                            caseId={caseId}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Documentos */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-[#0D2340] mb-4">
          Documentos
        </h2>

        {!documentos || documentos.length === 0 ? (
          <p className="text-gray-500 text-sm">
            No hay documentos disponibles para este caso.
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {documentos.map((doc: any) => (
              <div
                key={doc.id}
                className="flex items-center justify-between py-3"
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {doc.nombre}
                  </p>
                  <p className="text-xs text-gray-500">
                    {docTipoLabel[doc.tipo as DocTipo]} &middot;{" "}
                    {new Date(doc.created_at).toLocaleDateString("es-CO", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                {doc.url && (
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[#B8860B] hover:underline font-medium"
                  >
                    Descargar
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
