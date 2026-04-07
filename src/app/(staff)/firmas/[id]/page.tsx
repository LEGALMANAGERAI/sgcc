export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { PageHeader } from "@/components/ui/PageHeader";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  User,
  Calendar,
  Hash,
  Shield,
  Clock,
} from "lucide-react";
import { redirect, notFound } from "next/navigation";
import type {
  SgccFirmaDocumento,
  SgccFirmante,
  SgccFirmaRegistro,
  FirmaEstado,
  FirmanteEstado,
} from "@/types/firma";
import { FirmaDetailActions } from "./FirmaDetailActions";

/* ─── Colores de estado ──────────────────────────────────────────────── */

const estadoDocConfig: Record<FirmaEstado, { label: string; bg: string; text: string }> = {
  pendiente: { label: "Pendiente", bg: "bg-yellow-100", text: "text-yellow-800" },
  enviado: { label: "Enviado", bg: "bg-blue-100", text: "text-blue-800" },
  en_proceso: { label: "En proceso", bg: "bg-indigo-100", text: "text-indigo-800" },
  completado: { label: "Completado", bg: "bg-green-100", text: "text-green-800" },
  rechazado: { label: "Rechazado", bg: "bg-red-100", text: "text-red-800" },
  expirado: { label: "Expirado", bg: "bg-gray-100", text: "text-gray-600" },
};

const estadoFirmanteConfig: Record<FirmanteEstado, { label: string; bg: string; text: string }> = {
  pendiente: { label: "Pendiente", bg: "bg-yellow-100", text: "text-yellow-800" },
  enviado: { label: "Enviado", bg: "bg-blue-100", text: "text-blue-800" },
  visto: { label: "Visto", bg: "bg-purple-100", text: "text-purple-800" },
  firmado: { label: "Firmado", bg: "bg-green-100", text: "text-green-800" },
  rechazado: { label: "Rechazado", bg: "bg-red-100", text: "text-red-800" },
  expirado: { label: "Expirado", bg: "bg-gray-100", text: "text-gray-600" },
};

const accionLabels: Record<string, string> = {
  otp_solicitado: "C\u00f3digo OTP solicitado",
  otp_verificado: "C\u00f3digo OTP verificado",
  firmado: "Documento firmado",
  rechazado: "Documento rechazado",
  visto: "Documento visualizado",
  enviado: "Invitaci\u00f3n enviada",
};

