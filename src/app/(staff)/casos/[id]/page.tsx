export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import { CasoTimeline } from "@/components/modules/casos/CasoTimeline";
import Link from "next/link";
import { partyDisplayName } from "@/types";
import { FileText, Download, Upload, Clock, CheckCircle2, XCircle } from "lucide-react";
export const dynamic = "force-dynamic";

interface Props {
export const dynamic = "force-dynamic";
  params: Promise<{ id: string }>;
}
export const dynamic = "force-dynamic";

export default async function CasoDetailPage({ params }: Props) {
export const dynamic = "force-dynamic";
  const { id } = await params;
  const session = await auth();
export const dynamic = "force-dynamic";
  const centerId = (session!.user as any).centerId;

export const dynamic = "force-dynamic";
  const { data: caso } = await supabaseAdmin
    .from("sgcc_cases")
export const dynamic = "force-dynamic";
    .select(`
      *,
export const dynamic = "force-dynamic";
      conciliador:sgcc_staff!sgcc_cases_conciliador_id_fkey(id, nombre, tarjeta_profesional, email),
      secretario:sgcc_staff!sgcc_cases_secretario_id_fkey(id, nombre),
export const dynamic = "force-dynamic";
      sala:sgcc_rooms(id, nombre, tipo, link_virtual),
      partes:sgcc_case_parties(
export const dynamic = "force-dynamic";
        id, rol, asistio, firmo_acta, citacion_enviada_at, citacion_confirmada_at,
        apoderado_nombre,
export const dynamic = "force-dynamic";
        party:sgcc_parties(id, tipo_persona, nombres, apellidos, razon_social, numero_doc, nit_empresa, email, telefono, tipo_doc)
      ),
export const dynamic = "force-dynamic";
      actas:sgcc_actas(id, numero_acta, tipo, estado_firma, borrador_url, acta_firmada_url, fecha_acta, es_constancia),
      audiencias:sgcc_hearings(
export const dynamic = "force-dynamic";
        id, fecha_hora, duracion_min, estado, tipo, notas_previas,
        conciliador:sgcc_staff(nombre),
export const dynamic = "force-dynamic";
        sala:sgcc_rooms(nombre)
      ),
export const dynamic = "force-dynamic";
      documentos:sgcc_documents(id, tipo, nombre, url, created_at, subido_por_staff, subido_por_party),
      timeline:sgcc_case_timeline(id, etapa, descripcion, completado, fecha)
export const dynamic = "force-dynamic";
    `)
    .eq("id", id)
export const dynamic = "force-dynamic";
    .eq("center_id", centerId)
    .single();
export const dynamic = "force-dynamic";

  if (!caso) notFound();
export const dynamic = "force-dynamic";

  const convocante = caso.partes?.find((p: any) => p.rol === "convocante");
export const dynamic = "force-dynamic";
  const convocados = caso.partes?.filter((p: any) => p.rol === "convocado") ?? [];

export const dynamic = "force-dynamic";
  // Siguiente acción disponible según estado
  const nextAction = {
export const dynamic = "force-dynamic";
    solicitud: { label: "Procesar admisión", href: `/casos/${id}/admision` },
    admitido: { label: "Generar citación", href: `/casos/${id}/citacion` },
export const dynamic = "force-dynamic";
    citado: { label: "Programar audiencia", href: `/casos/${id}/audiencia` },
    audiencia: { label: "Generar acta", href: `/casos/${id}/acta` },
export const dynamic = "force-dynamic";
    cerrado: null,
    rechazado: null,
export const dynamic = "force-dynamic";
  }[caso.estado as string] ?? null;

export const dynamic = "force-dynamic";
  return (
    <div>
export const dynamic = "force-dynamic";
      <div className="mb-2">
        <Link href="/casos" className="text-xs text-gray-400 hover:text-gray-600">
export const dynamic = "force-dynamic";
          ← Casos
        </Link>
export const dynamic = "force-dynamic";
      </div>

export const dynamic = "force-dynamic";
      <PageHeader
        title={caso.numero_radicado}
export const dynamic = "force-dynamic";
        subtitle={`Materia: ${caso.materia} · Radicado: ${new Date(caso.fecha_solicitud).toLocaleDateString("es-CO")}`}
      >
export const dynamic = "force-dynamic";
        <StatusChip value={caso.estado} type="case" size="md" />
        {nextAction && (
export const dynamic = "force-dynamic";
          <Link
            href={nextAction.href}
export const dynamic = "force-dynamic";
            className="bg-[#B8860B] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#a07509] transition-colors"
          >
export const dynamic = "force-dynamic";
            {nextAction.label} →
          </Link>
export const dynamic = "force-dynamic";
        )}
      </PageHeader>
export const dynamic = "force-dynamic";

      {/* Timeline */}
export const dynamic = "force-dynamic";
      <CasoTimeline estado={caso.estado} events={caso.timeline ?? []} />

export const dynamic = "force-dynamic";
      {/* Rechazo */}
      {caso.estado === "rechazado" && caso.motivo_rechazo && (
export const dynamic = "force-dynamic";
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 mb-6">
          <p className="text-sm font-medium text-red-800">Motivo de rechazo</p>
export const dynamic = "force-dynamic";
          <p className="text-sm text-red-700 mt-1">{caso.motivo_rechazo}</p>
        </div>
export const dynamic = "force-dynamic";
      )}

export const dynamic = "force-dynamic";
      <div className="grid grid-cols-3 gap-6">
        {/* Columna principal (2/3) */}
export const dynamic = "force-dynamic";
        <div className="col-span-2 space-y-6">
          {/* Descripción */}
export const dynamic = "force-dynamic";
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Hechos y pretensiones</h3>
export const dynamic = "force-dynamic";
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{caso.descripcion}</p>
          </section>
export const dynamic = "force-dynamic";

          {/* Partes */}
export const dynamic = "force-dynamic";
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Partes</h3>
export const dynamic = "force-dynamic";
            <div className="space-y-3">
              {caso.partes?.map((cp: any) => (
export const dynamic = "force-dynamic";
                <div key={cp.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
export const dynamic = "force-dynamic";
                    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-1 ${cp.rol === "convocante" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>
                      {cp.rol === "convocante" ? "Convocante" : "Convocado"}
export const dynamic = "force-dynamic";
                    </span>
                    <p className="text-sm font-medium text-gray-900">{partyDisplayName(cp.party)}</p>
export const dynamic = "force-dynamic";
                    <p className="text-xs text-gray-500">{cp.party.email} {cp.party.telefono ? `· ${cp.party.telefono}` : ""}</p>
                    {cp.apoderado_nombre && (
export const dynamic = "force-dynamic";
                      <p className="text-xs text-gray-400 mt-1">Apoderado: {cp.apoderado_nombre}</p>
                    )}
export const dynamic = "force-dynamic";
                  </div>
                  <div className="flex flex-col items-end gap-1">
export const dynamic = "force-dynamic";
                    {cp.citacion_enviada_at && (
                      <span className="text-xs text-green-600 flex items-center gap-1">
export const dynamic = "force-dynamic";
                        <CheckCircle2 className="w-3 h-3" /> Citado
                      </span>
export const dynamic = "force-dynamic";
                    )}
                    {cp.asistio === true && <span className="text-xs text-green-600">Asistió ✓</span>}
export const dynamic = "force-dynamic";
                    {cp.asistio === false && <span className="text-xs text-red-500">No asistió</span>}
                  </div>
export const dynamic = "force-dynamic";
                </div>
              ))}
export const dynamic = "force-dynamic";
            </div>
          </section>
export const dynamic = "force-dynamic";

          {/* Audiencias */}
export const dynamic = "force-dynamic";
          {caso.audiencias?.length > 0 && (
            <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
export const dynamic = "force-dynamic";
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Audiencias</h3>
export const dynamic = "force-dynamic";
                <Link href={`/casos/${id}/audiencia`} className="text-xs text-[#B8860B] hover:underline">
                  + Programar
export const dynamic = "force-dynamic";
                </Link>
              </div>
export const dynamic = "force-dynamic";
              <div className="space-y-2">
                {caso.audiencias.map((h: any) => (
export const dynamic = "force-dynamic";
                  <div key={h.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                    <div>
export const dynamic = "force-dynamic";
                      <p className="font-medium text-gray-900">
                        {new Date(h.fecha_hora).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}
export const dynamic = "force-dynamic";
                      </p>
                      <p className="text-xs text-gray-500">
export const dynamic = "force-dynamic";
                        {h.sala?.nombre ?? "Sala por definir"} · {h.tipo}
                        {h.conciliador && ` · ${h.conciliador.nombre}`}
export const dynamic = "force-dynamic";
                      </p>
                    </div>
export const dynamic = "force-dynamic";
                    <StatusChip value={h.estado} type="hearing" />
                  </div>
export const dynamic = "force-dynamic";
                ))}
              </div>
export const dynamic = "force-dynamic";
            </section>
          )}
export const dynamic = "force-dynamic";

          {/* Actas */}
export const dynamic = "force-dynamic";
          {caso.actas?.length > 0 && (
            <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
export const dynamic = "force-dynamic";
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Actas</h3>
export const dynamic = "force-dynamic";
              </div>
              <div className="space-y-2">
export const dynamic = "force-dynamic";
                {caso.actas.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
export const dynamic = "force-dynamic";
                    <div>
                      <p className="font-medium text-gray-900">{a.numero_acta}</p>
export const dynamic = "force-dynamic";
                      <p className="text-xs text-gray-500 capitalize">{a.tipo.replace(/_/g, " ")} · {new Date(a.fecha_acta).toLocaleDateString("es-CO")}</p>
                    </div>
export const dynamic = "force-dynamic";
                    <div className="flex items-center gap-3">
                      <StatusChip value={a.estado_firma} type="firma" />
export const dynamic = "force-dynamic";
                      {a.borrador_url && (
                        <a href={a.borrador_url} target="_blank" className="text-[#B8860B] hover:underline text-xs flex items-center gap-1">
export const dynamic = "force-dynamic";
                          <Download className="w-3 h-3" /> Borrador
                        </a>
export const dynamic = "force-dynamic";
                      )}
                      {a.acta_firmada_url && (
export const dynamic = "force-dynamic";
                        <a href={a.acta_firmada_url} target="_blank" className="text-green-600 hover:underline text-xs flex items-center gap-1">
                          <Download className="w-3 h-3" /> Firmada
export const dynamic = "force-dynamic";
                        </a>
                      )}
export const dynamic = "force-dynamic";
                    </div>
                  </div>
export const dynamic = "force-dynamic";
                ))}
              </div>
export const dynamic = "force-dynamic";
              <div className="mt-3">
                <Link href={`/casos/${id}/acta`} className="text-xs text-[#B8860B] hover:underline">
export const dynamic = "force-dynamic";
                  + Nueva acta / constancia
                </Link>
export const dynamic = "force-dynamic";
              </div>
            </section>
export const dynamic = "force-dynamic";
          )}

export const dynamic = "force-dynamic";
          {/* Documentos */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
export const dynamic = "force-dynamic";
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Documentos</h3>
export const dynamic = "force-dynamic";
              <Link href={`/casos/${id}/documentos`} className="text-xs text-[#B8860B] hover:underline">
                + Subir
export const dynamic = "force-dynamic";
              </Link>
            </div>
export const dynamic = "force-dynamic";
            {!caso.documentos?.length ? (
              <p className="text-sm text-gray-400">Sin documentos adjuntos</p>
export const dynamic = "force-dynamic";
            ) : (
              <div className="space-y-2">
export const dynamic = "force-dynamic";
                {caso.documentos.map((d: any) => (
                  <div key={d.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
export const dynamic = "force-dynamic";
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-400" />
export const dynamic = "force-dynamic";
                      <div>
                        <p className="font-medium text-gray-900">{d.nombre}</p>
export const dynamic = "force-dynamic";
                        <p className="text-xs text-gray-500 capitalize">{d.tipo} · {new Date(d.created_at).toLocaleDateString("es-CO")}</p>
                      </div>
export const dynamic = "force-dynamic";
                    </div>
                    <a href={d.url} target="_blank" className="text-[#B8860B] hover:underline text-xs flex items-center gap-1">
export const dynamic = "force-dynamic";
                      <Download className="w-3 h-3" /> Descargar
                    </a>
export const dynamic = "force-dynamic";
                  </div>
                ))}
export const dynamic = "force-dynamic";
              </div>
            )}
export const dynamic = "force-dynamic";
          </section>
        </div>
export const dynamic = "force-dynamic";

        {/* Sidebar derecho (1/3) */}
export const dynamic = "force-dynamic";
        <div className="space-y-4">
          {/* Info general */}
export const dynamic = "force-dynamic";
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Información</h3>
export const dynamic = "force-dynamic";
            <dl className="space-y-3 text-sm">
              <div>
export const dynamic = "force-dynamic";
                <dt className="text-gray-500 text-xs">Cuantía</dt>
                <dd className="text-gray-900 font-medium">
export const dynamic = "force-dynamic";
                  {caso.cuantia_indeterminada ? "Indeterminada" : caso.cuantia ? `$${Number(caso.cuantia).toLocaleString("es-CO")}` : "Sin cuantía"}
                </dd>
export const dynamic = "force-dynamic";
              </div>
              <div>
export const dynamic = "force-dynamic";
                <dt className="text-gray-500 text-xs">Fecha solicitud</dt>
                <dd className="text-gray-900">{new Date(caso.fecha_solicitud).toLocaleDateString("es-CO")}</dd>
export const dynamic = "force-dynamic";
              </div>
              {caso.fecha_admision && (
export const dynamic = "force-dynamic";
                <div>
                  <dt className="text-gray-500 text-xs">Fecha admisión</dt>
export const dynamic = "force-dynamic";
                  <dd className="text-gray-900">{new Date(caso.fecha_admision).toLocaleDateString("es-CO")}</dd>
                </div>
export const dynamic = "force-dynamic";
              )}
              {caso.fecha_limite_citacion && (
export const dynamic = "force-dynamic";
                <div>
                  <dt className="text-gray-500 text-xs">Límite citación</dt>
export const dynamic = "force-dynamic";
                  <dd className={`font-medium ${new Date(caso.fecha_limite_citacion) < new Date() ? "text-red-600" : "text-gray-900"}`}>
                    {new Date(caso.fecha_limite_citacion).toLocaleDateString("es-CO")}
export const dynamic = "force-dynamic";
                  </dd>
                </div>
export const dynamic = "force-dynamic";
              )}
              {caso.fecha_audiencia && (
export const dynamic = "force-dynamic";
                <div>
                  <dt className="text-gray-500 text-xs">Audiencia</dt>
export const dynamic = "force-dynamic";
                  <dd className="text-gray-900">{new Date(caso.fecha_audiencia).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}</dd>
                </div>
export const dynamic = "force-dynamic";
              )}
              <div>
export const dynamic = "force-dynamic";
                <dt className="text-gray-500 text-xs">Tarifa</dt>
                <dd className="text-gray-900">
export const dynamic = "force-dynamic";
                  {caso.tarifa_base ? `$${Number(caso.tarifa_base).toLocaleString("es-CO")}` : "Sin definir"}
                  {caso.tarifa_pagada && <span className="ml-2 text-green-600 text-xs">✓ Pagada</span>}
export const dynamic = "force-dynamic";
                </dd>
              </div>
export const dynamic = "force-dynamic";
            </dl>
          </div>
export const dynamic = "force-dynamic";

          {/* Conciliador */}
export const dynamic = "force-dynamic";
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Conciliador</h3>
export const dynamic = "force-dynamic";
            {caso.conciliador ? (
              <div>
export const dynamic = "force-dynamic";
                <p className="text-sm font-medium text-gray-900">{caso.conciliador.nombre}</p>
                <p className="text-xs text-gray-500">{caso.conciliador.email}</p>
export const dynamic = "force-dynamic";
                {caso.conciliador.tarjeta_profesional && (
                  <p className="text-xs text-gray-400 mt-1">T.P. {caso.conciliador.tarjeta_profesional}</p>
export const dynamic = "force-dynamic";
                )}
              </div>
export const dynamic = "force-dynamic";
            ) : (
              <p className="text-sm text-amber-600">Sin asignar</p>
export const dynamic = "force-dynamic";
            )}
          </div>
export const dynamic = "force-dynamic";

          {/* Sala */}
export const dynamic = "force-dynamic";
          {caso.sala && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
export const dynamic = "force-dynamic";
              <h3 className="font-semibold text-gray-900 mb-3">Sala</h3>
              <p className="text-sm font-medium text-gray-900">{caso.sala.nombre}</p>
export const dynamic = "force-dynamic";
              <p className="text-xs text-gray-500 capitalize">{caso.sala.tipo}</p>
              {caso.sala.link_virtual && (
export const dynamic = "force-dynamic";
                <a href={caso.sala.link_virtual} target="_blank" className="text-xs text-[#B8860B] hover:underline mt-1 block">
                  Enlace virtual →
export const dynamic = "force-dynamic";
                </a>
              )}
export const dynamic = "force-dynamic";
            </div>
          )}
export const dynamic = "force-dynamic";

          {/* Acciones rápidas */}
export const dynamic = "force-dynamic";
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Acciones</h3>
export const dynamic = "force-dynamic";
            <div className="space-y-2">
              {caso.estado === "solicitud" && (
export const dynamic = "force-dynamic";
                <Link href={`/casos/${id}/admision`} className="block w-full text-center bg-[#0D2340] text-white text-sm py-2 px-3 rounded-lg hover:bg-[#0d2340dd] transition-colors">
                  Procesar admisión
export const dynamic = "force-dynamic";
                </Link>
              )}
export const dynamic = "force-dynamic";
              {caso.estado === "admitido" && (
                <Link href={`/casos/${id}/citacion`} className="block w-full text-center bg-[#0D2340] text-white text-sm py-2 px-3 rounded-lg hover:bg-[#0d2340dd] transition-colors">
export const dynamic = "force-dynamic";
                  Generar citación
                </Link>
export const dynamic = "force-dynamic";
              )}
              {caso.estado === "citado" && (
export const dynamic = "force-dynamic";
                <Link href={`/casos/${id}/audiencia`} className="block w-full text-center bg-[#0D2340] text-white text-sm py-2 px-3 rounded-lg hover:bg-[#0d2340dd] transition-colors">
                  Programar audiencia
export const dynamic = "force-dynamic";
                </Link>
              )}
export const dynamic = "force-dynamic";
              {["audiencia", "citado"].includes(caso.estado) && (
                <Link href={`/casos/${id}/acta`} className="block w-full text-center bg-[#B8860B] text-white text-sm py-2 px-3 rounded-lg hover:bg-[#a07509] transition-colors">
export const dynamic = "force-dynamic";
                  Generar acta
                </Link>
export const dynamic = "force-dynamic";
              )}
              <Link href={`/casos/${id}/documentos`} className="block w-full text-center border border-gray-200 text-gray-600 text-sm py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors">
export const dynamic = "force-dynamic";
                Subir documento
              </Link>
export const dynamic = "force-dynamic";
            </div>
          </div>
export const dynamic = "force-dynamic";
        </div>
      </div>
export const dynamic = "force-dynamic";
    </div>
  );
export const dynamic = "force-dynamic";
}
