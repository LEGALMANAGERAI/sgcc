export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { BotonWebClient } from "./BotonWebClient";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function BotonWebPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const rol = (session.user as any).sgccRol as string | undefined;
  if (rol !== "admin") redirect("/configuracion");

  const centerId = resolveCenterId(session);
  if (!centerId) redirect("/login");

  const { data: centro } = await supabaseAdmin
    .from("sgcc_centers")
    .select("id, codigo_corto, nombre, color_primario, color_secundario")
    .eq("id", centerId)
    .single();

  if (!centro) redirect("/configuracion");

  // Origin: lee de env, fallback al dominio actual de prod
  const origin = process.env.NEXT_PUBLIC_APP_URL || "https://sgcc-rouge.vercel.app";

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
        title="Botón para tu sitio web"
        subtitle="Pega un fragmento de código en la web del centro y tus usuarios podrán radicar trámites con un clic."
      />
      <BotonWebClient
        codigo={centro.codigo_corto}
        nombreCentro={centro.nombre}
        colorPrimario={centro.color_primario || "#0D2340"}
        colorSecundario={centro.color_secundario || "#1B4F9B"}
        origin={origin}
      />
    </div>
  );
}
