// src/app/api/apoderados-poder/[caseAttorneyId]/view/route.ts
// GET: genera signed URL fresca al hacer clic y redirige (302) al PDF.
//
// Evita el problema de TTL: las signed URLs generadas en SSR podían
// vencerse mientras la pestaña quedaba abierta. Aquí cada clic genera
// una URL nueva con TTL corto (60s) — solo lo necesario para que el
// browser termine el GET del PDF.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { createSignedDownloadUrl } from "@/lib/poderes-storage";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ caseAttorneyId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro asignado" }, { status: 400 });

  const { caseAttorneyId } = await params;

  const { data: ca } = await supabaseAdmin
    .from("sgcc_case_attorneys")
    .select(`id, poder_url, caso:sgcc_cases!inner(center_id)`)
    .eq("id", caseAttorneyId)
    .maybeSingle();

  if (!ca || (ca.caso as any)?.center_id !== centerId) {
    return NextResponse.json({ error: "Apoderado no encontrado" }, { status: 404 });
  }
  if (!ca.poder_url) {
    return NextResponse.json(
      { error: "Este apoderado no tiene poder cargado" },
      { status: 404 }
    );
  }

  const signedUrl = await createSignedDownloadUrl(ca.poder_url, 60);
  if (!signedUrl) {
    return NextResponse.json(
      {
        error:
          "El archivo del poder no se encontró en el almacenamiento. Súbelo de nuevo.",
      },
      { status: 404 }
    );
  }

  return NextResponse.redirect(signedUrl, 302);
}
