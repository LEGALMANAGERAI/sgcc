import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { randomUUID } from "crypto";
import { resolverVariablesAuto } from "@/lib/autos/resolver-variables";
import { generarAutoSuspension } from "@/lib/autos/generar-auto-suspension";
import { generarAutoSuspensionPdf } from "@/lib/autos/pdf-auto-suspension";
import { generarAutoPrimeraAudiencia } from "@/lib/autos/generar-auto-primera-audiencia";
import type {
  AutoSuspensionOpciones,
  AutoPrimeraAudienciaOpciones,
} from "@/lib/autos/types";

type Params = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET /api/casos/[id]/autos?hearing_id=...
// Pre-llena el formulario del auto devolviendo ResolvedAutoVars.
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest, { params }: Params) {
  const { id: caseId } = await params;

  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  // Verificar que el caso pertenece al centro del usuario.
  const { data: caso } = await supabaseAdmin
    .from("sgcc_cases")
    .select("id")
    .eq("id", caseId)
    .eq("center_id", centerId)
    .single();

  if (!caso) return NextResponse.json({ error: "Caso no encontrado" }, { status: 404 });

  const hearingId = req.nextUrl.searchParams.get("hearing_id") ?? null;

  try {
    const vars = await resolverVariablesAuto(caseId, hearingId);
    return NextResponse.json(vars);
  } catch (err: any) {
    console.error("[GET /autos] resolverVariablesAuto error:", err);
    return NextResponse.json(
      { error: err.message || "Error al resolver variables del auto" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/casos/[id]/autos
// Genera el Word del auto y lo sube a storage "sgcc-documents".
//
// Body: { tipo: "suspension", hearing_id: string | null, opciones: AutoSuspensionOpciones }
// Response: { ok: true, url: string, nombre: string }
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest, { params }: Params) {
  const { id: caseId } = await params;

  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  // Verificar scope del centro.
  const { data: caso } = await supabaseAdmin
    .from("sgcc_cases")
    .select("id")
    .eq("id", caseId)
    .eq("center_id", centerId)
    .single();

  if (!caso) return NextResponse.json({ error: "Caso no encontrado" }, { status: 404 });

  try {
    const body = await req.json();
    const {
      tipo,
      hearing_id,
      formato = "word",
      opciones,
    }: {
      tipo: string;
      hearing_id: string | null;
      formato?: "word" | "pdf";
      opciones: AutoSuspensionOpciones | AutoPrimeraAudienciaOpciones;
    } = body;

    if (!tipo) {
      return NextResponse.json({ error: "El campo 'tipo' es requerido" }, { status: 400 });
    }

    if (tipo !== "suspension" && tipo !== "primera_audiencia") {
      return NextResponse.json({ error: "Tipo de auto no soportado" }, { status: 400 });
    }

    if (!opciones) {
      return NextResponse.json({ error: "El campo 'opciones' es requerido" }, { status: 400 });
    }

    // 1. Resolver variables del caso / audiencia.
    const vars = await resolverVariablesAuto(caseId, hearing_id ?? null);

    // 1b. Selección parcial de acreencias: si el operador eligió un subconjunto
    // (las relacionadas en ESTA audiencia), filtrar la tabla a esas acreencias.
    // Solo afecta la tabla de acreencias; el quórum viaja aparte en opciones.quorum.
    const seleccionadas = (opciones as AutoSuspensionOpciones).acreenciasSeleccionadasIds;
    if (Array.isArray(seleccionadas) && seleccionadas.length > 0) {
      const set = new Set(seleccionadas);
      vars.acreedores = vars.acreedores.filter((a) => set.has(a.id));
    }

    // 2. Generar el documento (Word o PDF) como Buffer.
    //    PDF solo está disponible para el auto de suspensión por ahora.
    const enPdf = formato === "pdf" && tipo === "suspension";
    let buffer: Buffer;
    if (tipo === "suspension") {
      buffer = enPdf
        ? await generarAutoSuspensionPdf(vars, opciones as AutoSuspensionOpciones)
        : await generarAutoSuspension(vars, opciones as AutoSuspensionOpciones);
    } else {
      buffer = await generarAutoPrimeraAudiencia(
        vars,
        opciones as AutoPrimeraAudienciaOpciones,
      );
    }

    // 3. Subir a storage "sgcc-documents".
    const slug = tipo === "suspension" ? "auto-suspension" : "auto-primera-audiencia";
    const ext = enPdf ? "pdf" : "docx";
    const contentType = enPdf
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const fileId = randomUUID();
    const storagePath = `autos/${centerId}/${caseId}/${slug}-${fileId}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("sgcc-documents")
      .upload(storagePath, buffer, { contentType, upsert: false });

    if (uploadError) {
      return NextResponse.json(
        { error: `Error subiendo archivo: ${uploadError.message}` },
        { status: 500 },
      );
    }

    // 4. Obtener URL pública (bucket "sgcc-documents" es público según patrones existentes).
    const { data: urlData } = supabaseAdmin.storage
      .from("sgcc-documents")
      .getPublicUrl(storagePath);

    const url = urlData.publicUrl;
    const nombreBase =
      tipo === "suspension"
        ? "Auto de suspensión y reprogramación"
        : "Auto de primera audiencia";
    const nombre = `${nombreBase}.${ext}`;

    return NextResponse.json({ ok: true, url, nombre }, { status: 201 });
  } catch (err: any) {
    console.error("[POST /autos] error:", err);
    return NextResponse.json(
      { error: err.message || "Error interno del servidor" },
      { status: 500 },
    );
  }
}
