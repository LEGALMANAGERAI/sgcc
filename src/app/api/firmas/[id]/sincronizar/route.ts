import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { lmConfigured, lmGetSolicitud } from "@/lib/firma/lm-client";

type Params = { params: Promise<{ id: string }> };

// Normaliza para comparar emails/nombres sin importar mayúsculas/espacios/acentos.
const norm = (s: string | null | undefined) =>
  (s ?? "").trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

// Estado de la solicitud en LM → estado del documento en SIGECC.
const ESTADO_DOC: Record<string, string> = {
  Pendiente: "pendiente",
  Enviado: "enviado",
  EnProceso: "en_proceso",
  Completado: "completado",
  Rechazado: "rechazado",
  Expirado: "expirado",
};

/**
 * POST /api/firmas/[id]/sincronizar
 * Reconciliación manual del estado de firma contra Legal Manager (proveedor "lm").
 * Sirve de respaldo cuando se pierde un webhook: vuelve a consultar
 * GET /solicitudes/{id} en LM y actualiza firmantes + documento (incluido el PDF
 * firmado). Arregla firmantes que quedaron en "pendiente" aunque ya firmaron y
 * documentos completados que no reflejaban el archivo final.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id } = await params;

  const { data: documento } = await supabaseAdmin
    .from("sgcc_firma_documentos")
    .select("id, estado, proveedor, lm_solicitud_id, total_firmantes, firmantes:sgcc_firmantes(id, nombre, email, estado, firmado_at, lm_firmante_id)")
    .eq("id", id)
    .eq("center_id", centerId)
    .single();

  if (!documento) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  if (documento.proveedor !== "lm") {
    return NextResponse.json({ error: "Este documento no usa Legal Manager." }, { status: 400 });
  }
  if (!documento.lm_solicitud_id) {
    return NextResponse.json({ error: "Este documento aún no se ha enviado a Legal Manager." }, { status: 400 });
  }
  if (!lmConfigured()) {
    return NextResponse.json({ error: "La integración con Legal Manager no está configurada." }, { status: 503 });
  }

  // Consultar el estado real en LM.
  let lm: any;
  try {
    lm = await lmGetSolicitud(documento.lm_solicitud_id);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "No se pudo consultar el estado en Legal Manager." },
      { status: 502 },
    );
  }

  const now = new Date().toISOString();
  const firmantesLocales: any[] = documento.firmantes ?? [];
  const firmantesLm: any[] = Array.isArray(lm?.firmantes) ? lm.firmantes : [];

  // Reconciliar cada firmante. Match primario por lm_firmante_id; si falla (p. ej.
  // el id quedó mal guardado al emparejar por nombre en el envío), cae a match por
  // EMAIL y auto-corrige el lm_firmante_id. Solo "subimos" a estados terminales
  // (firmado / rechazado / expirado); no degradamos estados intermedios.
  let firmantesActualizados = 0;
  const diag: string[] = []; // qué reporta LM de cada firmante (para diagnóstico)

  for (const lf of firmantesLm) {
    let match = firmantesLocales.find((f) => f.lm_firmante_id && f.lm_firmante_id === lf.firmante_id);
    let matchPorEmail = false;
    if (!match && lf.email) {
      match = firmantesLocales.find((f) => f.email && norm(f.email) === norm(lf.email));
      matchPorEmail = Boolean(match);
    }

    const estadoLm = String(lf.estado ?? "").toLowerCase();
    diag.push(`${lf.nombre || lf.email || lf.firmante_id} → ${lf.estado ?? "?"}`);

    if (!match) continue;

    const update: Record<string, any> = {};
    // Auto-corregir el lm_firmante_id si emparejamos por email o estaba desincronizado.
    if (matchPorEmail || match.lm_firmante_id !== lf.firmante_id) {
      update.lm_firmante_id = lf.firmante_id;
    }

    let nuevoEstado: string | null = null;
    if (lf.firmado_at || estadoLm.includes("firmad") || estadoLm.includes("complet")) {
      nuevoEstado = "firmado";
    } else if (estadoLm.includes("rechaz")) {
      nuevoEstado = "rechazado";
    } else if (estadoLm.includes("expir")) {
      nuevoEstado = "expirado";
    }
    if (nuevoEstado && nuevoEstado !== match.estado) {
      update.estado = nuevoEstado;
      if (nuevoEstado === "firmado") update.firmado_at = lf.firmado_at ?? match.firmado_at ?? now;
    }

    if (Object.keys(update).length === 0) continue;

    await supabaseAdmin.from("sgcc_firmantes").update(update).eq("id", match.id);
    if (update.estado) {
      firmantesActualizados++;
      // Auditoría con acciones válidas del enum (firmado / rechazado).
      if (update.estado === "firmado" || update.estado === "rechazado") {
        await supabaseAdmin.from("sgcc_firma_registros").insert({
          firma_documento_id: id,
          firmante_id: match.id,
          accion: update.estado,
          canal_otp: "lm",
          metadatos: { proveedor: "lm", via: "sincronizacion_manual", match: matchPorEmail ? "email" : "id" },
        });
      }
    }
  }

  // Recontar firmados.
  const { count } = await supabaseAdmin
    .from("sgcc_firmantes")
    .select("id", { count: "exact", head: true })
    .eq("firma_documento_id", id)
    .eq("estado", "firmado");
  const completados = count ?? 0;

  // Actualizar el documento.
  const nuevoEstadoDoc = ESTADO_DOC[lm?.estado] ?? documento.estado;
  const docUpdate: Record<string, any> = {
    estado: nuevoEstadoDoc,
    firmantes_completados: completados,
    updated_at: now,
  };
  if (nuevoEstadoDoc === "completado") {
    // PDF firmado servido por nuestro endpoint (siempre fresco; las signed URL de LM son cortas).
    docUpdate.archivo_firmado_url = `/api/firmas/${id}/documento-firmado`;
    if (lm?.pdf_firmado_url) docUpdate.lm_pdf_firmado_url = lm.pdf_firmado_url;
    if (lm?.verificacion_url) docUpdate.lm_verificacion_url = lm.verificacion_url;
  }
  await supabaseAdmin.from("sgcc_firma_documentos").update(docUpdate).eq("id", id);

  const total = documento.total_firmantes ?? firmantesLocales.length;
  let message: string;
  if (nuevoEstadoDoc === "completado") {
    message = `Sincronizado con Legal Manager: documento completado (${completados}/${total} firmantes). El PDF firmado ya está disponible.`;
  } else if (firmantesActualizados > 0) {
    message = `Sincronizado con Legal Manager: ${completados}/${total} firmantes firmados (${firmantesActualizados} actualizado(s)).`;
  } else {
    // Nada cambió: mostramos lo que LM reporta de cada firmante para diagnosticar.
    const detalle = diag.length ? ` Según Legal Manager: ${diag.join("; ")}.` : "";
    message = `Sin cambios: Legal Manager reporta ${completados}/${total} firmantes firmados.${detalle} Si alguien firmó pero LM lo muestra como "Enviado/Pendiente", la firma no se completó en Legal Manager.`;
  }

  const changed = firmantesActualizados > 0 || nuevoEstadoDoc !== documento.estado;

  return NextResponse.json({
    ok: true,
    changed,
    estado: nuevoEstadoDoc,
    firmantes_completados: completados,
    total,
    firmantes_actualizados: firmantesActualizados,
    message,
  });
}
