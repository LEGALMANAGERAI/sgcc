import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin, uploadFile } from "@/lib/supabase";
import { guardCasoStaff } from "@/lib/server-utils";
import { esRevisorActa, registrarRevision } from "@/lib/acta-revision";
import { randomUUID } from "crypto";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
// ponytail: 4 MB por el límite de body de Vercel (~4.5 MB); subida directa a Storage si hace falta más.
const MAX_BYTES = 4 * 1024 * 1024;

/**
 * POST multipart { acta_id, file } → nueva versión del borrador (.docx, porque
 * el envío a firma trabaja sobre DOCX).
 *  - borrador / devuelta: quien no es revisor (asistente, secretaría).
 *  - en_revision: el revisor (conciliador del caso / admin) sube su corrección.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: caseId } = await params;
  const session = await auth();
  const g = await guardCasoStaff(session, caseId);
  if ("error" in g) return g.error;
  const { centerId } = g;
  const staffId = (session!.user as any).id as string;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Se esperaba FormData con el archivo" }, { status: 400 });
  }
  const actaId = form.get("acta_id") as string | null;
  const file = form.get("file") as File | null;
  if (!actaId || !file) return NextResponse.json({ error: "acta_id y file son requeridos" }, { status: 400 });
  if (!file.name.toLowerCase().endsWith(".docx")) {
    return NextResponse.json({ error: "Sube el acta en formato Word (.docx)" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "El archivo supera 4 MB" }, { status: 400 });
  // Un .docx es un ZIP: debe empezar por "PK\x03\x04" (no basta la extensión).
  const firma = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (!(firma[0] === 0x50 && firma[1] === 0x4b && firma[2] === 0x03 && firma[3] === 0x04)) {
    return NextResponse.json({ error: "El archivo no es un Word (.docx) válido" }, { status: 400 });
  }

  const [{ data: acta }, { data: caso }] = await Promise.all([
    supabaseAdmin
      .from("sgcc_actas")
      .select("id, numero_acta, estado_revision")
      .eq("id", actaId)
      .eq("case_id", caseId)
      .maybeSingle(),
    supabaseAdmin.from("sgcc_cases").select("conciliador_id").eq("id", caseId).single(),
  ]);
  if (!acta) return NextResponse.json({ error: "Acta no encontrada" }, { status: 404 });

  const esRevisor = esRevisorActa(session, caso?.conciliador_id ?? null);
  const permitidos = esRevisor ? ["en_revision"] : ["borrador", "devuelta"];
  if (!permitidos.includes(acta.estado_revision)) {
    return NextResponse.json(
      { error: esRevisor ? "Solo puedes corregir el acta mientras está en revisión" : "El acta no se puede editar en este estado" },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  const storagePath = `sgcc-docs/${centerId}/${caseId}/acta-${actaId}-v${Date.now()}.docx`;
  let url: string;
  try {
    url = await uploadFile(file, "sgcc-documents", storagePath, DOCX);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  const { data: actualizada, error } = await supabaseAdmin
    .from("sgcc_actas")
    .update({ borrador_url: url, updated_at: now })
    .eq("id", actaId)
    .eq("estado_revision", acta.estado_revision)
    .select()
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!actualizada) return NextResponse.json({ error: "El acta cambió; recarga la página" }, { status: 409 });

  await supabaseAdmin.from("sgcc_documents").insert({
    id: randomUUID(),
    center_id: centerId,
    case_id: caseId,
    acta_id: actaId,
    tipo: "acta_borrador",
    nombre: `Acta ${acta.numero_acta} — nueva versión.docx`,
    storage_path: storagePath,
    url,
    mime_type: DOCX,
    tamano_bytes: file.size,
    subido_por_staff: staffId,
    created_at: now,
  });
  await registrarRevision({ actaId, caseId, staffId, accion: "nueva_version", documentoUrl: url });

  return NextResponse.json(actualizada);
}
