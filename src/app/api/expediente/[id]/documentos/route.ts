import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin, uploadFile } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { randomUUID } from "crypto";

/**
 * GET /api/expediente/[id]/documentos
 * Listar documentos del caso ordenados por fecha descendente.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: caseId } = await params;
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("sgcc_documents")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * POST /api/expediente/[id]/documentos
 * Subir documento al expediente (FormData: file, tipo, nombre, descripcion).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: caseId } = await params;
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Solo staff
  if ((session.user as any).userType !== "staff") {
    return NextResponse.json(
      { error: "Solo el personal del centro puede subir documentos" },
      { status: 403 }
    );
  }

  const centerId = resolveCenterId(session);
  if (!centerId) {
    return NextResponse.json({ error: "Sin centro asignado" }, { status: 400 });
  }

  // Verificar que el caso existe y pertenece al centro
  const { data: caso } = await supabaseAdmin
    .from("sgcc_cases")
    .select("id, center_id")
    .eq("id", caseId)
    .eq("center_id", centerId)
    .single();

  if (!caso) {
    return NextResponse.json({ error: "Caso no encontrado" }, { status: 404 });
  }

  // Parse FormData
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Se esperaba FormData con el archivo" },
      { status: 400 }
    );
  }

  const file = formData.get("file") as File | null;
  const tipo = formData.get("tipo") as string | null;
  const nombre = formData.get("nombre") as string | null;
  const descripcion = formData.get("descripcion") as string | null;

  if (!file) {
    return NextResponse.json({ error: "El archivo es requerido" }, { status: 400 });
  }
  if (!tipo) {
    return NextResponse.json({ error: "El tipo de documento es requerido" }, { status: 400 });
  }
  if (!nombre) {
    return NextResponse.json({ error: "El nombre del documento es requerido" }, { status: 400 });
  }

  // Subir archivo a Supabase Storage
  const timestamp = Date.now();
  const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `centers/${centerId}/cases/${caseId}/${timestamp}-${sanitizedFilename}`;

  let url: string;
  try {
    url = await uploadFile(file, "sgcc-documents", storagePath);
  } catch (err: any) {
    return NextResponse.json(
      { error: `Error al subir archivo: ${err.message}` },
      { status: 500 }
    );
  }

  // Insertar registro en sgcc_documents
  const userId = (session.user as any).id;
  const now = new Date().toISOString();
  const docId = randomUUID();

  const { data: document, error } = await supabaseAdmin
    .from("sgcc_documents")
    .insert({
      id: docId,
      center_id: centerId,
      case_id: caseId,
      tipo,
      nombre,
      descripcion: descripcion ?? null,
      storage_path: storagePath,
      url,
      mime_type: file.type || "application/octet-stream",
      tamano_bytes: file.size,
      subido_por_staff: userId,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(document, { status: 201 });
}
