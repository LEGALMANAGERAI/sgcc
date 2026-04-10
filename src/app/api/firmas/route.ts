import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin, uploadFile } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { generarTokenFirma } from "@/lib/firma/tokens";
import { calcularHashSHA256 } from "@/lib/firma/pdf";
import { randomUUID } from "crypto";

/**
 * GET /api/firmas
 * Listar documentos de firma del centro. Auth required (staff).
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const estado = searchParams.get("estado");

  let query = supabaseAdmin
    .from("sgcc_firma_documentos")
    .select(`
      *,
      firmantes:sgcc_firmantes(id, nombre, estado)
    `)
    .eq("center_id", centerId)
    .order("created_at", { ascending: false });

  if (estado) query = query.eq("estado", estado);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}

/**
 * POST /api/firmas
 * Crear documento de firma. Auth required.
 * Recibe FormData: file, nombre, descripcion, orden_secuencial, dias_expiracion, case_id, firmantes (JSON)
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const userId = (session.user as any)?.id;

  try {
    const formData = await req.formData();
    const file = (formData.get("archivo") ?? formData.get("file")) as File | null;
    const nombre = formData.get("nombre") as string | null;
    const descripcion = formData.get("descripcion") as string | null;
    const ordenSecuencial = formData.get("orden_secuencial") === "true";
    const diasExpiracion = parseInt(formData.get("dias_expiracion") as string) || 30;
    const caseId = formData.get("case_id") as string | null;
    const firmantesJson = formData.get("firmantes") as string | null;

    // Validaciones
    if (!file || !nombre) {
      return NextResponse.json({ error: "Archivo PDF y nombre son requeridos" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Solo se permiten archivos PDF" }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "El archivo no puede superar 10MB" }, { status: 400 });
    }

    let firmantes: Array<{ nombre: string; cedula: string; email: string; telefono?: string; orden: number }> = [];
    if (firmantesJson) {
      try {
        firmantes = JSON.parse(firmantesJson);
      } catch {
        return NextResponse.json({ error: "Formato de firmantes inválido" }, { status: 400 });
      }
    }

    if (!firmantes.length) {
      return NextResponse.json({ error: "Debe incluir al menos un firmante" }, { status: 400 });
    }

    // Calcular hash SHA-256 del PDF
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const archivoHash = calcularHashSHA256(fileBuffer);

    // Crear documento en DB
    const docId = randomUUID();
    const storagePath = `firmas/${centerId}/${docId}.pdf`;
    const fechaExpiracion = new Date(Date.now() + diasExpiracion * 24 * 60 * 60 * 1000).toISOString();

    // Subir PDF a Supabase Storage
    const archivoUrl = await uploadFile(file, "sgcc-documents", storagePath);

    // Insertar documento
    const { data: documento, error: docError } = await supabaseAdmin
      .from("sgcc_firma_documentos")
      .insert({
        id: docId,
        center_id: centerId,
        case_id: caseId || null,
        nombre,
        descripcion: descripcion || null,
        archivo_url: archivoUrl,
        archivo_hash: archivoHash,
        archivo_firmado_url: null,
        estado: "pendiente",
        orden_secuencial: ordenSecuencial,
        dias_expiracion: diasExpiracion,
        fecha_expiracion: fechaExpiracion,
        total_firmantes: firmantes.length,
        firmantes_completados: 0,
        creado_por: userId,
      })
      .select()
      .single();

    if (docError) {
      return NextResponse.json({ error: docError.message }, { status: 500 });
    }

    // Crear firmantes con tokens únicos
    const firmantesData = firmantes.map((f) => ({
      id: randomUUID(),
      firma_documento_id: docId,
      nombre: f.nombre,
      cedula: f.cedula,
      email: f.email,
      telefono: f.telefono || null,
      orden: f.orden,
      token: generarTokenFirma(),
      estado: "pendiente" as const,
      canal_notificacion: "email",
    }));

    const { data: firmantesCreados, error: firmError } = await supabaseAdmin
      .from("sgcc_firmantes")
      .insert(firmantesData)
      .select();

    if (firmError) {
      return NextResponse.json({ error: firmError.message }, { status: 500 });
    }

    // Registrar en audit trail
    await supabaseAdmin.from("sgcc_firma_registros").insert({
      firma_documento_id: docId,
      firmante_id: null,
      accion: "documento_creado",
      ip: req.headers.get("x-forwarded-for") || "unknown",
      user_agent: req.headers.get("user-agent") || "unknown",
      metadatos: { creado_por: userId, total_firmantes: firmantes.length },
    });

    return NextResponse.json({ ...documento, firmantes: firmantesCreados }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error interno" }, { status: 500 });
  }
}
