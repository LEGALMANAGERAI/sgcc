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

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CasoDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  const centerId = (session!.user as any).centerId;

  const { data: caso } = await supabaseAdmin
    .from("sgcc_cases")
    .select(`
      *,
      conciliador:sgcc_staff!sgcc_cases_conciliador_id_fkey(id, nombre, tarjeta_profesional, email),
      secretario:sgcc_staff!sgcc_cases_secretario_id_fkey(id, nombre),
      sala:sgcc_rooms(id, nombre, tipo, link_virtual),
      partes:sgcc_case_parties(
        id, rol, asistio, firmo_acta, citacion_enviada_at, citacion_confirmada_at,
        apoderado_nombre,
        party:sgcc_parties(id, tipo_persona, nombres, apellidos, razon_social, numero_doc, nit_empresa, email, telefono, tipo_doc)
      ),
      actas:sgcc_actas(id, numero_acta, tipo, estado_firma, borrador_url, acta_firmada_url, fecha_acta, es_constancia),
      audiencias:sgcc_hearings(
        id, fecha_hora, duracion_min, estado, tipo, notas_previas,
        conciliador:sgcc_staff(nombre),
        sala:sgcc_rooms(nombre)
      ),
      documentos:sgcc_documents(id, tipo, nombre, url, created_at, subido_por_staff, subido_por_party),
      timeline:sgcc_case_timeline(id, etapa, descripcion, completado, fecha)
    `)
    .eq("id", id)
    .eq("center_id", centerId)
    .single();

  if (!caso) notFound();

  const convocante = caso.partes?.find((p: any) => p.rol === "convocante");
  const convocados = caso.partes?.filter((p: any) => p.rol === "convocado") ?? [];

  // Siguiente acción disponible según estado
  const nextAction = {
    solicitud: { label: "Procesar admisión", href: `/casos/${id}/admision` },
    admitido: { label: "Generar citación", href: `/casos/${id}/citacion` },
    citado: { label: "Programar audiencia", href: `/casos/${id}/audiencia` },
    audiencia: { label: "Generar acta", href: `/casos/${id}/acta` },
    cerrado: null,
    rechazado: null,
  }[caso.estado as string] ?? null;

  return (
    <div>
      <div className="mb-2">
        <Link href="/casos" className="text-xs text-gray-400 hover:text-gray-600">
          ← Casos
        </Link>
      </div>

      <PageHeader
        title={caso.numero_radicado}
        subtitle={`Materia: ${caso.materia} · Radicado: ${new Date(caso.fecha_solicitud).toLocaleDateString("es-CO")}`}
      >
        <StatusChip value={caso.estado} type="case" size="md" />
        {nextAction && (
          <Link
            href={nextAction.href}
            className="bg-[#1B4F9B] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#a07509] transition-colors"
          >
            {nextAction.label} →
          </Link>
        )}
      </PageHeader>

      {/* Timeline */}
      <CasoTimeline estado={caso.estado} events={caso.timeline ?? []} />

      {/* Rechazo */}
      {caso.estado === "rechazado" && caso.motivo_rechazo && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 mb-6">
          <p className="text-sm font-medium text-red-800">Motivo de rechazo</p>
          <p className="text-sm text-red-700 mt-1">{caso.motivo_rechazo}</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Columna principal (2/3) */}
        <div className="col-span-2 space-y-6">
          {/* Descripción */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Hechos y pretensiones</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{caso.descripcion}</p>
          </section>

          {/* Partes */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Partes</h3>
            <div className="space-y-3">
              {caso.partes?.map((cp: any) => (
                <div key={cp.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-1 ${cp.rol === "convocante" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>
                      {cp.rol === "convocante" ? "Convocante" : "Convocado"}
                    </span>
                    <p className="text-sm font-medium text-gray-900">{partyDisplayName(cp.party)}</p>
                    <p className="text-xs text-gray-500">{cp.party.email} {cp.party.telefono ? `· ${cp.party.telefono}` : ""}</p>
                    {cp.apoderado_nombre && (
                      <p className="text-xs text-gray-400 mt-1">Apoderado: {cp.apoderado_nombre}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {cp.citacion_enviada_at && (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Citado
                      </span>
                    )}
                    {cp.asistio === true && <span className="text-xs text-green-600">Asistió ✓</span>}
                    {cp.asistio === false && <span className="text-xs text-red-500">No asistió</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Audiencias */}
          {caso.audiencias?.length > 0 && (
            <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Audiencias</h3>
                <Link href={`/casos/${id}/audiencia`} className="text-xs text-[#1B4F9B] hover:underline">
                  + Programar
                </Link>
              </div>
              <div className="space-y-2">
                {caso.audiencias.map((h: any) => (
                  <div key={h.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                    <div>
                      <p className="font-medium text-gray-900">
                        {new Date(h.fecha_hora).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}
                      </p>
                      <p className="text-xs text-gray-500">
                        {h.sala?.nombre ?? "Sala por definir"} · {h.tipo}
                        {h.conciliador && ` · ${h.conciliador.nombre}`}
                      </p>
                    </div>
                    <StatusChip value={h.estado} type="hearing" />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Actas */}
          {caso.actas?.length > 0 && (
            <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Actas</h3>
              </div>
              <div className="space-y-2">
                {caso.actas.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                    <div>
                      <p className="font-medium text-gray-900">{a.numero_acta}</p>
                      <p className="text-xs text-gray-500 capitalize">{a.tipo.replace(/_/g, " ")} · {new Date(a.fecha_acta).toLocaleDateString("es-CO")}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusChip value={a.estado_firma} type="firma" />
                      {a.borrador_url && (
                        <a href={a.borrador_url} target="_blank" className="text-[#1B4F9B] hover:underline text-xs flex items-center gap-1">
                          <Download className="w-3 h-3" /> Borrador
                        </a>
                      )}
                      {a.acta_firmada_url && (
                        <a href={a.acta_firmada_url} target="_blank" className="text-green-600 hover:underline text-xs flex items-center gap-1">
                          <Download className="w-3 h-3" /> Firmada
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <Link href={`/casos/${id}/acta`} className="text-xs text-[#1B4F9B] hover:underline">
                  + Nueva acta / constancia
                </Link>
              </div>
            </section>
          )}

          {/* Documentos */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Documentos</h3>
              <Link href={`/expediente/${id}?tab=documentos`} className="text-xs text-[#1B4F9B] hover:underline">
                + Subir
              </Link>
            </div>
            {!caso.documentos?.length ? (
              <p className="text-sm text-gray-400">Sin documentos adjuntos</p>
            ) : (
              <div className="space-y-2">
                {caso.documentos.map((d: any) => (
                  <div key={d.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900">{d.nombre}</p>
                        <p className="text-xs text-gray-500 capitalize">{d.tipo} · {new Date(d.created_at).toLocaleDateString("es-CO")}</p>
                      </div>
                    </div>
                    <a href={d.url} target="_blank" className="text-[#1B4F9B] hover:underline text-xs flex items-center gap-1">
                      <Download className="w-3 h-3" /> Descargar
                    </a>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Sidebar derecho (1/3) */}
        <div className="space-y-4">
          {/* Info general */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Información</h3>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-500 text-xs">Cuantía</dt>
                <dd className="text-gray-900 font-medium">
                  {caso.cuantia_indeterminada ? "Indeterminada" : caso.cuantia ? `$${Number(caso.cuantia).toLocaleString("es-CO")}` : "Sin cuantía"}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs">Fecha solicitud</dt>
                <dd className="text-gray-900">{new Date(caso.fecha_solicitud).toLocaleDateString("es-CO")}</dd>
              </div>
              {caso.fecha_admision && (
                <div>
                  <dt className="text-gray-500 text-xs">Fecha admisión</dt>
                  <dd className="text-gray-900">{new Date(caso.fecha_admision).toLocaleDateString("es-CO")}</dd>
                </div>
              )}
              {caso.fecha_limite_citacion && (
                <div>
                  <dt className="text-gray-500 text-xs">Límite citación</dt>
                  <dd className={`font-medium ${new Date(caso.fecha_limite_citacion) < new Date() ? "text-red-600" : "text-gray-900"}`}>
                    {new Date(caso.fecha_limite_citacion).toLocaleDateString("es-CO")}
                  </dd>
                </div>
              )}
              {caso.fecha_audiencia && (
                <div>
                  <dt className="text-gray-500 text-xs">Audiencia</dt>
                  <dd className="text-gray-900">{new Date(caso.fecha_audiencia).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}</dd>
                </div>
              )}
              <div>
                <dt className="text-gray-500 text-xs">Tarifa</dt>
                <dd className="text-gray-900">
                  {caso.tarifa_base ? `$${Number(caso.tarifa_base).toLocaleString("es-CO")}` : "Sin definir"}
                  {caso.tarifa_pagada && <span className="ml-2 text-green-600 text-xs">✓ Pagada</span>}
                </dd>
              </div>
            </dl>
          </div>

          {/* Conciliador */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Conciliador</h3>
            {caso.conciliador ? (
              <div>
                <p className="text-sm font-medium text-gray-900">{caso.conciliador.nombre}</p>
                <p className="text-xs text-gray-500">{caso.conciliador.email}</p>
                {caso.conciliador.tarjeta_profesional && (
                  <p className="text-xs text-gray-400 mt-1">T.P. {caso.conciliador.tarjeta_profesional}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-amber-600">Sin asignar</p>
            )}
          </div>

          {/* Sala */}
          {caso.sala && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Sala</h3>
              <p className="text-sm font-medium text-gray-900">{caso.sala.nombre}</p>
              <p className="text-xs text-gray-500 capitalize">{caso.sala.tipo}</p>
              {caso.sala.link_virtual && (
                <a href={caso.sala.link_virtual} target="_blank" className="text-xs text-[#1B4F9B] hover:underline mt-1 block">
                  Enlace virtual →
                </a>
              )}
            </div>
          )}

          {/* Acciones rápidas */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Acciones</h3>
            <div className="space-y-2">
              {caso.estado === "solicitud" && (
                <Link href={`/casos/${id}/admision`} className="block w-full text-center bg-[#0D2340] text-white text-sm py-2 px-3 rounded-lg hover:bg-[#0d2340dd] transition-colors">
                  Procesar admisión
                </Link>
              )}
              {caso.estado === "admitido" && (
                <Link href={`/casos/${id}/citacion`} className="block w-full text-center bg-[#0D2340] text-white text-sm py-2 px-3 rounded-lg hover:bg-[#0d2340dd] transition-colors">
                  Generar citación
                </Link>
              )}
              {caso.estado === "citado" && (
                <Link href={`/casos/${id}/audiencia`} className="block w-full text-center bg-[#0D2340] text-white text-sm py-2 px-3 rounded-lg hover:bg-[#0d2340dd] transition-colors">
                  Programar audiencia
                </Link>
              )}
              {["audiencia", "citado"].includes(caso.estado) && (
                <Link href={`/expediente/${id}`} className="block w-full text-center bg-[#1B4F9B] text-white text-sm py-2 px-3 rounded-lg hover:bg-[#a07509] transition-colors">
                  Generar acta
                </Link>
              )}
              <Link href={`/expediente/${id}?tab=documentos`} className="block w-full text-center border border-gray-200 text-gray-600 text-sm py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors">
                Subir documento
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
