import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin, uploadFile } from "@/lib/supabase";
import { randomUUID } from "crypto";
import { notify } from "@/lib/notifications";

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * POST /api/partes/documentos
 * Permite a una parte subir documentos (poder, pruebas) a un caso.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const userType = (session.user as any)?.userType;
  if (userType !== "party") {
    return NextResponse.json({ error: "Solo partes pueden usar este endpoint" }, { status: 403 });
  }

  const userId = (session.user as any).id as string;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const caseId = formData.get("case_id") as string | null;
  const tipo = formData.get("tipo") as string | null;
  const nombre = formData.get("nombre") as string | null;

  if (!file || !caseId || !tipo) {
    return NextResponse.json(
      { error: "Archivo, case_id y tipo son requeridos" },
      { status: 400 }
    );
  }

  // Validar tipo de archivo
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Tipo de archivo no permitido. Use PDF, JPG, PNG o WebP" },
      { status: 400 }
    );
  }

  // Validar tamaño
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "El archivo excede el tamaño máximo de 10MB" },
      { status: 400 }
    );
  }

  // Validar tipos permitidos para partes
  const tiposPermitidos = ["poder", "prueba", "otro"];
  if (!tiposPermitidos.includes(tipo)) {
    return NextResponse.json(
      { error: `Tipo no permitido. Use: ${tiposPermitidos.join(", ")}` },
      { status: 400 }
    );
  }

  // Verificar que el usuario es parte del caso
  const { data: caseParty } = await supabaseAdmin
    .from("sgcc_case_parties")
    .select("id, caso:sgcc_cases!inner(id, center_id, numero_radicado)")
    .eq("case_id", caseId)
    .eq("party_id", userId)
    .single();

  if (!caseParty) {
    return NextResponse.json({ error: "No tiene acceso a este caso" }, { status: 403 });
  }

  const caso = (caseParty as any).caso;
  const centerId = caso.center_id;

  try {
    // Subir archivo a Supabase Storage
    const ext = file.name.split(".").pop() ?? "pdf";
    const storagePath = `sgcc/${centerId}/casos/${caseId}/partes/${userId}/${randomUUID()}.${ext}`;
    const url = await uploadFile(file, "sgcc-documents", storagePath, file.type);

    // Registrar en sgcc_documents
    const docId = randomUUID();
    const now = new Date().toISOString();
    const { data: doc, error } = await supabaseAdmin
      .from("sgcc_documents")
      .insert({
        id: docId,
        case_id: caseId,
        center_id: centerId,
        tipo,
        nombre: nombre?.trim() || file.name,
        storage_path: storagePath,
        url,
        subido_por_party: userId,
        created_at: now,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Notificar al staff del centro que una parte subió un documento
    const { data: admins } = await supabaseAdmin
      .from("sgcc_staff")
      .select("id, email")
      .eq("center_id", centerId)
      .in("rol", ["admin", "conciliador"]);

    if (admins && admins.length > 0) {
      await notify({
        centerId,
        caseId,
        tipo: "documento_subido",
        titulo: `Documento subido por parte — Caso ${caso.numero_radicado}`,
        mensaje: `Una parte ha subido un documento de tipo "${tipo}" al caso ${caso.numero_radicado}.`,
        recipients: admins.map((s: any) => ({ staffId: s.id, email: s.email })),
        canal: "both",
      });
    }

    return NextResponse.json(doc, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Error al subir documento: ${err.message}` },
      { status: 500 }
    );
  }
}
