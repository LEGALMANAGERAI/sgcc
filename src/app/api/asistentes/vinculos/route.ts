import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { notify } from "@/lib/notifications";

/**
 * POST /api/asistentes/vinculos
 * Crea un vínculo asistente ↔ conciliador (todos sus casos o un expediente).
 *
 *  - asistente   → { conciliador_id, case_id? | numero_radicado? }  queda 'solicitado'
 *  - conciliador → { asistente_id, case_id? }                        queda 'activo'
 *  - admin       → { asistente_id, conciliador_id, case_id? | numero_radicado? } 'activo'
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as any;
  const rol = user.sgccRol as string | undefined;
  const centerId = resolveCenterId(session);
  if (user.userType !== "staff" || !centerId || !["admin", "conciliador", "asistente"].includes(rol ?? "")) {
    return NextResponse.json({ error: "Sin permiso para gestionar asistentes" }, { status: 403 });
  }

  const body = await req.json();
  const yo = user.id as string;
  const asistenteId: string | undefined = rol === "asistente" ? yo : body.asistente_id;
  const conciliadorId: string | undefined = rol === "conciliador" ? yo : body.conciliador_id;
  if (!asistenteId || !conciliadorId) {
    return NextResponse.json({ error: "Falta la asistente o el conciliador" }, { status: 400 });
  }

  // Ambos deben ser staff activo de este centro con el rol correcto.
  const { data: personas } = await supabaseAdmin
    .from("sgcc_staff")
    .select("id, nombre, email, rol")
    .in("id", [asistenteId, conciliadorId])
    .eq("center_id", centerId)
    .eq("activo", true);
  const asistente = personas?.find((p) => p.id === asistenteId && p.rol === "asistente");
  const conciliador = personas?.find((p) => p.id === conciliadorId && p.rol === "conciliador");
  if (!asistente) return NextResponse.json({ error: "Asistente no válida en este centro" }, { status: 400 });
  if (!conciliador) return NextResponse.json({ error: "Conciliador no válido en este centro" }, { status: 400 });

  // Alcance: expediente puntual (por id o por radicado) del conciliador, o todos sus casos.
  let caseId: string | null = null;
  let radicado: string | null = null;
  const numeroRadicado = typeof body.numero_radicado === "string" ? body.numero_radicado.trim() : "";
  if (body.case_id || numeroRadicado) {
    let q = supabaseAdmin
      .from("sgcc_cases")
      .select("id, numero_radicado")
      .eq("center_id", centerId)
      .eq("conciliador_id", conciliadorId);
    q = body.case_id ? q.eq("id", body.case_id) : q.eq("numero_radicado", numeroRadicado);
    const { data: caso } = await q.maybeSingle();
    if (!caso) {
      return NextResponse.json({ error: "Ese expediente no existe o no es de ese conciliador" }, { status: 400 });
    }
    caseId = caso.id;
    radicado = caso.numero_radicado;
  }

  const esSolicitud = rol === "asistente";
  const now = new Date().toISOString();
  const { data: vinculo, error } = await supabaseAdmin
    .from("sgcc_asistente_vinculos")
    .insert({
      center_id: centerId,
      asistente_id: asistenteId,
      conciliador_id: conciliadorId,
      case_id: caseId,
      estado: esSolicitud ? "solicitado" : "activo",
      solicitado_por: yo,
      resuelto_por: esSolicitud ? null : yo,
      resuelto_at: esSolicitud ? null : now,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Ya existe un vínculo o solicitud vigente con ese alcance" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const alcance = radicado ? `el expediente ${radicado}` : `todos los casos de ${conciliador.nombre}`;
  const destino = esSolicitud ? conciliador : asistente;
  await notify({
    centerId,
    caseId: caseId ?? undefined,
    tipo: "vinculo_asistente",
    titulo: esSolicitud ? "Solicitud de vínculo de asistente" : "Te vincularon como asistente",
    mensaje: esSolicitud
      ? `${asistente.nombre} solicita acceso a ${alcance}. Apruébala o recházala en Asistentes.`
      : `Ahora tienes acceso a ${alcance}.`,
    recipients: [{ staffId: destino.id, email: destino.email }],
  });

  return NextResponse.json(vinculo, { status: 201 });
}
