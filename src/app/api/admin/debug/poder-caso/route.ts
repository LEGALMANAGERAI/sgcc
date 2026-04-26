import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";

/**
 * GET /api/admin/debug/poder-caso?radicado=IN+0986-2025
 *
 * Diagnostica por qué el archivo del poder no aparece en un expediente.
 *  - Busca el caso por número de radicado en el centro del admin.
 *  - Lista sus case_attorneys con sus poder_url.
 *  - Lista TODOS los archivos en el bucket "poderes" bajo `${caseId}/`.
 *  - Verifica si los buckets de storage existen.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rol = (session.user as any).sgccRol as string | undefined;
  if (rol !== "admin" && rol !== "secretario") {
    return NextResponse.json({ error: "Solo admin o secretario" }, { status: 403 });
  }

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const radicado = req.nextUrl.searchParams.get("radicado")?.trim();
  if (!radicado) {
    return NextResponse.json({ error: "Falta ?radicado=..." }, { status: 400 });
  }

  // Caso (búsqueda flexible: ilike por si hay diferencias de espacios)
  const { data: casos } = await supabaseAdmin
    .from("sgcc_cases")
    .select("id, numero_radicado, created_at")
    .eq("center_id", centerId)
    .ilike("numero_radicado", `%${radicado}%`)
    .order("created_at", { ascending: false })
    .limit(5);

  if (!casos || casos.length === 0) {
    return NextResponse.json({ error: "No se encontró caso con ese radicado", radicado_buscado: radicado });
  }

  const caso = casos[0];

  // Apoderados del caso
  const { data: caseAttorneys } = await supabaseAdmin
    .from("sgcc_case_attorneys")
    .select("id, party_id, attorney_id, activo, poder_url, created_at, attorney:sgcc_attorneys(nombre, numero_doc)")
    .eq("case_id", caso.id)
    .order("created_at", { ascending: false });

  // Verificar buckets de storage que existen
  const { data: buckets, error: bucketsErr } = await supabaseAdmin.storage.listBuckets();

  // Listar archivos en bucket "poderes" bajo `${caseId}/`
  const { data: archivosEnPoderes, error: errPoderes } = await supabaseAdmin.storage
    .from("poderes")
    .list(caso.id, { limit: 100 });

  // También el bucket alternativo "sgcc-documents" por si existió migración
  const { data: archivosEnDocs, error: errDocs } = await supabaseAdmin.storage
    .from("sgcc-documents")
    .list(`centers/${centerId}/cases/${caso.id}`, { limit: 100 });

  // Test de upload para detectar permisos del service role en bucket "poderes"
  const probeFileName = `__probe_${Date.now()}.txt`;
  const probePath = `${caso.id}/${probeFileName}`;
  const probeContent = new Blob(["probe"], { type: "text/plain" });
  const { error: probeUploadErr } = await supabaseAdmin.storage
    .from("poderes")
    .upload(probePath, probeContent, { upsert: true });
  if (!probeUploadErr) {
    // Limpiar el archivo de prueba
    await supabaseAdmin.storage.from("poderes").remove([probePath]);
  }

  return NextResponse.json({
    caso: {
      id: caso.id,
      numero_radicado: caso.numero_radicado,
      created_at: caso.created_at,
    },
    case_attorneys: caseAttorneys ?? [],
    storage: {
      buckets_existentes: (buckets ?? []).map((b) => b.name),
      buckets_error: bucketsErr?.message ?? null,
      bucket_poderes: {
        archivos_en_carpeta_caso: archivosEnPoderes ?? [],
        error_listar: errPoderes?.message ?? null,
        probe_upload_error: probeUploadErr?.message ?? null,
        probe_upload_ok: !probeUploadErr,
      },
      bucket_sgcc_documents_carpeta_caso: {
        archivos: archivosEnDocs ?? [],
        error_listar: errDocs?.message ?? null,
      },
    },
    casos_similares_encontrados: casos,
  });
}
