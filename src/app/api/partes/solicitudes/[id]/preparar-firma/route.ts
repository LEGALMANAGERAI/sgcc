// POST /api/partes/solicitudes/[id]/preparar-firma
// Flujo (insolvencia y conciliación, firma vía Legal Manager — modelo redirect):
//   1. Valida el draft según tipo (insolvencia: validarInsolvencia sin juramento;
//      conciliacion: validarConciliacion).
//   2. Genera el PDF de la solicitud con los datos del draft.
//   3. Sube el PDF a Storage y calcula hash SHA-256.
//   4. SIEMPRE crea un sgcc_firma_documentos NUEVO (proveedor "lm") + 1 firmante
//      (el solicitante). Si había uno previo, lo cancela. Esto evita problemas de
//      idempotencia de LM cuando el PDF cambia.
//   5. Crea la solicitud en Legal Manager y obtiene la signing_url del firmante.
//   6. Guarda url/hash/firma_documento_id en el draft.
//   7. Devuelve el firma_documento_id + signing_url para redirigir al portal LM.

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseAdmin, uploadFile } from "@/lib/supabase";
import { requireParte } from "@/lib/partes/auth-guard";
import { calcularHashSHA256 } from "@/lib/firma/pdf";
import {
  generarPdfSolicitud,
  nombreArchivoSolicitud,
} from "@/lib/solicitudes/pdf-solicitud";
import {
  generarPdfConciliacion,
  nombreArchivoConciliacion,
} from "@/lib/solicitudes/pdf-solicitud-conciliacion";
import {
  validarConciliacion,
  validarInsolvencia,
} from "@/lib/solicitudes/validators";
import { lmConfigured, lmCrearSolicitud } from "@/lib/firma/lm-client";
import type {
  AdjuntoDraft,
  FormDataConciliacion,
  FormDataInsolvencia,
} from "@/types/solicitudes";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const guard = await requireParte();
  if ("error" in guard) return guard.error;

  // 1. Cargar draft
  const { data: draft } = await supabaseAdmin
    .from("sgcc_solicitudes_draft")
    .select("*")
    .eq("id", id)
    .eq("user_id", guard.userId)
    .maybeSingle();
  if (!draft) {
    return NextResponse.json({ error: "Draft no encontrado" }, { status: 404 });
  }

  const tipo = draft.tipo_tramite as string;
  if (tipo !== "insolvencia" && tipo !== "conciliacion") {
    return NextResponse.json(
      { error: "Trámite no soportado para firma" },
      { status: 400 }
    );
  }

  // 2. Cargar adjuntos
  const { data: rawAdjuntos } = await supabaseAdmin
    .from("sgcc_documents")
    .select("id, draft_id, tipo_anexo, nombre_archivo, tamano_bytes, url, created_at")
    .eq("draft_id", id);
  const adjuntos = (rawAdjuntos ?? []) as AdjuntoDraft[];

  // 3. Validar según tipo
  if (tipo === "insolvencia") {
    const fd = draft.form_data as Partial<FormDataInsolvencia>;
    const errores = validarInsolvencia(fd, adjuntos).filter(
      (e) => !/juramento/i.test(e.message)
    );
    if (errores.length > 0) {
      return NextResponse.json({ errors: errores }, { status: 422 });
    }
  } else {
    const fd = draft.form_data as Partial<FormDataConciliacion>;
    const errores = validarConciliacion(fd);
    if (errores.length > 0) {
      return NextResponse.json({ errors: errores }, { status: 422 });
    }
  }

  // 4. Datos del solicitante (desde sgcc_parties)
  const { data: parte } = await supabaseAdmin
    .from("sgcc_parties")
    .select("id, nombres, apellidos, razon_social, numero_doc, email, telefono")
    .eq("id", guard.userId)
    .maybeSingle();
  if (!parte?.email) {
    return NextResponse.json(
      { error: "La cuenta del solicitante no tiene email registrado" },
      { status: 400 }
    );
  }
  const nombreDeudor =
    [parte.nombres, parte.apellidos].filter(Boolean).join(" ").trim() ||
    parte.razon_social ||
    parte.email;

  const { data: centro } = await supabaseAdmin
    .from("sgcc_centers")
    .select("nombre, codigo")
    .eq("id", draft.center_id)
    .maybeSingle();

  // 5. Generar PDF según tipo
  let pdfBuffer: Buffer;
  let archivoNombre: string;
  let nombreDoc: string;

  if (tipo === "insolvencia") {
    const fd = draft.form_data as Partial<FormDataInsolvencia>;
    pdfBuffer = await generarPdfSolicitud({
      fd,
      deudor: {
        nombre: nombreDeudor,
        cedula: parte.numero_doc ?? "",
        email: parte.email,
        telefono: parte.telefono ?? undefined,
      },
      adjuntos,
      centro: {
        nombre: centro?.nombre ?? "Centro de Conciliación",
        codigo: centro?.codigo ?? undefined,
      },
    });
    archivoNombre = nombreArchivoSolicitud(
      { nombre: nombreDeudor, cedula: parte.numero_doc ?? "" },
      draft.id
    );
    nombreDoc = `Solicitud insolvencia — ${nombreDeudor}`;
  } else {
    const fd = draft.form_data as Partial<FormDataConciliacion>;
    pdfBuffer = await generarPdfConciliacion({
      fd,
      solicitante: {
        nombre: nombreDeudor,
        cedula: parte.numero_doc ?? "",
        email: parte.email,
        telefono: parte.telefono ?? undefined,
      },
      adjuntos,
      centro: {
        nombre: centro?.nombre ?? "Centro de Conciliación",
        codigo: centro?.codigo ?? undefined,
      },
    });
    archivoNombre = nombreArchivoConciliacion(
      { nombre: nombreDeudor, cedula: parte.numero_doc ?? "" },
      draft.id
    );
    nombreDoc = `Solicitud conciliación — ${nombreDeudor}`;
  }

  const hash = calcularHashSHA256(pdfBuffer);
  const storagePath = `solicitudes/${draft.center_id}/${draft.id}/${archivoNombre}`;
  const archivoUrl = await uploadFile(
    pdfBuffer,
    "sgcc-documents",
    storagePath,
    "application/pdf"
  );

  // 6. Cancelar el documento de firma previo (si existía) para evitar idempotencia LM
  if (draft.solicitud_firma_documento_id) {
    await supabaseAdmin
      .from("sgcc_firma_documentos")
      .update({ estado: "cancelado" })
      .eq("id", draft.solicitud_firma_documento_id);
  }

  // 7. Crear SIEMPRE un sgcc_firma_documentos NUEVO (proveedor "lm")
  const descripcion =
    tipo === "insolvencia"
      ? "Solicitud Ley 2445/2025 pendiente de firma del solicitante"
      : "Solicitud de conciliación pendiente de firma del solicitante";

  const { data: documento, error: dErr } = await supabaseAdmin
    .from("sgcc_firma_documentos")
    .insert({
      center_id: draft.center_id,
      draft_id: draft.id,
      proveedor: "lm",
      nombre: nombreDoc,
      descripcion,
      archivo_url: archivoUrl,
      archivo_hash: hash,
      estado: "enviado",
      orden_secuencial: true,
      dias_expiracion: 7,
      fecha_expiracion: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      total_firmantes: 1,
      firmantes_completados: 0,
    })
    .select("id")
    .single();
  if (dErr) {
    return NextResponse.json({ error: dErr.message }, { status: 500 });
  }
  const firmaDocumentoId = documento!.id;

  // Crear el firmante (orden 1 = el solicitante). Token por compatibilidad.
  const token = randomUUID();
  const { data: firmanteRow, error: fErr } = await supabaseAdmin
    .from("sgcc_firmantes")
    .insert({
      firma_documento_id: firmaDocumentoId,
      nombre: nombreDeudor,
      cedula: parte.numero_doc ?? "",
      email: parte.email,
      telefono: parte.telefono,
      orden: 1,
      estado: "enviado",
      token,
      canal_notificacion: "email",
      enviado_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (fErr) {
    return NextResponse.json({ error: fErr.message }, { status: 500 });
  }
  const firmanteId = firmanteRow!.id;

  // 8. Integración Legal Manager (modelo redirect)
  if (!lmConfigured()) {
    return NextResponse.json(
      { error: "La firma con Legal Manager no está configurada." },
      { status: 503 }
    );
  }

  const { data: signed, error: signErr } = await supabaseAdmin.storage
    .from("sgcc-documents")
    .createSignedUrl(storagePath, 3600);
  if (signErr || !signed?.signedUrl) {
    return NextResponse.json(
      { error: "No se pudo preparar el documento para Legal Manager." },
      { status: 500 }
    );
  }

  let resp;
  try {
    resp = await lmCrearSolicitud({
      centro_id: draft.center_id,
      external_solicitud_id: firmaDocumentoId,
      nombre: nombreDoc,
      documento_url: signed.signedUrl,
      firmantes: [
        {
          nombre: nombreDeudor,
          cedula: parte.numero_doc ?? "",
          email: parte.email,
          telefono: parte.telefono ?? undefined,
          canal: "email",
          orden: 1,
        },
      ],
      orden_secuencial: true,
      dias_expiracion: 7,
      return_url: `${APP_URL}/mis-solicitudes/${draft.id}`,
      webhook_url: `${APP_URL}/api/firmar/webhook-lm`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Error al crear la solicitud en Legal Manager." },
      { status: 502 }
    );
  }

  // Persistir referencias LM
  await supabaseAdmin
    .from("sgcc_firma_documentos")
    .update({ lm_solicitud_id: resp.solicitud_id })
    .eq("id", firmaDocumentoId);

  const lmFirmante = resp.firmantes?.[0];
  const signingUrl = lmFirmante?.signing_url ?? null;
  await supabaseAdmin
    .from("sgcc_firmantes")
    .update({
      lm_firmante_id: lmFirmante?.firmante_id ?? null,
      lm_signing_url: signingUrl,
      estado: "enviado",
      enviado_at: new Date().toISOString(),
    })
    .eq("id", firmanteId);

  // 9. Guardar referencias en el draft (apuntando al documento NUEVO)
  await supabaseAdmin
    .from("sgcc_solicitudes_draft")
    .update({
      solicitud_pdf_url: archivoUrl,
      solicitud_pdf_hash: hash,
      solicitud_firma_documento_id: firmaDocumentoId,
      solicitud_pdf_firmado_url: null,
      solicitud_firmada_at: null,
    })
    .eq("id", draft.id);

  return NextResponse.json({
    ok: true,
    firma_documento_id: firmaDocumentoId,
    signing_url: signingUrl,
  });
}
