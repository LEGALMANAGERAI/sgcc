import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin, uploadFile } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { sumarDiasHabiles } from "@/lib/dias-habiles-colombia";
import { randomUUID } from "crypto";
import type { CorrespondenciaTipo } from "@/types";

/**
 * Calcula la fecha limite de respuesta segun el tipo de correspondencia.
 * - Tutela: 2 dias calendario (48 horas) — terminos constitucionales
 * - Derecho de peticion: 15 dias habiles
 * - Requerimiento: manual (se pasa como parametro)
 * - Oficio: sin fecha limite
 */
function calcularFechaLimite(
  tipo: CorrespondenciaTipo,
  fechaRadicacion: string,
  fechaLimiteManual?: string
): string | null {
  const fecha = new Date(fechaRadicacion + "T00:00:00");

  switch (tipo) {
    case "tutela": {
      // 48 horas = 2 dias calendario, NO habiles (terminos constitucionales)
      const limite = new Date(fecha);
      limite.setDate(limite.getDate() + 2);
      return limite.toISOString().split("T")[0];
    }
    case "derecho_peticion": {
      // 15 dias habiles usando motor de dias habiles de Colombia
      const limite = sumarDiasHabiles(fecha, 15);
      return limite.toISOString().split("T")[0];
    }
    case "requerimiento": {
      // Manual — depende del oficio
      return fechaLimiteManual || null;
    }
    case "oficio": {
      // Sin fecha limite
      return null;
    }
    default:
      return null;
  }
}

/**
 * GET /api/correspondencia
 * Lista correspondencia del centro con joins a responsable, caso y conteo de documentos.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const tipo = searchParams.get("tipo");
  const estado = searchParams.get("estado");

  let query = supabaseAdmin
    .from("sgcc_correspondence")
    .select(`
      *,
      responsable:sgcc_staff!sgcc_correspondence_responsable_staff_id_fkey(id, nombre),
      caso:sgcc_cases!sgcc_correspondence_case_id_fkey(id, numero_radicado),
      documentos:sgcc_correspondence_docs(id)
    `)
    .eq("center_id", centerId)
    .order("created_at", { ascending: false });

  if (tipo) query = query.eq("tipo", tipo);
  if (estado) query = query.eq("estado", estado);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Agregar conteo de documentos
  const result = (data ?? []).map((c: any) => {
    const docsCount = c.documentos?.length ?? 0;
    const { documentos, ...rest } = c;
    return { ...rest, docs_count: docsCount };
  });

  return NextResponse.json(result);
}

/**
 * POST /api/correspondencia
 * Crear nueva correspondencia. Acepta FormData (con archivo opcional).
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const formData = await req.formData();

  const tipo = formData.get("tipo") as CorrespondenciaTipo;
  const asunto = formData.get("asunto") as string;
  const remitente = formData.get("remitente") as string;
  const destinatario = formData.get("destinatario") as string;
  const fechaRadicacion = (formData.get("fecha_radicacion") as string) || new Date().toISOString().split("T")[0];
  const fechaLimiteManual = formData.get("fecha_limite_respuesta") as string | null;
  const caseId = formData.get("case_id") as string | null;
  const responsableStaffId = formData.get("responsable_staff_id") as string | null;
  const notas = formData.get("notas") as string | null;
  const archivo = formData.get("archivo") as File | null;

  // Validaciones
  const tiposValidos: CorrespondenciaTipo[] = ["tutela", "derecho_peticion", "requerimiento", "oficio"];
  if (!tipo || !tiposValidos.includes(tipo)) {
    return NextResponse.json({ error: "Tipo de correspondencia invalido" }, { status: 400 });
  }
  if (!asunto?.trim()) {
    return NextResponse.json({ error: "El asunto es requerido" }, { status: 400 });
  }
  if (!remitente?.trim()) {
    return NextResponse.json({ error: "El remitente es requerido" }, { status: 400 });
  }
  if (!destinatario?.trim()) {
    return NextResponse.json({ error: "El destinatario es requerido" }, { status: 400 });
  }

  // Validar case_id si se proporciono
  if (caseId) {
    const { data: caso } = await supabaseAdmin
      .from("sgcc_cases")
      .select("id")
      .eq("id", caseId)
      .eq("center_id", centerId)
      .single();
    if (!caso) {
      return NextResponse.json({ error: "El caso vinculado no existe en este centro" }, { status: 400 });
    }
  }

  // Validar responsable si se proporciono
  if (responsableStaffId) {
    const { data: staffMember } = await supabaseAdmin
      .from("sgcc_staff")
      .select("id")
      .eq("id", responsableStaffId)
      .eq("center_id", centerId)
      .eq("activo", true)
      .single();
    if (!staffMember) {
      return NextResponse.json({ error: "El responsable no existe en este centro" }, { status: 400 });
    }
  }

  // Calcular fecha limite
  const fechaLimiteRespuesta = calcularFechaLimite(tipo, fechaRadicacion, fechaLimiteManual ?? undefined);

  // Crear correspondencia
  const corrId = randomUUID();
  const now = new Date().toISOString();

  const { data: corr, error: corrError } = await supabaseAdmin
    .from("sgcc_correspondence")
    .insert({
      id: corrId,
      center_id: centerId,
      case_id: caseId || null,
      tipo,
      asunto: asunto.trim(),
      remitente: remitente.trim(),
      destinatario: destinatario.trim(),
      fecha_radicacion: fechaRadicacion,
      fecha_limite_respuesta: fechaLimiteRespuesta,
      estado: "recibido",
      responsable_staff_id: responsableStaffId || null,
      notas: notas?.trim() || null,
      created_at: now,
    })
    .select()
    .single();

  if (corrError) {
    return NextResponse.json({ error: corrError.message }, { status: 500 });
  }

  // Subir archivo si se adjunto
  if (archivo && archivo.size > 0) {
    try {
      const storagePath = `correspondencia/${centerId}/${corrId}/${archivo.name}`;
      const url = await uploadFile(archivo, "sgcc-documents", storagePath);

      await supabaseAdmin.from("sgcc_correspondence_docs").insert({
        id: randomUUID(),
        correspondence_id: corrId,
        tipo: "escrito_recibido",
        nombre: archivo.name,
        storage_path: storagePath,
        url,
        created_at: now,
      });
    } catch (uploadErr: any) {
      // No falla la creacion, solo registra warning
      console.error("Error subiendo archivo adjunto:", uploadErr.message);
    }
  }

  return NextResponse.json(corr, { status: 201 });
}
