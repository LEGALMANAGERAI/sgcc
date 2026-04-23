import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { generateRelacionAcreenciasDocx } from "@/lib/doc-generator";
import { generarRelacionAcreenciasPdf } from "@/lib/acreencias/pdf-relacion";
import type { SgccAcreencia } from "@/types";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/expediente/[id]/acreencias/export?format=docx|pdf
 * Descarga la relación definitiva de acreencias como tabla (Word o PDF)
 * con márgenes y estilo del acta.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id: caseId } = await params;
  const format = (req.nextUrl.searchParams.get("format") ?? "docx").toLowerCase();

  if (format !== "docx" && format !== "pdf") {
    return NextResponse.json({ error: "Formato inválido (docx|pdf)" }, { status: 400 });
  }

  // Caso + convocante (deudor) para encabezado
  const { data: caso, error: casoError } = await supabaseAdmin
    .from("sgcc_cases")
    .select(
      `
      id, numero_radicado, materia,
      partes:sgcc_case_parties(
        rol,
        party:sgcc_parties(id, tipo_persona, nombres, apellidos, razon_social,
          numero_doc, nit_empresa, email, tipo_doc)
      )
    `
    )
    .eq("id", caseId)
    .eq("center_id", centerId)
    .single();

  if (casoError || !caso) {
    return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
  }

  const { data: centro } = await supabaseAdmin
    .from("sgcc_centers")
    .select("nombre, ciudad, direccion, resolucion_habilitacion")
    .eq("id", centerId)
    .single();

  if (!centro) {
    return NextResponse.json({ error: "Centro no encontrado" }, { status: 404 });
  }

  const { data: acreencias, error: acrError } = await supabaseAdmin
    .from("sgcc_acreencias")
    .select("*")
    .eq("case_id", caseId)
    .eq("center_id", centerId)
    .order("clase_credito", { ascending: true })
    .order("acreedor_nombre", { ascending: true });

  if (acrError) return NextResponse.json({ error: acrError.message }, { status: 500 });

  const partesAny = (caso.partes ?? []) as Array<{ rol: string; party: any }>;
  const convocante = partesAny.find((p) => p.rol === "convocante")?.party ?? null;

  const ctx = {
    caso: { numero_radicado: caso.numero_radicado, materia: caso.materia },
    centro,
    convocante,
    acreencias: (acreencias ?? []) as SgccAcreencia[],
  };

  const filenameBase = `relacion-acreencias-${caso.numero_radicado}`;

  if (format === "docx") {
    const buffer = await generateRelacionAcreenciasDocx(ctx);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filenameBase}.docx"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const pdf = await generarRelacionAcreenciasPdf(ctx);
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filenameBase}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
