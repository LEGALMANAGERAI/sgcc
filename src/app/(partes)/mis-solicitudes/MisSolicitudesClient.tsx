"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Plus, Trash2 } from "lucide-react";
import type { TipoTramite } from "@/types";

const TRAMITE_LABEL: Record<TipoTramite, string> = {
  conciliacion: "Conciliación",
  insolvencia: "Insolvencia",
  acuerdo_apoyo: "Acuerdo de apoyo",
  arbitraje_ejecutivo: "Arbitraje ejecutivo",
  directiva_anticipada: "Directiva anticipada",
};

interface Draft {
  id: string;
  tipo_tramite: TipoTramite;
  step_actual: number;
  completado_pct: number;
  updated_at: string;
}
interface Caso {
  id: string;
  numero_radicado: string;
  tipo_tramite: string;
  estado: string;
  fecha_solicitud: string;
}

export function MisSolicitudesClient({
  drafts,
  casos,
}: {
  drafts: Draft[];
  casos: Caso[];
}) {
  const router = useRouter();

  async function borrarDraft(id: string) {
    if (!confirm("¿Borrar este borrador?")) return;
    await fetch(`/api/partes/solicitudes/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#0D2340]">Mis Solicitudes</h1>
        <Link
          href="/mis-solicitudes/nueva"
          className="inline-flex items-center gap-2 bg-[#0D2340] text-white px-4 py-2 rounded-lg hover:bg-[#0d2340dd] transition-colors text-sm"
        >
          <Plus className="w-4 h-4" /> Nueva solicitud
        </Link>
      </div>

      {drafts.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">
            En borrador
          </h2>
          <div className="grid gap-3">
            {drafts.map((d) => (
              <div
                key={d.id}
                className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between"
              >
                <Link
                  href={`/mis-solicitudes/${d.id}`}
                  className="flex items-center gap-3 flex-1"
                >
                  <FileText className="w-5 h-5 text-gray-400" />
                  <div>
                    <div className="font-medium text-gray-800">
                      {TRAMITE_LABEL[d.tipo_tramite]}
                    </div>
                    <div className="text-xs text-gray-500">
                      {d.completado_pct}% completado · Actualizado{" "}
                      {new Date(d.updated_at).toLocaleDateString("es-CO")}
                    </div>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => borrarDraft(d.id)}
                  className="text-red-600 hover:bg-red-50 rounded p-2"
                  aria-label="Borrar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">
          Radicadas
        </h2>
        {casos.length === 0 ? (
          <p className="text-sm text-gray-500 bg-white rounded-xl border border-gray-200 p-6 text-center">
            Aún no has radicado solicitudes.
          </p>
        ) : (
          <div className="grid gap-3">
            {casos.map((c) => (
              <Link
                key={c.id}
                href={`/mis-casos/${c.id}`}
                className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between hover:shadow-sm transition-shadow"
              >
                <div>
                  <div className="font-medium text-[#1B4F9B]">
                    {c.numero_radicado}
                  </div>
                  <div className="text-xs text-gray-500">
                    {TRAMITE_LABEL[c.tipo_tramite as TipoTramite] ?? c.tipo_tramite} ·{" "}
                    {c.estado} ·{" "}
                    {new Date(c.fecha_solicitud).toLocaleDateString("es-CO")}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
