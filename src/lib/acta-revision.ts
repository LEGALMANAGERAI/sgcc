import { randomUUID } from "crypto";
import { supabaseAdmin } from "./supabase";
import { notify } from "./notifications";

/**
 * Quién revisa (aprueba/devuelve) las actas de un caso: el conciliador del caso
 * o un admin del centro. Lo que redacta un revisor nace aprobado; lo que
 * redacta cualquier otro (asistente, secretaría) nace en borrador.
 */
export function esRevisorActa(session: any, conciliadorCasoId: string | null): boolean {
  const user = session?.user;
  return user?.sgccRol === "admin" || (!!conciliadorCasoId && user?.id === conciliadorCasoId);
}

/** ¿Puede enviar a partes / firma un acta ya aprobada? */
export function puedeEnviarActa(
  session: any,
  conciliadorCasoId: string | null,
  acta: { estado_revision: string; envio_autorizado_asistente: boolean },
): boolean {
  if (acta.estado_revision !== "aprobada") return false;
  const rol = session?.user?.sgccRol;
  if (esRevisorActa(session, conciliadorCasoId) || rol === "secretario") return true;
  return rol === "asistente" && acta.envio_autorizado_asistente;
}

export const TITULO_ACTA: Record<string, string> = {
  acuerdo_total: "ACTA DE CONCILIACIÓN — ACUERDO TOTAL",
  acuerdo_parcial: "ACTA DE CONCILIACIÓN — ACUERDO PARCIAL",
  no_acuerdo: "ACTA DE CONCILIACIÓN — SIN ACUERDO",
  inasistencia: "CONSTANCIA DE INASISTENCIA",
  desistimiento: "ACTA DE DESISTIMIENTO",
  improcedente: "CONSTANCIA DE IMPROCEDENCIA",
};

/** Email + notificación in-app a las partes del caso con el acta adjunta. */
export async function notificarActaAPartes(opts: {
  centerId: string;
  caseId: string;
  numeroRadicado: string;
  numeroActa: string;
  tipoTitulo: string;
  url: string | null;
}): Promise<number> {
  const { data: caseParties } = await supabaseAdmin
    .from("sgcc_case_parties")
    .select("party:sgcc_parties(id, email)")
    .eq("case_id", opts.caseId);

  const recipients = (caseParties ?? [])
    .map((cp: any) => ({ partyId: cp.party?.id, email: cp.party?.email }))
    .filter((r) => r.email);

  if (recipients.length) {
    await notify({
      centerId: opts.centerId,
      caseId: opts.caseId,
      tipo: "acta_lista",
      titulo: `Acta disponible — ${opts.numeroRadicado}`,
      mensaje: `El acta de su proceso de conciliación ha sido generada y está disponible para descarga y firma.\n\nNúmero de acta: ${opts.numeroActa}\nTipo: ${opts.tipoTitulo}`,
      recipients,
      canal: "both",
      attachmentUrl: opts.url ?? undefined,
    });
  }
  return recipients.length;
}

export type AccionRevision = "enviada_revision" | "devuelta" | "aprobada" | "nueva_version" | "enviada_partes";

/** Registra un paso en la bitácora de revisión (sgcc_acta_revisiones). */
export async function registrarRevision(opts: {
  actaId: string;
  caseId: string;
  staffId: string;
  accion: AccionRevision;
  observaciones?: string | null;
  documentoUrl?: string | null;
}) {
  await supabaseAdmin.from("sgcc_acta_revisiones").insert({
    id: randomUUID(),
    acta_id: opts.actaId,
    case_id: opts.caseId,
    staff_id: opts.staffId,
    accion: opts.accion,
    observaciones: opts.observaciones ?? null,
    documento_url: opts.documentoUrl ?? null,
  });
}
