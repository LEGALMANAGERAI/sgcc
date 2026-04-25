export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { StaffDuplicadosClient } from "./StaffDuplicadosClient";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function StaffDuplicadosPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const rol = (session.user as any).sgccRol as string | undefined;
  if (rol !== "admin") redirect("/configuracion");

  const centerId = resolveCenterId(session);
  if (!centerId) redirect("/login");

  const { data: rows } = await supabaseAdmin
    .from("sgcc_staff")
    .select("id, email, nombre, rol, activo, created_at, password_hash")
    .eq("center_id", centerId)
    .order("nombre", { ascending: true });

  const todos = (rows ?? []).map((s: any) => ({
    id: s.id,
    email: s.email,
    nombre: s.nombre,
    rol: s.rol,
    activo: s.activo,
    created_at: s.created_at,
    tiene_password: !!s.password_hash,
  }));

  // Agrupar por nombre normalizado
  const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const porNombre = new Map<string, typeof todos>();
  for (const s of todos) {
    const k = norm(s.nombre);
    if (!k) continue;
    const arr = porNombre.get(k) ?? [];
    arr.push(s);
    porNombre.set(k, arr);
  }
  const grupos = Array.from(porNombre.values()).filter((g) => g.length > 1);

  // Conteo de casos y audiencias por staff_id (para mostrar en la card)
  const todosIds = todos.map((s) => s.id);
  const conteos = new Map<string, { casos: number; audiencias: number }>();
  if (todosIds.length > 0) {
    const [{ data: casos }, { data: audiencias }] = await Promise.all([
      supabaseAdmin
        .from("sgcc_cases")
        .select("conciliador_id, secretario_id")
        .eq("center_id", centerId)
        .or(`conciliador_id.in.(${todosIds.join(",")}),secretario_id.in.(${todosIds.join(",")})`),
      supabaseAdmin
        .from("sgcc_hearings")
        .select("conciliador_id, caso:sgcc_cases!inner(center_id)")
        .in("conciliador_id", todosIds)
        .eq("caso.center_id", centerId),
    ]);
    for (const id of todosIds) conteos.set(id, { casos: 0, audiencias: 0 });
    for (const c of casos ?? []) {
      if (c.conciliador_id) conteos.get(c.conciliador_id)!.casos += 1;
      if (c.secretario_id) conteos.get(c.secretario_id)!.casos += 1;
    }
    for (const h of audiencias ?? []) {
      if (h.conciliador_id) conteos.get(h.conciliador_id)!.audiencias += 1;
    }
  }

  const gruposConConteo = grupos.map((g) =>
    g.map((s) => ({ ...s, casos: conteos.get(s.id)?.casos ?? 0, audiencias: conteos.get(s.id)?.audiencias ?? 0 })),
  );

  return (
    <div>
      <Link
        href="/configuracion"
        className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-[#0D2340] mb-3"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Volver a Configuración
      </Link>
      <PageHeader
        title="Cuentas duplicadas"
        subtitle={
          gruposConConteo.length === 0
            ? "No hay cuentas duplicadas en el centro"
            : `${gruposConConteo.length} grupo(s) detectado(s) por nombre similar`
        }
      />
      <StaffDuplicadosClient grupos={gruposConConteo} />
    </div>
  );
}
