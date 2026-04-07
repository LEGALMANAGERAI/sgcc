import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    const userType = (session.user as any)?.userType;
    if (userType !== "party") {
      return NextResponse.json(
        { error: "Acceso denegado. Solo las partes pueden confirmar asistencia." },
        { status: 403 }
      );
    }

    const userId = (session.user as any).id as string;
    const body = await req.json();
    const { hearing_id, case_id } = body;

    if (!hearing_id || !case_id) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: hearing_id, case_id" },
        { status: 400 }
      );
    }

    // Verificar que el usuario es parte del caso
    const { data: caseParty, error: cpError } = await supabaseAdmin
      .from("sgcc_case_parties")
      .select("id")
      .eq("case_id", case_id)
      .eq("party_id", userId)
      .single();

    if (cpError || !caseParty) {
      return NextResponse.json(
        { error: "No tiene acceso a este caso" },
        { status: 403 }
      );
    }

    // Verificar que la audiencia existe y pertenece al caso
    const { data: hearing, error: hError } = await supabaseAdmin
      .from("sgcc_hearings")
      .select("id, estado")
      .eq("id", hearing_id)
      .eq("case_id", case_id)
      .single();

    if (hError || !hearing) {
      return NextResponse.json(
        { error: "Audiencia no encontrada para este caso" },
        { status: 404 }
      );
    }

    if (hearing.estado !== "programada") {
      return NextResponse.json(
        { error: "Solo se puede confirmar asistencia a audiencias programadas" },
        { status: 400 }
      );
    }

    // Upsert en hearing_attendance
    const { error: attendanceError } = await supabaseAdmin
      .from("sgcc_hearing_attendance")
      .upsert(
        {
          hearing_id,
          party_id: userId,
          asistio: false, // Solo confirmado, no asistió aún
          notas: "Asistencia confirmada por la parte",
        },
        { onConflict: "hearing_id,party_id" }
      );

    if (attendanceError) {
      console.error("Error en upsert attendance:", attendanceError);
      return NextResponse.json(
        { error: "Error al registrar la confirmación de asistencia" },
        { status: 500 }
      );
    }

    // Actualizar citacion_confirmada_at en case_parties
    const { error: updateError } = await supabaseAdmin
      .from("sgcc_case_parties")
      .update({ citacion_confirmada_at: new Date().toISOString() })
      .eq("case_id", case_id)
      .eq("party_id", userId);

    if (updateError) {
      console.error("Error actualizando citación confirmada:", updateError);
    }

    return NextResponse.json({
      ok: true,
      mensaje: "Asistencia confirmada exitosamente",
    });
  } catch (err) {
    console.error("Error en confirmar-asistencia:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
