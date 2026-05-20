export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlantillasTabs } from "@/components/modules/plantillas/PlantillasTabs";
import { ArchivosCentroClient, type ArchivoCentro } from "./ArchivosCentroClient";

export default async function PlantillasArchivosPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const centerId = resolveCenterId(session);
  if (!centerId) redirect("/login");

  const isAdmin = (session.user as any).sgccRol === "admin";

  const { data } = await supabaseAdmin
    .from("sgcc_template_files")
    .select(
      `
        id, nombre, descripcion, url, mime_type, tamano_bytes, created_at,
        uploader:sgcc_staff!sgcc_template_files_subido_por_staff_fkey(id, nombre)
      `
    )
    .eq("center_id", centerId)
    .order("created_at", { ascending: false });

  const archivos: ArchivoCentro[] = ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    nombre: r.nombre,
    descripcion: r.descripcion,
    url: r.url,
    mime_type: r.mime_type,
    tamano_bytes: r.tamano_bytes,
    created_at: r.created_at,
    uploader: Array.isArray(r.uploader) ? r.uploader[0] : r.uploader,
  }));

  return (
    <div>
      <PageHeader
        title="Plantillas de Documentos"
        subtitle="Formatos propios del centro — el staff los sube y todos los descargan"
      />
      <PlantillasTabs />
      <ArchivosCentroClient archivosIniciales={archivos} isAdmin={isAdmin} />
    </div>
  );
}
