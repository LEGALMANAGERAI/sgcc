export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { PageHeader } from "@/components/ui/PageHeader";
import { SicaacClient } from "./SicaacClient";

export interface SicaacActaRow {
  id: string;
  numero_acta: string;
  tipo: string;
  es_constancia: boolean;
  fecha_acta: string;
  sicaac_estado: "pendiente" | "registrada";
  sicaac_numero_registro: string | null;
  sicaac_fecha_registro: string | null;
  caso: {
    id: string;
    numero_radicado: string;
    tipo_tramite: string;
  } | null;
}

export default async function SicaacPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const centerId = (session.user as any).centerId as string;

  const { data } = await supabaseAdmin
    .from("sgcc_actas")
    .select(
      `
        id, numero_acta, tipo, es_constancia, fecha_acta,
        sicaac_estado, sicaac_numero_registro, sicaac_fecha_registro,
        caso:sgcc_cases!inner(id, numero_radicado, center_id, tipo_tramite)
      `
    )
    .eq("caso.center_id", centerId)
    .order("fecha_acta", { ascending: false });

  const actas: SicaacActaRow[] = ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    numero_acta: r.numero_acta,
    tipo: r.tipo,
    es_constancia: !!r.es_constancia,
    fecha_acta: r.fecha_acta,
    sicaac_estado: r.sicaac_estado,
    sicaac_numero_registro: r.sicaac_numero_registro,
    sicaac_fecha_registro: r.sicaac_fecha_registro,
    caso: Array.isArray(r.caso) ? r.caso[0] : r.caso,
  }));

  return (
    <>
      <PageHeader
        title="Registro SICAAC"
        subtitle="Control del registro de actas y constancias en el portal SICAAC"
      />
      <SicaacClient actasIniciales={actas} />
    </>
  );
}
