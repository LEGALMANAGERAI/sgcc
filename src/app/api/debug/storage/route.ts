import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/debug/storage
 * Diagnóstico del bucket "poderes" y últimos apoderados creados.
 */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // 1. Verificar buckets existentes
  const { data: buckets, error: bErr } = await supabaseAdmin.storage.listBuckets();

  // 2. Verificar últimos apoderados creados
  const { data: apoderados } = await supabaseAdmin
    .from("sgcc_case_attorneys")
    .select("id, case_id, poder_url, created_at, attorney:sgcc_attorneys(nombre)")
    .order("created_at", { ascending: false })
    .limit(5);

  // 3. Intentar listar archivos del bucket poderes
  let poderesFiles = null;
  let poderesError = null;
  try {
    const { data: files, error } = await supabaseAdmin.storage.from("poderes").list();
    if (error) poderesError = error.message;
    else poderesFiles = files;
  } catch (e: any) {
    poderesError = e.message;
  }

  return NextResponse.json({
    buckets: buckets?.map((b) => ({ name: b.name, public: b.public })),
    bucketsError: bErr?.message,
    ultimosApoderados: apoderados,
    archivosPoderes: poderesFiles,
    errorListarPoderes: poderesError,
  });
}
