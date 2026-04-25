export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import Link from "next/link";
import { AudienciaForm } from "@/components/modules/casos/AudienciaForm";
import { CollaborationBar } from "@/components/ui/CollaborationBar";

interface Props {
  params: Promise<{ id: string }>;
}

const TIPO_LABEL: Record<string, string> = {
  inicial: "Inicial",
  continuacion: "Continuación",
  complementaria: "Complementaria",
};

const ESTADO_COLOR: Record<string, string> = {
  programada: "bg-blue-100 text-blue-700",
  en_curso: "bg-amber-100 text-amber-700",
  suspendida: "bg-orange-100 text-orange-700",
  finalizada: "bg-green-100 text-green-700",
  cancelada: "bg-gray-200 text-gray-600",
};

export default async function AudienciaPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  const centerId = (session!.user as any).centerId;

  const { data: caso } = await supabaseAdmin
    .from("sgcc_cases")
    .select("id, numero_radicado, materia, estado, fecha_audiencia, conciliador_id, secretario_id, sala_id")
    .eq("id", id)
    .eq("center_id", centerId)
    .single();

  if (!caso) notFound();

  // Conciliador solo accede si está designado en el caso
  const sgccRol = (session!.user as any).sgccRol;
  const userId = (session!.user as any).id;
  if (sgccRol === "conciliador" && caso.conciliador_id !== userId && caso.secretario_id !== userId) {
    notFound();
  }

  const [{ data: conciliadores }, { data: salas }, { data: audiencias }] = await Promise.all([
    supabaseAdmin
      .from("sgcc_staff")
      .select("id, nombre")
      .eq("center_id", centerId)
      .eq("rol", "conciliador")
      .eq("activo", true)
      .order("nombre"),
    supabaseAdmin
      .from("sgcc_rooms")
      .select("id, nombre, tipo, link_virtual")
      .eq("center_id", centerId)
      .eq("activa", true)
      .order("nombre"),
    supabaseAdmin
      .from("sgcc_hearings")
      .select("id, fecha_hora, duracion_min, estado, tipo, conciliador:sgcc_staff(nombre), sala:sgcc_rooms(nombre)")
      .eq("case_id", id)
      .order("fecha_hora", { ascending: true }),
  ]);

  const yaHayAudiencias = (audiencias?.length ?? 0) > 0;
  const tipoSugerido = yaHayAudiencias ? "continuacion" : "inicial";
  const tituloPagina = yaHayAudiencias ? "Agendar continuación o complementaria" : "Programar audiencia";

  return (
    <div>
      <div className="mb-2">
        <Link href={`/casos/${id}`} className="text-xs text-gray-400 hover:text-gray-600">
          ← {caso.numero_radicado}
        </Link>
      </div>
      <CollaborationBar
        resourceType="audiencia"
        resourceId={id}
        userId={(session!.user as any).id}
        nombre={session!.user?.name ?? "Usuario"}
        rol={(session!.user as any).sgccRol ?? "staff"}
      />
      <PageHeader
        title={tituloPagina}
        subtitle={`Caso ${caso.numero_radicado} — ${caso.materia}`}
      />

      {yaHayAudiencias && (
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Audiencias programadas</h3>
          <div className="space-y-2">
            {audiencias!.map((a: any) => (
              <div
                key={a.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded ${
                      ESTADO_COLOR[a.estado] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {a.estado}
                  </span>
                  <span className="text-gray-500 text-xs uppercase tracking-wide">
                    {TIPO_LABEL[a.tipo] ?? a.tipo}
                  </span>
                  <span className="text-gray-800">
                    {new Date(a.fecha_hora).toLocaleString("es-CO", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "America/Bogota",
                    })}
                  </span>
                  <span className="text-gray-500 text-xs">· {a.duracion_min} min</span>
                </div>
                <div className="text-xs text-gray-500">
                  {a.conciliador?.nombre ?? "Sin conciliador"} · {a.sala?.nombre ?? "Sin sala"}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <AudienciaForm
        caseId={id}
        conciliadores={conciliadores ?? []}
        salas={salas ?? []}
        defaultConciliadorId={caso.conciliador_id}
        defaultSalaId={caso.sala_id}
        defaultFechaHora={yaHayAudiencias ? null : caso.fecha_audiencia}
        defaultTipo={tipoSugerido}
      />
    </div>
  );
}
