export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { PageHeader } from "@/components/ui/PageHeader";
import { NuevoCasoForm } from "@/components/modules/casos/NuevoCasoForm";
import Link from "next/link";

export default async function NuevoCasoPage() {
  const session = await auth();
  const centerId = (session!.user as any).centerId;

  const { data: conciliadores } = await supabaseAdmin
    .from("sgcc_staff")
    .select("id, nombre")
    .eq("center_id", centerId)
    .eq("rol", "conciliador")
    .eq("activo", true)
    .order("nombre");

  const { data: salas } = await supabaseAdmin
    .from("sgcc_rooms")
    .select("id, nombre, tipo")
    .eq("center_id", centerId)
    .eq("activa", true)
    .order("nombre");

  return (
    <div>
      <div className="mb-2">
        <Link href="/casos" className="text-xs text-gray-400 hover:text-gray-600">
          ← Casos
        </Link>
      </div>
      <PageHeader
        title="Nueva solicitud de conciliación"
        subtitle="Radicar un nuevo asunto en el centro"
      />
      <NuevoCasoForm
        centerId={centerId}
        conciliadores={conciliadores ?? []}
        salas={salas ?? []}
      />
    </div>
  );
}
