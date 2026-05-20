export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { PageHeader } from "@/components/ui/PageHeader";
import { SicaacClient, type SicaacRegistro } from "./SicaacClient";

export default async function SicaacPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const centerId = (session.user as any).centerId as string;

  const [casosRes, manualRes] = await Promise.all([
    supabaseAdmin
      .from("sgcc_cases")
      .select(
        "id, numero_radicado, tipo_tramite, fecha_solicitud, sicaac_estado, sicaac_numero_registro, sicaac_fecha_registro"
      )
      .eq("center_id", centerId)
      .is("archivado_at", null)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("sgcc_sicaac_manual")
      .select("*")
      .eq("center_id", centerId)
      .order("created_at", { ascending: false }),
  ]);

  const expedientes: SicaacRegistro[] = ((casosRes.data ?? []) as any[]).map((c) => ({
    id: c.id,
    origen: "expediente",
    tipo: "expediente",
    referencia: c.numero_radicado,
    tramite: c.tipo_tramite,
    fecha: c.fecha_solicitud,
    estado: c.sicaac_estado ?? "pendiente",
    numero_registro: c.sicaac_numero_registro,
    fecha_registro: c.sicaac_fecha_registro,
    observaciones: null,
  }));

  const manuales: SicaacRegistro[] = ((manualRes.data ?? []) as any[]).map((m) => ({
    id: m.id,
    origen: "manual",
    tipo: m.tipo,
    referencia: m.referencia,
    tramite: null,
    fecha: m.fecha,
    estado: m.estado,
    numero_registro: m.sicaac_numero_registro,
    fecha_registro: m.sicaac_fecha_registro,
    observaciones: m.observaciones ?? null,
  }));

  return (
    <>
      <PageHeader
        title="Registro SICAAC"
        subtitle="Control del registro de expedientes, actas y constancias en el portal SICAAC"
      />
      <SicaacClient registrosIniciales={[...expedientes, ...manuales]} />
    </>
  );
}
