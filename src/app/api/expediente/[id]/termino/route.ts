import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { randomUUID } from "crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: caseId } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { data: caso } = await supabaseAdmin
    .from("sgcc_cases")
    .select("id, fecha_inicio_termino, dias_termino, prorrogado")
    .eq("id", caseId)
    .eq("center_id", centerId)
    .single();

  if (!caso) return NextResponse.json({ error: "Caso no encontrado" }, { status: 404 });

  const body = await req.json();

  if (body.accion === "iniciar") {
    if (caso.fecha_inicio_termino) {
      return NextResponse.json({ error: "El término ya fue iniciado" }, { status: 400 });
    }

    const hoy = new Date().toISOString().split("T")[0];

    const { error: updateError } = await supabaseAdmin
      .from("sgcc_cases")
      .update({
        fecha_inicio_termino: hoy,
        updated_at: new Date().toISOString(),
      })
      .eq("id", caseId);

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    // Timeline
    await supabaseAdmin.from("sgcc_case_timeline").insert({
      id: randomUUID(),
      case_id: caseId,
      center_id: centerId,
      tipo: "termino_iniciado",
      titulo: "Término del procedimiento iniciado",
      descripcion: `Se inició el conteo de 60 días hábiles para el procedimiento. Fecha de inicio: ${hoy}.`,
      staff_id: (session.user as any).id,
      es_automatico: false,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, fecha_inicio: hoy });
  }

  if (body.accion === "prorrogar") {
    if (!caso.fecha_inicio_termino) {
      return NextResponse.json({ error: "El término no ha sido iniciado" }, { status: 400 });
    }
    if (caso.prorrogado) {
      return NextResponse.json({ error: "El término ya fue prorrogado" }, { status: 400 });
    }

    // Prorrogar: sumar 30 días al término actual (60 → 90)
    const nuevoTermino = (caso.dias_termino ?? 60) + 30;

    const { error: updateError } = await supabaseAdmin
      .from("sgcc_cases")
      .update({
        dias_termino: nuevoTermino,
        prorrogado: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", caseId);

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    await supabaseAdmin.from("sgcc_case_timeline").insert({
      id: randomUUID(),
      case_id: caseId,
      center_id: centerId,
      tipo: "termino_prorrogado",
      titulo: "Término prorrogado por 30 días hábiles",
      descripcion: `El operador prorrogó el término del procedimiento por 30 días hábiles adicionales. Nuevo término total: ${nuevoTermino} días hábiles.`,
      staff_id: (session.user as any).id,
      es_automatico: false,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, dias_termino: nuevoTermino });
  }

  return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
}
