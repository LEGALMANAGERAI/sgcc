export const dynamic = "force-dynamic";

import { supabaseAdmin } from "@/lib/supabase";
import { Scale, CheckCircle2, XCircle, Clock, Shield } from "lucide-react";
import { notFound } from "next/navigation";
import type { SgccFirmaDocumento, SgccFirmante, FirmanteEstado } from "@/types/firma";

/* ─── Colores ────────────────────────────────────────────────────────── */

const estadoFirmanteConfig: Record<FirmanteEstado, { label: string; bg: string; text: string }> = {
  pendiente: { label: "Pendiente", bg: "bg-yellow-100", text: "text-yellow-800" },
  enviado: { label: "Enviado", bg: "bg-blue-100", text: "text-blue-800" },
  visto: { label: "Visto", bg: "bg-purple-100", text: "text-purple-800" },
  firmado: { label: "Firmado", bg: "bg-green-100", text: "text-green-800" },
  rechazado: { label: "Rechazado", bg: "bg-red-100", text: "text-red-800" },
  expirado: { label: "Expirado", bg: "bg-gray-100", text: "text-gray-600" },
};

const estadoDocLabels: Record<string, { label: string; color: string }> = {
  pendiente: { label: "Pendiente", color: "text-yellow-700" },
  enviado: { label: "Enviado", color: "text-blue-700" },
  en_proceso: { label: "En proceso", color: "text-indigo-700" },
  completado: { label: "Completado", color: "text-green-700" },
  rechazado: { label: "Rechazado", color: "text-red-700" },
  expirado: { label: "Expirado", color: "text-gray-600" },
};

/* ─── Page ───────────────────────────────────────────────────────────── */

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function VerificarPage({ params }: PageProps) {
  const { id } = await params;

  const [{ data: rawDoc }, { data: rawFirmantes }] = await Promise.all([
    supabaseAdmin
      .from("sgcc_firma_documentos")
      .select("id, nombre, estado, archivo_hash, created_at, total_firmantes, firmantes_completados")
      .eq("id", id)
      .single(),
    supabaseAdmin
      .from("sgcc_firmantes")
      .select("nombre, cedula, estado, firmado_at")
      .eq("firma_documento_id", id)
      .order("orden", { ascending: true }),
  ]);

  if (!rawDoc) {
    return (
      <div className="min-h-screen bg-[#F4F6F9] flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center max-w-md w-full">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Documento no encontrado</h2>
          <p className="text-sm text-gray-600">
            El documento solicitado no existe o ha sido eliminado.
          </p>
        </div>
      </div>
    );
  }

  const doc = rawDoc as Pick<
    SgccFirmaDocumento,
    "id" | "nombre" | "estado" | "archivo_hash" | "created_at" | "total_firmantes" | "firmantes_completados"
  >;
  const firmantes = (rawFirmantes ?? []) as Pick<SgccFirmante, "nombre" | "cedula" | "estado" | "firmado_at">[];
  const estadoDoc = estadoDocLabels[doc.estado] ?? { label: doc.estado, color: "text-gray-600" };
  const isCompletado = doc.estado === "completado";

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      {/* Header */}
      <header className="bg-[#0D2340] py-6">
        <div className="max-w-[700px] mx-auto px-4 flex items-center justify-center gap-3">
          <Scale className="w-7 h-7 text-[#1B4F9B]" />
          <div className="text-center">
            <p className="text-white font-bold text-lg">SGCC</p>
            <p className="text-white/50 text-xs">Verificaci&#243;n de Firma Electr&#243;nica</p>
          </div>
        </div>
      </header>

      <main className="max-w-[700px] mx-auto px-4 py-8">
        {/* Estado principal */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center mb-6">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
              isCompletado ? "bg-green-100" : "bg-yellow-100"
            }`}
          >
            {isCompletado ? (
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            ) : (
              <Clock className="w-8 h-8 text-yellow-600" />
            )}
          </div>

          <h1 className="text-xl font-bold text-gray-900 mb-1">{doc.nombre}</h1>
          <p className={`text-sm font-medium ${estadoDoc.color}`}>
            Estado: {estadoDoc.label}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {doc.firmantes_completados}/{doc.total_firmantes} firmantes completados
          </p>
        </div>

        {/* Hash */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#0D2340]" />
            Integridad del documento
          </h2>

          <div className="space-y-3 text-sm">
            <div>
              <p className="text-gray-500 text-xs mb-1">Hash SHA-256</p>
              <p className="font-mono text-xs bg-gray-50 p-3 rounded-lg break-all text-gray-900 border">
                {doc.archivo_hash}
              </p>
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-1">Fecha de creaci&#243;n</p>
              <p className="text-gray-900">
                {new Date(doc.created_at).toLocaleString("es-CO", {
                  dateStyle: "full",
                  timeStyle: "medium",
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Firmantes */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Firmantes</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Nombre</th>
                  <th className="px-3 py-3 text-xs font-medium text-gray-500 uppercase">C&#233;dula</th>
                  <th className="px-3 py-3 text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-3 py-3 text-xs font-medium text-gray-500 uppercase">Fecha firma</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {firmantes.map((f, i) => {
                  const est = estadoFirmanteConfig[f.estado];
                  // Enmascarar c\u00e9dula parcialmente
                  const cedulaMask = f.cedula.length > 4
                    ? "***" + f.cedula.slice(-4)
                    : f.cedula;

                  return (
                    <tr key={i}>
                      <td className="px-6 py-3 font-medium text-gray-900">{f.nombre}</td>
                      <td className="px-3 py-3 text-gray-600 font-mono text-xs">{cedulaMask}</td>
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Texto legal */}
        <div className="bg-[#0D2340]/5 rounded-xl p-5 text-center">
          <p className="text-xs text-gray-600 leading-relaxed">
            Este documento fue firmado electr&#243;nicamente conforme a la{" "}
            <strong>Ley 527 de 1999</strong> y el{" "}
            <strong>Decreto 2364 de 2012</strong> de la Rep&#250;blica de Colombia.
            La firma electr&#243;nica tiene la misma validez jur&#237;dica que la firma manuscrita,
            siempre que se cumplan los requisitos de autenticidad e integridad del mensaje de datos.
          </p>
          <p className="text-xs text-gray-400 mt-3">
            Verificado por SGCC &#8212; Sistema de Gesti&#243;n de Centros de Conciliaci&#243;n
          </p>
        </div>
      </main>
    </div>
  );
}
