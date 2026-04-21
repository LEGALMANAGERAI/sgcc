// src/app/api/partes/solicitudes/[id]/radicar/route.ts
// POST: valida el draft con los validators (Ley 2445/2025) y llama la RPC
// atómica radicar_solicitud. Si OK, devuelve {case_id, numero_radicado}.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireParte } from "@/lib/partes/auth-guard";
import { notify } from "@/lib/notifications";
import {
  validarConciliacion,
  validarInsolvencia,
  type ValidationError,
} from "@/lib/solicitudes/validators";
import type {
  FormDataConciliacion,
  FormDataInsolvencia,
} from "@/types/solicitudes";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const guard = await requireParte();
  if ("error" in guard) return guard.error;

  // 1. Cargar draft
  const { data: draft, error: drErr } = await supabaseAdmin
    .from("sgcc_solicitudes_draft")
    .select("*")
    .eq("id", id)
    .eq("user_id", guard.userId)
    .maybeSingle();
  if (drErr) {
    return NextResponse.json({ error: drErr.message }, { status: 500 });
  }
  if (!draft) {
    return NextResponse.json({ error: "Draft no encontrado" }, { status: 404 });
  }

  // Guard de firma electrónica para insolvencia. Si la firma fue completada
  // pero el draft aún no tiene la URL firmada, intentamos sincronizar antes
  // de devolver error al usuario.
  if (draft.tipo_tramite === "insolvencia") {
    if (!draft.solicitud_firma_documento_id) {
      return NextResponse.json(
        { error: "Debes generar y firmar el documento antes de radicar." },
        { status: 400 }
      );
    }
    if (!draft.solicitud_pdf_firmado_url || !draft.solicitud_firmada_at) {
      const { data: documento } = await supabaseAdmin
        .from("sgcc_firma_documentos")
        .select("archivo_firmado_url")
        .eq("id", draft.solicitud_firma_documento_id)
        .maybeSingle();
      const { data: firmante } = await supabaseAdmin
        .from("sgcc_firmantes")
        .select("estado, firmado_at")
        .eq("firma_documento_id", draft.solicitud_firma_documento_id)
        .eq("orden", 1)
        .maybeSingle();
      if (firmante?.estado === "firmado" && documento?.archivo_firmado_url) {
        await supabaseAdmin
          .from("sgcc_solicitudes_draft")
          .update({
            solicitud_pdf_firmado_url: documento.archivo_firmado_url,
            solicitud_firmada_at: firmante.firmado_at ?? new Date().toISOString(),
          })
          .eq("id", draft.id);
        draft.solicitud_pdf_firmado_url = documento.archivo_firmado_url;
        draft.solicitud_firmada_at = firmante.firmado_at ?? new Date().toISOString();
      } else {
        return NextResponse.json(
          { error: "La solicitud aún no ha sido firmada electrónicamente." },
          { status: 400 }
        );
      }
    }
  }

  // 2. Cargar adjuntos (para validación de anexos obligatorios)
  const { data: adjuntos } = await supabaseAdmin
    .from("sgcc_documents")
    .select("tipo_anexo")
    .eq("draft_id", id);

  // 3. Validar según tipo de trámite
  const fd = draft.form_data as Record<string, unknown>;
  let errors: ValidationError[];
  if (draft.tipo_tramite === "conciliacion") {
    errors = validarConciliacion(fd as Partial<FormDataConciliacion>);
  } else if (draft.tipo_tramite === "insolvencia") {
    errors = validarInsolvencia(
      fd as Partial<FormDataInsolvencia>,
      (adjuntos ?? []) as { tipo_anexo: string }[]
    );
  } else {
    return NextResponse.json(
      { error: "Trámite aún no soportado en esta versión" },
      { status: 501 }
    );
  }

  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 422 });
  }

  // 4. RPC atómica
  const { data: rpcOut, error: rpcErr } = await supabaseAdmin.rpc(
    "radicar_solicitud",
    { p_draft_id: id, p_user_id: guard.userId }
  );
  if (rpcErr) {
    return NextResponse.json({ error: rpcErr.message }, { status: 500 });
  }

  // 5. Notificar al deudor y al centro (falla silenciosa si Resend no configurado)
  try {
    const out = rpcOut as { case_id: string; numero_radicado: string };
    const [{ data: parte }, { data: adminsCentro }] = await Promise.all([
      supabaseAdmin
        .from("sgcc_parties")
        .select("email, nombres, razon_social")
        .eq("id", guard.userId)
        .maybeSingle(),
      supabaseAdmin
        .from("sgcc_staff")
        .select("id, email")
        .eq("center_id", draft.center_id)
        .eq("rol", "admin")
        .eq("activo", true),
    ]);

    const nombreParte =
      parte?.nombres ?? parte?.razon_social ?? parte?.email ?? "solicitante";
    const tramiteLabel =
      draft.tipo_tramite === "insolvencia" ? "insolvencia" : "conciliación";

    // Al deudor
    if (parte?.email) {
      await notify({
        centerId: draft.center_id,
        caseId: out.case_id,
        tipo: "nueva_solicitud",
        titulo: `Solicitud radicada: ${out.numero_radicado}`,
        mensaje: `Tu solicitud de ${tramiteLabel} fue radicada exitosamente con el número ${out.numero_radicado}. Puedes hacer seguimiento desde "Mis Casos".`,
        recipients: [{ partyId: guard.userId, email: parte.email }],
      });
    }

    // A los admins del centro
    for (const a of adminsCentro ?? []) {
      if (!a.email) continue;
      await notify({
        centerId: draft.center_id,
        caseId: out.case_id,
        tipo: "nueva_solicitud",
        titulo: `Nueva solicitud: ${out.numero_radicado}`,
        mensaje: `${nombreParte} radicó una solicitud de ${tramiteLabel} (${out.numero_radicado}) desde el portal de partes.`,
        recipients: [{ staffId: a.id, email: a.email }],
      });
    }
  } catch (e) {
    console.error("[radicar] Error enviando notificaciones:", e);
  }

  return NextResponse.json(rpcOut);
}