/* ─── Page ───────────────────────────────────────────────────────────── */

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function FirmaDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as any;
  const centerId = user.centerId;

  /* ─── Queries ────────────────────────────────────────────────────── */

  const [
    { data: rawDoc },
    { data: rawFirmantes },
    { data: rawRegistros },
  ] = await Promise.all([
    supabaseAdmin
      .from("sgcc_firma_documentos")
      .select("*, caso:sgcc_cases(id, numero_radicado), creador:sgcc_staff!creado_por(nombre)")
      .eq("id", id)
      .eq("center_id", centerId)
      .single(),
    supabaseAdmin
      .from("sgcc_firmantes")
      .select("*")
      .eq("firma_documento_id", id)
      .order("orden", { ascending: true }),
    supabaseAdmin
      .from("sgcc_firma_registros")
      .select("*, firmante:sgcc_firmantes(nombre)")
      .eq("firma_documento_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!rawDoc) notFound();

  const doc = rawDoc as SgccFirmaDocumento & {
    caso: { id: string; numero_radicado: string } | null;
    creador: { nombre: string } | null;
  };
  const firmantes = (rawFirmantes ?? []) as SgccFirmante[];
  const registros = (rawRegistros ?? []) as (SgccFirmaRegistro & {
    firmante: { nombre: string } | null;
  })[];

  const estado = estadoDocConfig[doc.estado];
  const progreso = doc.total_firmantes > 0
    ? Math.round((doc.firmantes_completados / doc.total_firmantes) * 100)
    : 0;

  /* ─── Render ─────────────────────────────────────────────────────── */

  return (
    <div>
      <PageHeader title={doc.nombre} subtitle="Detalle del documento de firma electr\u00f3nica">
        <Link
          href="/firmas"
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </Link>
      </PageHeader>

      {/* Header con estado y progreso */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-[#0D2340]" />
            <div>
              <h2 className="text-lg font-bold text-gray-900">{doc.nombre}</h2>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${estado.bg} ${estado.text}`}
              >
                {estado.label}
              </span>
            </div>
          </div>

          {/* Barra de progreso */}
          <div className="sm:w-64">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-500">Progreso</span>
              <span className="font-semibold text-[#0D2340]">
                {doc.firmantes_completados}/{doc.total_firmantes} firmantes
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-[#1B4F9B] h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${progreso}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[65%_35%] gap-6 mb-6">
        {/* Columna izquierda */}
        <div className="space-y-6">
          {/* Informaci\u00f3n del documento */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Informaci&#243;n</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {doc.descripcion && (
                <div className="sm:col-span-2">
                  <dt className="text-gray-500 mb-1">Descripci&#243;n</dt>
                  <dd className="text-gray-900">{doc.descripcion}</dd>
                </div>
              )}
              <div>
                <dt className="text-gray-500 mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5" /> Creado por
                </dt>
                <dd className="text-gray-900">{doc.creador?.nombre ?? "&#8212;"}</dd>
              </div>
              <div>
                <dt className="text-gray-500 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Fecha de creaci&#243;n
                </dt>
                <dd className="text-gray-900">
                  {new Date(doc.created_at).toLocaleString("es-CO", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </dd>
              </div>
              {doc.caso && (
                <div>
                  <dt className="text-gray-500 mb-1">Caso vinculado</dt>
                  <dd>
                    <Link
                      href={`/expediente/${doc.caso.id}`}
                      className="text-[#1B4F9B] hover:underline"
                    >
                      {doc.caso.numero_radicado}
                    </Link>
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-gray-500 mb-1 flex items-center gap-1">
                  <Hash className="w-3.5 h-3.5" /> Hash SHA-256
                </dt>
                <dd className="text-gray-900 font-mono text-xs break-all">{doc.archivo_hash}</dd>
              </div>
              {doc.fecha_expiracion && (
                <div>
                  <dt className="text-gray-500 mb-1">Expira</dt>
                  <dd className="text-gray-900">
                    {new Date(doc.fecha_expiracion).toLocaleString("es-CO", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Tabla de firmantes */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Firmantes</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">#</th>
                    <th className="px-3 py-3 text-xs font-medium text-gray-500 uppercase">Nombre</th>
                    <th className="px-3 py-3 text-xs font-medium text-gray-500 uppercase">C&#233;dula</th>
                    <th className="px-3 py-3 text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-3 py-3 text-xs font-medium text-gray-500 uppercase">Estado</th>
                    <th className="px-3 py-3 text-xs font-medium text-gray-500 uppercase">Fecha firma</th>
                    <th className="px-3 py-3 text-xs font-medium text-gray-500 uppercase">Motivo rechazo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {firmantes.map((f) => {
                    const est = estadoFirmanteConfig[f.estado];
                    return (
                      <tr key={f.id} className="hover:bg-gray-50/50">
                        <td className="px-6 py-3">
                          <span className="inline-flex items-center justify-center w-6 h-6 bg-[#0D2340] text-white text-xs font-bold rounded-full">
                            {f.orden}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-medium text-gray-900">{f.nombre}</td>
                        <td className="px-3 py-3 text-gray-600">{f.cedula}</td>
                        <td className="px-3 py-3 text-gray-600">{f.email}</td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${est.bg} ${est.text}`}
                          >
                            {est.label}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-gray-500 text-xs">
                          {f.firmado_at
                            ? new Date(f.firmado_at).toLocaleString("es-CO", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })
                            : "&#8212;"}
                        </td>
                        <td className="px-3 py-3 text-red-600 text-xs">
                          {f.motivo_rechazo ?? ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Columna derecha */}
        <div className="space-y-6">
          {/* Acciones */}
          <FirmaDetailActions
            documentId={doc.id}
            estado={doc.estado}
            archivoUrl={doc.archivo_url}
            archivoFirmadoUrl={doc.archivo_firmado_url}
          />

          {/* Audit trail */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#0D2340]" />
                Registro de auditor&#237;a
              </h3>
            </div>
            <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
              {registros.length === 0 ? (
                <p className="px-5 py-6 text-sm text-gray-400 text-center">
                  Sin registros a&#250;n
                </p>
              ) : (
                registros.map((r) => (
                  <div key={r.id} className="px-5 py-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-gray-900">
                          {accionLabels[r.accion] ?? r.accion}
                        </p>
                        {r.firmante && (
                          <p className="text-xs text-gray-500">
                            Por: {r.firmante.nombre}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-gray-400">
                            {new Date(r.created_at).toLocaleString("es-CO", {
                              dateStyle: "short",
                              timeStyle: "medium",
                            })}
                          </span>
                          {r.ip && (
                            <span className="text-xs text-gray-400">
                              IP: {r.ip}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
