import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin, uploadFile } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { randomUUID } from "crypto";

/**
 * GET /api/correspondencia/[id]/documentos
 * Listar documentos de la correspondencia.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id } = await params;

  // Verificar que la correspondencia pertenece al centro
  const { data: corr } = await supabaseAdmin
    .from("sgcc_correspondence")
    .select("id")
    .eq("id", id)
    .eq("center_id", centerId)
    .single();

  if (!corr) {
    return NextResponse.json({ error: "Correspondencia no encontrada" }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from("sgcc_correspondence_docs")
    .select("*")
    .eq("correspondence_id", id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}

/**
 * POST /api/correspondencia/[id]/documentos
 * Subir documento adjunto a la correspondencia.
 * Acepta FormData con: archivo (File), tipo (escrito_recibido | respuesta | anexo)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id } = await params;

  // Verificar que la correspondencia pertenece al centro
  const { data: corr } = await supabaseAdmin
    .from("sgcc_correspondence")
    .select("id, center_id")
    .eq("id", id)
    .eq("center_id", centerId)
    .single();

  if (!corr) {
    return NextResponse.json({ error: "Correspondencia no encontrada" }, { status: 404 });
  }

  const formData = await req.formData();
  const archivo = formData.get("archivo") as File | null;
  const tipo = formData.get("tipo") as string;

  // Validaciones
  if (!archivo || archivo.size === 0) {
    return NextResponse.json({ error: "El archivo es requerido" }, { status: 400 });
  }

  const tiposValidos = ["escrito_recibido", "respuesta", "anexo"];
  if (!tipo || !tiposValidos.includes(tipo)) {
    return NextResponse.json(
      { error: "Tipo de documento invalido. Debe ser: escrito_recibido, respuesta o anexo" },
      { status: 400 }
    );
  }

  try {
    const storagePath = `correspondencia/${centerId}/${id}/${archivo.name}`;
    const url = await uploadFile(archivo, "sgcc-documents", storagePath);

    const now = new Date().toISOString();
    const { data: doc, error: docError } = await supabaseAdmin
      .from("sgcc_correspondence_docs")
      .insert({
        id: randomUUID(),
        correspondence_id: id,
        tipo,
        nombre: archivo.name,
        storage_path: storagePath,
        url,
        created_at: now,
      })
      .select()
      .single();

    if (docError) {
      return NextResponse.json({ error: docError.message }, { status: 500 });
    }

    return NextResponse.json(doc, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Error subiendo archivo: ${err.message}` },
      { status: 500 }
    );
  }
}
