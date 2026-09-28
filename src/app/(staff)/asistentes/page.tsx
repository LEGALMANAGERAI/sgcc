export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { PageHeader } from "@/components/ui/PageHeader";
import type { StaffRol } from "@/types";
import { AsistentesClient, type OpcionCaso, type OpcionPersona, type VinculoRow } from "./AsistentesClient";

const ROLES_PERMITIDOS: StaffRol[] = ["admin", "conciliador", "asistente"];

export default async function AsistentesPage() {
  const session = await auth();
  const user = session!.user as any;
  const centerId = user.centerId as string;
  const yo = user.id as string;
  const rol = user.sgccRol as StaffRol;

  if (!ROLES_PERMITIDOS.includes(rol)) {
    redirect("/dashboard");
  }

  // Vínculos visibles según el rol.
  let vinculosQuery = supabaseAdmin
    .from("sgcc_asistente_vinculos")
    .select("id, estado, case_id, asistente_id, conciliador_id, created_at, resuelto_at")
    .eq("center_id", centerId)
    .order("created_at", { ascending: false });

  if (rol === "conciliador") vinculosQuery = vinculosQuery.eq("conciliador_id", yo);
  if (rol === "asistente") vinculosQuery = vinculosQuery.eq("asistente_id", yo);

  const { data: vinculosRaw } = await vinculosQuery;
  const vinculos = vinculosRaw ?? [];

  // Resolver nombres por separado (más robusto que el embed por FK).
  const staffIds = Array.from(new Set(vinculos.flatMap((v) => [v.asistente_id, v.conciliador_id])));
  const caseIds = Array.from(new Set(vinculos.map((v) => v.case_id).filter((id): id is string => !!id)));

  const [{ data: staffRows }, { data: caseRows }] = await Promise.all([
    staffIds.length
      ? supabaseAdmin.from("sgcc_staff").select("id, nombre, email").in("id", staffIds)
      : Promise.resolve({ data: [] as { id: string; nombre: string; email: string }[] }),
    caseIds.length
      ? supabaseAdmin.from("sgcc_cases").select("id, numero_radicado").in("id", caseIds)
      : Promise.resolve({ data: [] as { id: string; numero_radicado: string }[] }),
  ]);

  const staffMap = new Map((staffRows ?? []).map((s) => [s.id, s]));
  const caseMap = new Map((caseRows ?? []).map((c) => [c.id, c]));

  const vinculosEnriquecidos: VinculoRow[] = vinculos.map((v) => ({
    id: v.id,
    estado: v.estado,
    case_id: v.case_id,
    created_at: v.created_at,
    resuelto_at: v.resuelto_at,
    asistente_id: v.asistente_id,
    asistente_nombre: staffMap.get(v.asistente_id)?.nombre ?? "—",
    asistente_email: staffMap.get(v.asistente_id)?.email ?? "",
    conciliador_id: v.conciliador_id,
    conciliador_nombre: staffMap.get(v.conciliador_id)?.nombre ?? "—",
    caso_radicado: v.case_id ? caseMap.get(v.case_id)?.numero_radicado ?? null : null,
  }));

  // Opciones para el formulario, solo lo que cada rol necesita.
  let asistentes: OpcionPersona[] | undefined;
  let conciliadores: OpcionPersona[] | undefined;
  let misCasos: OpcionCaso[] | undefined;

  if (rol === "admin" || rol === "conciliador") {
    const { data } = await supabaseAdmin
      .from("sgcc_staff")
      .select("id, nombre")
      .eq("center_id", centerId)
      .eq("rol", "asistente")
      .eq("activo", true)
      .order("nombre");
    asistentes = data ?? [];
  }

  if (rol === "admin" || rol === "asistente") {
    const { data } = await supabaseAdmin
      .from("sgcc_staff")
      .select("id, nombre")
      .eq("center_id", centerId)
      .eq("rol", "conciliador")
      .eq("activo", true)
      .order("nombre");
    conciliadores = data ?? [];
  }

  if (rol === "conciliador") {
    const { data } = await supabaseAdmin
      .from("sgcc_cases")
      .select("id, numero_radicado")
      .eq("center_id", centerId)
      .eq("conciliador_id", yo)
      .not("estado", "in", '("cerrado","rechazado")')
      .order("numero_radicado");
    misCasos = data ?? [];
  }

  return (
    <div>
      <PageHeader
        title="Asistentes"
        subtitle="Vínculos entre asistentes y conciliadores para la redacción y revisión de actas"
      />
      <AsistentesClient
        rol={rol}
        staffId={yo}
        vinculos={vinculosEnriquecidos}
        asistentes={asistentes}
        conciliadores={conciliadores}
        misCasos={misCasos}
      />
    </div>
  );
}
