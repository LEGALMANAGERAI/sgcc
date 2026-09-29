import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { guardCasoStaff } from "@/lib/server-utils";
import { notify } from "@/lib/notifications";
import {
  esRevisorActa,
  puedeEnviarActa,
  registrarRevision,
  notificarActaAPartes,
  TITULO_ACTA,
} from "@/lib/acta-revision";

type Params = { params: Promise<{ id: string }> };

/** GET ?acta_id= → bitácora de revisión del acta, en orden cronológico. */
export async function GET(req: NextRequest, { params }: Params) {
  const { id: caseId } = await params;
  const g = await guardCasoStaff(await auth(), caseId);
  if ("error" in g) return g.error;

  const actaId = req.nextUrl.searchParams.get("acta_id");
  if (!actaId) return NextResponse.json({ error: "acta_id es requerido" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("sgcc_acta_revisiones")
    .select("id, accion, observaciones, documento_url, created_at, staff:sgcc_staff(nombre)")
    .eq("acta_id", actaId)
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    (data ?? []).map(({ staff, ...r }: any) => ({ ...r, staff_nombre: staff?.nombre ?? null })),
  );
}

/**
 * POST { acta_id, accion, observaciones?, autorizar_envio? }
 *  enviar_revision  borrador|devuelta → en_revision   (quien no es revisor)
 *  aprobar          en_revision → aprobada            (conciliador del caso / admin)
 *  devolver         en_revision → devuelta            (conciliador / admin, con observaciones)
 *  enviar_partes    aprobada → email a las partes     (ver puedeEnviarActa)
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { id: caseId } = await params;
  const session = await auth();
  const g = await guardCasoStaff(session, caseId);
  if ("error" in g) return g.error;
  const { centerId } = g;
  const staffId = (session!.user as any).id as string;

  const { acta_id, accion, observaciones, autorizar_envio } = await req.json();
  const obs = typeof observaciones === "string" ? observaciones.trim() : "";

  const [{ data: acta }, { data: caso }] = await Promise.all([
    supabaseAdmin
      .from("sgcc_actas")
      .select("id, numero_acta, tipo, estado_revision, envio_autorizado_asistente, redactada_por, borrador_url")
      .eq("id", acta_id)
      .eq("case_id", caseId)
      .maybeSingle(),
    supabaseAdmin
      .from("sgcc_cases")
      .select("numero_radicado, conciliador_id")
      .eq("id", caseId)
      .eq("center_id", centerId)
      .single(),
  ]);
  if (!acta || !caso) return NextResponse.json({ error: "Acta no encontrada" }, { status: 404 });

  const esRevisor = esRevisorActa(session, caso.conciliador_id);
  const now = new Date().toISOString();
  let desde: string[];
  let cambios: Record<string, unknown>;

  switch (accion) {
    case "enviar_revision":
      if (esRevisor) {
        return NextResponse.json({ error: "El revisor aprueba directamente; no necesita enviarla a revisión" }, { status: 400 });
      }
      desde = ["borrador", "devuelta"];
      cambios = { estado_revision: "en_revision" };
      break;
    case "aprobar":
    case "devolver":
      if (!esRevisor) {
        return NextResponse.json({ error: "Solo el conciliador del caso puede revisar el acta" }, { status: 403 });
      }
      if (accion === "devolver" && !obs) {
        return NextResponse.json({ error: "Escribe las observaciones para devolverla" }, { status: 400 });
      }
      desde = ["en_revision"];
      cambios =
        accion === "aprobar"
          ? {
              estado_revision: "aprobada",
              revisada_por: staffId,
              revisada_at: now,
              envio_autorizado_asistente: autorizar_envio === true,
            }
          : { estado_revision: "devuelta", revisada_por: staffId, revisada_at: now };
      break;
    case "enviar_partes": {
      if (!puedeEnviarActa(session, caso.conciliador_id, acta)) {
        return NextResponse.json(
          { error: acta.estado_revision !== "aprobada" ? "El acta aún no está aprobada" : "No estás autorizada para enviar esta acta" },
          { status: 403 },
        );
      }
      const enviados = await notificarActaAPartes({
        centerId,
        caseId,
        numeroRadicado: caso.numero_radicado,
        numeroActa: acta.numero_acta,
        tipoTitulo: TITULO_ACTA[acta.tipo] ?? "ACTA DE CONCILIACIÓN",
        url: acta.borrador_url,
      });
      if (enviados === 0) {
        return NextResponse.json({ error: "Ninguna parte del caso tiene email registrado" }, { status: 400 });
      }
      await registrarRevision({ actaId: acta.id, caseId, staffId, accion: "enviada_partes", documentoUrl: acta.borrador_url });
      return NextResponse.json({ ...acta, enviados });
    }
    default:
      return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }

  if (!desde.includes(acta.estado_revision)) {
    return NextResponse.json({ error: `No se puede ${accion.replace("_", " ")} un acta en estado ${acta.estado_revision}` }, { status: 409 });
  }

  // Condicionado al estado leído: si otro usuario la movió entre medio, no pisa.
  const { data: actualizada, error } = await supabaseAdmin
    .from("sgcc_actas")
    .update({ ...cambios, updated_at: now })
    .eq("id", acta.id)
    .eq("estado_revision", acta.estado_revision)
    .select()
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!actualizada) return NextResponse.json({ error: "El acta cambió; recarga la página" }, { status: 409 });

  const accionBitacora = { enviar_revision: "enviada_revision", aprobar: "aprobada", devolver: "devuelta" } as const;
  await registrarRevision({
    actaId: acta.id,
    caseId,
    staffId,
    accion: accionBitacora[accion as keyof typeof accionBitacora],
    observaciones: obs || null,
  });

  // Aviso: al enviar a revisión → conciliador; al aprobar/devolver → quien la redactó.
  const destinoId = accion === "enviar_revision" ? caso.conciliador_id : acta.redactada_por;
  if (destinoId && destinoId !== staffId) {
    const { data: destino } = await supabaseAdmin.from("sgcc_staff").select("id, email").eq("id", destinoId).maybeSingle();
    const titulos = {
      enviar_revision: `Acta por revisar — ${caso.numero_radicado}`,
      aprobar: `Acta aprobada — ${caso.numero_radicado}`,
      devolver: `Acta devuelta con observaciones — ${caso.numero_radicado}`,
    } as const;
    const mensajes = {
      enviar_revision: `El acta ${acta.numero_acta} quedó lista para tu revisión.`,
      aprobar: autorizar_envio
        ? `El acta ${acta.numero_acta} fue aprobada y puedes enviarla a las partes.`
        : `El acta ${acta.numero_acta} fue aprobada.`,
      devolver: `El acta ${acta.numero_acta} fue devuelta. Observaciones:\n\n${obs}`,
    } as const;
    if (destino) {
      await notify({
        centerId,
        caseId,
        tipo: "acta_revision",
        titulo: titulos[accion as keyof typeof titulos],
        mensaje: mensajes[accion as keyof typeof mensajes],
        recipients: [{ staffId: destino.id, email: destino.email }],
      });
    }
  }

  return NextResponse.json(actualizada);
}
