export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { PageHeader } from "@/components/ui/PageHeader";
import { NuevoCasoForm } from "@/components/modules/casos/NuevoCasoForm";
import Link from "next/link";
export const dynamic = "force-dynamic";

export default async function NuevoCasoPage() {
export const dynamic = "force-dynamic";
  const session = await auth();
  const centerId = (session!.user as any).centerId;
export const dynamic = "force-dynamic";

  const { data: conciliadores } = await supabaseAdmin
export const dynamic = "force-dynamic";
    .from("sgcc_staff")
    .select("id, nombre")
export const dynamic = "force-dynamic";
    .eq("center_id", centerId)
    .eq("rol", "conciliador")
export const dynamic = "force-dynamic";
    .eq("activo", true)
    .order("nombre");
export const dynamic = "force-dynamic";

  const { data: salas } = await supabaseAdmin
export const dynamic = "force-dynamic";
    .from("sgcc_rooms")
    .select("id, nombre, tipo")
export const dynamic = "force-dynamic";
    .eq("center_id", centerId)
    .eq("activa", true)
export const dynamic = "force-dynamic";
    .order("nombre");

export const dynamic = "force-dynamic";
  return (
    <div>
export const dynamic = "force-dynamic";
      <div className="mb-2">
        <Link href="/casos" className="text-xs text-gray-400 hover:text-gray-600">
export const dynamic = "force-dynamic";
          ← Casos
        </Link>
export const dynamic = "force-dynamic";
      </div>
      <PageHeader
export const dynamic = "force-dynamic";
        title="Nueva solicitud de conciliación"
        subtitle="Radicar un nuevo asunto en el centro"
export const dynamic = "force-dynamic";
      />
      <NuevoCasoForm
export const dynamic = "force-dynamic";
        centerId={centerId}
        conciliadores={conciliadores ?? []}
export const dynamic = "force-dynamic";
        salas={salas ?? []}
      />
export const dynamic = "force-dynamic";
    </div>
  );
export const dynamic = "force-dynamic";
}
