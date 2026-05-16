// src/app/api/casos/[id]/expediente-digital/route.ts
// PATCH: setea o limpia el link al expediente digital (Drive u otra
// plataforma). Solo staff del centro puede editar. Las partes lo ven
// solo lectura desde mis-casos.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if ((session.user as any).userType !== "staff") {
    return NextResponse.json(
      { error: "Solo el personal del centro puede editar el link del expediente digital" },
      { status: 403 }
    );
  }

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id: caseId } = await params;
  const body = await req.json().catch(() => ({}));
  const raw = body?.url;

  // Aceptamos string vacío o null para limpiar el link.
  let url: string | null = null;
  if (raw != null && String(raw).trim() !== "") {
    const trimmed = String(raw).trim();
    if (!/^https?:\/\//i.test(trimmed)) {
      return NextResponse.json(
        { error: "El link debe empezar con http:// o https://" },
        { status: 400 }
      );
    }
    url = trimmed;
  }

  const { error } = await supabaseAdmin
    .from("sgcc_cases")
    .update({
      expediente_digital_url: url,
      updated_at: new Date().toISOString(),
    })
    .eq("id", caseId)
    .eq("center_id", centerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, expediente_digital_url: url });
}
