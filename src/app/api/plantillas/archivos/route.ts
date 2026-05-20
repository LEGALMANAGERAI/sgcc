// src/app/api/plantillas/archivos/route.ts
// GET: lista los archivos de plantilla del centro.
// POST: sube un archivo (cualquier staff del centro).

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin, uploadFile } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { randomUUID } from "crypto";

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB
const BUCKET = "sgcc-documents";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("sgcc_template_files")
    .select(
      `
        id, nombre, descripcion, url, storage_path, mime_type, tamano_bytes,
        created_at, subido_por_staff,
        uploader:sgcc_staff!sgcc_template_files_subido_por_staff_fkey(id, nombre)
      `
    )
    .eq("center_id", centerId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ archivos: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if ((session.user as any).userType !== "staff") {
    return NextResponse.json(
      { error: "Solo el personal del centro puede subir archivos de plantilla" },
      { status: 403 }
    );
  }

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });
  const staffId = (session.user as any).id as string | undefined;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Se esperaba FormData" }, { status: 400 });
  }

  const file = form.get("file");
  const nombre = (form.get("nombre") as string | null)?.trim();
  const descripcion = (form.get("descripcion") as string | null)?.trim() || null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "El archivo excede 20 MB" }, { status: 413 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const storagePath = `plantillas/${centerId}/${randomUUID()}.${ext}`;
  let url: string;
  try {
    url = await uploadFile(file, BUCKET, storagePath, file.type || "application/octet-stream");
  } catch (e: any) {
    return NextResponse.json(
      { error: `Error subiendo: ${e?.message ?? "desconocido"}` },
      { status: 500 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("sgcc_template_files")
    .insert({
      center_id: centerId,
      nombre: nombre || file.name,
      descripcion,
      storage_path: storagePath,
      url,
      mime_type: file.type || "application/octet-stream",
      tamano_bytes: file.size,
      subido_por_staff: staffId ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
