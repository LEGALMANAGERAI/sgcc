import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { notify } from "@/lib/notifications";

type Accion = "aprobar" | "rechazar" | "revocar";

/**
 * PATCH /api/asistentes/vinculos/[id]  body { accion }
 *  - aprobar / rechazar: solo solicitudes; el conciliador del vínculo o admin.
 *  - revocar: vínculo activo o solicitud; conciliador, admin o la propia asistente.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = session.user as any;
  const centerId = resolveCenterId(session);
  if (user.userType !== "staff" || !centerId) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const { id } = await params;
  const { accion } = (await req.json()) as { accion: Accion };
  if (!["aprobar", "rechazar", "revocar"].includes(accion)) {
    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }

  const { data: v } = await supabaseAdmin
    .from("sgcc_asistente_vinculos")
    .select("id, estado, asistente_id, conciliador_id, case_id")
    .eq("id", id)
    .eq("center_id", centerId)
    .maybeSingle();
  if (!v) return NextResponse.json({ error: "Vínculo no encontrado" }, { status: 404 });

  const yo = user.id as string;
  const esAdmin = user.sgccRol === "admin";
  const esConciliador = v.conciliador_id === yo;
  const esAsistente = v.asistente_id === yo;

  let nuevoEstado: string;
  if (accion === "revocar") {
    if (!(esAdmin || esConciliador || esAsistente)) {
      return NextResponse.json({ error: "Sin permiso sobre este vínculo" }, { status: 403 });
    }
    if (!["activo", "solicitado"].includes(v.estado)) {
      return NextResponse.json({ error: "El vínculo ya no está vigente" }, { status: 409 });
    }
    nuevoEstado = "revocado";
  } else {
    if (!(esAdmin || esConciliador)) {
      return NextResponse.json({ error: "Solo el conciliador puede resolver la solicitud" }, { status: 403 });
    }
    if (v.estado !== "solicitado") {
      return NextResponse.json({ error: "La solicitud ya fue resuelta" }, { status: 409 });
    }
    nuevoEstado = accion === "aprobar" ? "activo" : "rechazado";
  }

  const now = new Date().toISOString();
  // .eq("estado", v.estado): si otro usuario lo cambió entre medio, no pisa.
  const { data: actualizado, error } = await supabaseAdmin
    .from("sgcc_asistente_vinculos")
    .update({ estado: nuevoEstado, resuelto_por: yo, resuelto_at: now, updated_at: now })
    .eq("id", id)
    .eq("estado", v.estado)
    .select()
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!actualizado) return NextResponse.json({ error: "El vínculo cambió; recarga la página" }, { status: 409 });

  // Avisar a la otra parte del vínculo.
  const otroId = esAsistente ? v.conciliador_id : v.asistente_id;
  const { data: otro } = await supabaseAdmin.from("sgcc_staff").select("id, email").eq("id", otroId).maybeSingle();
  if (otro) {
    const titulos: Record<string, string> = {
      activo: "Solicitud de asistente aprobada",
      rechazado: "Solicitud de asistente rechazada",
      revocado: "Vínculo de asistente terminado",
    };
    await notify({
      centerId,
      caseId: v.case_id ?? undefined,
      tipo: "vinculo_asistente",
      titulo: titulos[nuevoEstado],
      mensaje: `${user.name ?? "Un usuario"} actualizó el vínculo: ${titulos[nuevoEstado].toLowerCase()}.`,
      recipients: [{ staffId: otro.id, email: otro.email }],
    });
  }

  return NextResponse.json(actualizado);
}
