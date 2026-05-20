// src/app/api/sicaac/manual/[id]/route.ts
// PATCH: edita un registro manual. DELETE: lo elimina.

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
    return NextResponse.json({ error: "Solo el personal del centro" }, { status: 403 });
  }
  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const estado = body?.estado;
  const numero = (body?.numero_registro as string | undefined)?.trim() || null;
  const fecha = (body?.fecha_registro as string | undefined)?.trim() || null;

  if (estado !== "pendiente" && estado !== "registrado") {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  }
  if (estado === "registrado" && (!numero || !fecha)) {
    return NextResponse.json(
      { error: "Para marcar como registrado se requieren número y fecha" },
      { status: 400 }
    );
  }

  const payload =
    estado === "registrado"
      ? {
          estado,
          sicaac_numero_registro: numero,
          sicaac_fecha_registro: fecha,
          updated_at: new Date().toISOString(),
        }
      : {
          estado,
          sicaac_numero_registro: null,
          sicaac_fecha_registro: null,
          updated_at: new Date().toISOString(),
        };

  const { error } = await supabaseAdmin
    .from("sgcc_sicaac_manual")
    .update(payload)
    .eq("id", id)
    .eq("center_id", centerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if ((session.user as any).userType !== "staff") {
    return NextResponse.json({ error: "Solo el personal del centro" }, { status: 403 });
  }
  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id } = await params;

  const { error } = await supabaseAdmin
    .from("sgcc_sicaac_manual")
    .delete()
    .eq("id", id)
    .eq("center_id", centerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
