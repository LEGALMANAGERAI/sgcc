export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import Link from "next/link";
import {
  FileSignature,
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  FileText,
  Eye,
} from "lucide-react";
import { redirect } from "next/navigation";
import type { SgccFirmaDocumento, FirmaEstado } from "@/types/firma";

/* ─── Colores de estado ──────────────────────────────────────────────── */

const estadoConfig: Record<FirmaEstado, { label: string; bg: string; text: string }> = {
  pendiente: { label: "Pendiente", bg: "bg-yellow-100", text: "text-yellow-800" },
  enviado: { label: "Enviado", bg: "bg-blue-100", text: "text-blue-800" },
  en_proceso: { label: "En proceso", bg: "bg-indigo-100", text: "text-indigo-800" },
  completado: { label: "Completado", bg: "bg-green-100", text: "text-green-800" },
  rechazado: { label: "Rechazado", bg: "bg-red-100", text: "text-red-800" },
  expirado: { label: "Expirado", bg: "bg-gray-100", text: "text-gray-600" },
};

/* ─── Page ───────────────────────────────────────────────────────────── */

export default async function FirmasPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as any;
  const centerId = user.centerId;

  /* ─── Queries ────────────────────────────────────────────────────── */

  const { data: rawDocs } = await supabaseAdmin
    .from("sgcc_firma_documentos")
    .select("*, caso:sgcc_cases(id, numero_radicado)")
    .eq("center_id", centerId)
    .order("created_at", { ascending: false });

  const docs = (rawDocs ?? []) as (SgccFirmaDocumento & {
    caso: { id: string; numero_radicado: string } | null;
  })[];

  /* ─── Stats ──────────────────────────────────────────────────────── */

  const total = docs.length;
  const pendientes = docs.filter((d) => d.estado === "pendiente" || d.estado === "enviado").length;
  const enProceso = docs.filter((d) => d.estado === "en_proceso").length;
  const completados = docs.filter((d) => d.estado === "completado").length;
  const rechazados = docs.filter((d) => d.estado === "rechazado").length;

  /* ─── Render ─────────────────────────────────────────────────────── */

  return (
    <div>
      <PageHeader title="Firmas Electr&#243;nicas" subtitle="Gestiona documentos con firma electr&#243;nica certificada">
        <Link
          href="/firmas/nueva"
          className="bg-[#0D2340] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0d2340dd] transition-colors flex items-center gap-2"
        >
          <FileSignature className="w-4 h-4" />
          Nueva Firma
        </Link>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard label="Total documentos" value={total} icon={FileText} color="navy" />
        <StatCard label="Pendientes" value={pendientes} icon={Clock} color="gold" />
        <StatCard label="En proceso" value={enProceso} icon={Loader2} color="blue" />
        <StatCard label="Completados" value={completados} icon={CheckCircle2} color="green" />
        <StatCard label="Rechazados" value={rechazados} icon={XCircle} color="red" />
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Firmantes
                </th>
                <th className="px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Caso vinculado
                </th>
                <th className="px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Creado
                </th>
                <th className="px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {docs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-gray-400">
                    <FileSignature className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                    <p className="font-medium">No hay documentos de firma</p>
                    <p className="text-xs mt-1">Crea tu primer documento con firma electr&#243;nica</p>
                  </td>
                </tr>
              ) : (
                docs.map((doc) => {
                  const estado = estadoConfig[doc.estado];
                  return (
                    <tr key={doc.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3">
                        <Link
                          href={`/firmas/${doc.id}`}
                          className="text-[#0D2340] font-medium hover:underline"
                        >
                          {doc.nombre}
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${estado.bg} ${estado.text}`}
                        >
                          {estado.label}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-gray-600">
                        <span className="font-medium">{doc.firmantes_completados}</span>
                        <span className="text-gray-400">/{doc.total_firmantes}</span>
                      </td>
                      <td className="px-3 py-3">
                        {doc.caso ? (
                          <Link
                            href={`/expediente/${doc.caso.id}`}
                            className="text-xs text-[#B8860B] hover:underline"
                          >
                            {doc.caso.numero_radicado}
                          </Link>
                        ) : (
                          <span className="text-gray-300">&#8212;</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500">
                        {new Date(doc.created_at).toLocaleDateString("es-CO", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          href={`/firmas/${doc.id}`}
                          className="inline-flex items-center gap-1 text-xs text-[#0D2340] hover:text-[#B8860B] transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Ver detalle
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
