// src/app/api/sicaac/[actaId]/route.ts
// PATCH: actualiza el estado SICAAC de un acta/constancia.
// Body: { estado: 'pendiente'|'registrada', numero_registro?: string, fecha_registro?: string }

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ actaId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { actaId } = await params;
  const body = await req.json().catch(() => ({}));
  const estado = body?.estado as string | undefined;
  const numero = (body?.numero_registro as string | undefined)?.trim() || null;
  const fecha = (body?.fecha_registro as string | undefined)?.trim() || null;

  if (estado !== "pendiente" && estado !== "registrada") {
    return NextResponse.json({ error: "estado inválido" }, { status: 400 });
  }
  if (estado === "registrada" && (!numero || !fecha)) {
    return NextResponse.json(
      { error: "Al marcar como registrada se requieren número y fecha" },
      { status: 400 }
    );
  }

  // Verificar que el acta pertenece a un caso del centro
  const { data: acta } = await supabaseAdmin
    .from("sgcc_actas")
    .select("id, caso:sgcc_cases!inner(center_id)")
    .eq("id", actaId)
    .maybeSingle();
  if (!acta || (acta.caso as any)?.center_id !== centerId) {
    return NextResponse.json({ error: "Acta no encontrada" }, { status: 404 });
  }

  const payload =
    estado === "registrada"
      ? {
          sicaac_estado: estado,
          sicaac_numero_registro: numero,
          sicaac_fecha_registro: fecha,
          updated_at: new Date().toISOString(),
        }
      : {
          sicaac_estado: estado,
          sicaac_numero_registro: null,
          sicaac_fecha_registro: null,
          updated_at: new Date().toISOString(),
        };

  const { error } = await supabaseAdmin
    .from("sgcc_actas")
    .update(payload)
    .eq("id", actaId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
