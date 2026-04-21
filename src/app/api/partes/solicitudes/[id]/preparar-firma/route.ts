// POST /api/partes/solicitudes/[id]/preparar-firma
// Flujo:
//   1. Valida el draft con validarInsolvencia (excepto el juramento).
//   2. Genera el PDF de la solicitud con los datos del draft.
//   3. Sube el PDF a Storage y calcula hash SHA-256.
//   4. Crea (o reusa) un sgcc_firma_documentos + un sgcc_firmantes para el deudor.
//   5. Guarda url/hash/firma_documento_id en el draft.
//   6. Devuelve el token del firmante para que el portal inicie la firma inline.

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseAdmin, uploadFile } from "@/lib/supabase";
import { requireParte } from "@/lib/partes/auth-guard";
import { calcularHashSHA256 } from "@/lib/firma/pdf";
import {
  generarPdfSolicitud,
  nombreArchivoSolicitud,
} from "@/lib/solicitudes/pdf-solicitud";
import { validarInsolvencia } from "@/lib/solicitudes/validators";
import type {
  AdjuntoDraft,
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
  const { data: draft } = await supabaseAdmin
    .from("sgcc_solicitudes_draft")
    .select("*")
    .eq("id", id)
    .eq("user_id", guard.userId)
    .maybeSingle();
  if (!draft) {
    return NextResponse.json({ error: "Draft no encontrado" }, { status: 404 });
  }
  if (draft.tipo_tramite !== "insolvencia") {
    return NextResponse.json(
      { error: "Solo aplica a solicitudes de insolvencia" },
      { status: 400 }
    );
  }

  // 2. Cargar adjuntos
  const { data: rawAdjuntos } = await supabaseAdmin
    .from("sgcc_documents")
    .select("id, draft_id, tipo_anexo, nombre_archivo, tamano_bytes, url, created_at")
    .eq("draft_id", id);
  const adjuntos = (rawAdjuntos ?? []) as AdjuntoDraft[];

  // 3. Validar (menos juramento — se marca al final)
  const fd = draft.form_data as Partial<FormDataInsolvencia>;
  const errores = validarInsolvencia(fd, adjuntos).filter(
    (e) => !/juramento/i.test(e.message)
  );
  if (errores.length > 0) {
    return NextResponse.json({ errors: errores }, { status: 422 });
  }

  // 4. Datos del deudor (desde sgcc_parties)
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

  // 5. Generar PDF
  const pdfBuffer = await generarPdfSolicitud({
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

  const hash = calcularHashSHA256(pdfBuffer);
  const archivoNombre = nombreArchivoSolicitud(
    { nombre: nombreDeudor, cedula: parte.numero_doc ?? "" },
    draft.id
  );
  const storagePath = `solicitudes/${draft.center_id}/${draft.id}/${archivoNombre}`;
  const archivoUrl = await uploadFile(
    pdfBuffer,
    "sgcc-documents",
    storagePath,
    "application/pdf"
  );

  // 6. Crear o actualizar sgcc_firma_documentos + sgcc_firmantes
  let firmaDocumentoId: string | null = draft.solicitud_firma_documento_id ?? null;
  let firmanteToken: string | null = null;

  if (firmaDocumentoId) {
    // Regenerar: actualizar hash/url del documento existente y reusar firmante
    await supabaseAdmin
      .from("sgcc_firma_documentos")
      .update({
        archivo_url: archivoUrl,
        archivo_hash: hash,
        archivo_firmado_url: null,
        estado: "enviado",
        firmantes_completados: 0,
      })
      .eq("id", firmaDocumentoId);

    // Reset del firmante (si ya firmó, regeneramos otro)
    const { data: firmante } = await supabaseAdmin
      .from("sgcc_firmantes")
      .select("id, token, estado")
      .eq("firma_documento_id", firmaDocumentoId)
      .eq("cedula", parte.numero_doc ?? "")
      .maybeSingle();

    if (firmante) {
      firmanteToken = firmante.token;
      await supabaseAdmin
        .from("sgcc_firmantes")
        .update({
          estado: "enviado",
          firmado_at: null,
          motivo_rechazo: null,
        })
        .eq("id", firmante.id);
    } else {
      const token = randomUUID();
      const { data: nuevo } = await supabaseAdmin
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
        .select("token")
        .single();
      firmanteToken = nuevo?.token ?? token;
    }
  } else {
    const { data: documento, error: dErr } = await supabaseAdmin
      .from("sgcc_firma_documentos")
      .insert({
        center_id: draft.center_id,
        draft_id: draft.id,
        nombre: `Solicitud insolvencia — ${nombreDeudor}`,
        descripcion: "Solicitud Ley 2445/2025 pendiente de firma del deudor",
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
    firmaDocumentoId = documento!.id;

    const token = randomUUID();
    await supabaseAdmin.from("sgcc_firmantes").insert({
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
    });
    firmanteToken = token;
  }

  // 7. Guardar referencias en el draft
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
    archivo_url: archivoUrl,
    firma_documento_id: firmaDocumentoId,
    firmante_token: firmanteToken,
  });
}
