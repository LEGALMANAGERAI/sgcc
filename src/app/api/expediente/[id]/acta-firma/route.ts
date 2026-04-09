import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { generarTokenFirma } from "@/lib/firma/tokens";
import { calcularHashSHA256 } from "@/lib/firma/pdf";
import { randomUUID } from "crypto";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/expediente/[id]/acta-firma
 * Crea un documento de firma electrónica a partir de un acta de insolvencia.
 *
 * Body: { acta_id: string }
 *
 * Flujo simplificado:
 * 1. Obtiene el acta y datos del caso (partes, conciliador, apoderados)
 * 2. Descarga el borrador DOCX de storage y lo sube como documento de firma
 * 3. Crea los firmantes en orden secuencial: Insolvente → Apoderado (si existe) → Operador
 * 4. Retorna firma_documento_id para gestionar desde la UI de firmas (/firmas/[id])
 */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id: caseId } = await params;
  const userId = (session.user as any)?.id;

  try {
    const { acta_id } = await req.json();
    if (!acta_id) {
      return NextResponse.json({ error: "acta_id es requerido" }, { status: 400 });
    }

    // 1. Obtener el acta
    const { data: acta, error: actaError } = await supabaseAdmin
      .from("sgcc_actas")
      .select("*")
      .eq("id", acta_id)
      .eq("case_id", caseId)
      .single();

    if (actaError || !acta) {
      return NextResponse.json({ error: "Acta no encontrada" }, { status: 404 });
    }

    if (!acta.borrador_url) {
      return NextResponse.json(
        { error: "El acta no tiene un borrador generado" },
        { status: 400 }
      );
    }

    // 2. Obtener caso con partes y conciliador
    const { data: caso } = await supabaseAdmin
      .from("sgcc_cases")
      .select(`
        *,
        partes:sgcc_case_parties(
          id, rol,
          party:sgcc_parties(id, nombres, apellidos, razon_social, tipo_persona, numero_doc, nit_empresa, email)
        ),
        conciliador:sgcc_staff!sgcc_cases_conciliador_id_fkey(id, nombre, email, tarjeta_profesional)
      `)
      .eq("id", caseId)
      .eq("center_id", centerId)
      .single();

    if (!caso) {
      return NextResponse.json({ error: "Caso no encontrado" }, { status: 404 });
    }

    // 3. Obtener apoderados del caso
    const { data: rawAttorneys } = await supabaseAdmin
      .from("sgcc_case_attorneys")
      .select(`
        *,
        attorney:sgcc_attorneys(id, nombre, tarjeta_profesional, email),
        party:sgcc_parties(id, nombres, apellidos, razon_social, tipo_persona)
      `)
      .eq("case_id", caseId)
      .eq("activo", true);

    const attorneys = rawAttorneys ?? [];

    // 4. Identificar convocante (insolvente)
    const convocantePart = caso.partes?.find((p: any) => p.rol === "convocante");
    if (!convocantePart?.party) {
      return NextResponse.json(
        { error: "No se encontró al convocante (insolvente)" },
        { status: 400 }
      );
    }

    const insolvente = convocantePart.party;
    const insolventeNombre = insolvente.tipo_persona === "juridica"
      ? insolvente.razon_social
      : [insolvente.nombres, insolvente.apellidos].filter(Boolean).join(" ");

    // 5. Identificar apoderado del insolvente
    const apoderadoInsolvente = attorneys.find(
      (a: any) => a.party?.id === insolvente.id
    );

    // 6. Descargar el borrador desde Storage para calcular hash
    // Extraer el path relativo del storage a partir de la URL pública
    const borradorUrl = acta.borrador_url as string;

    // Descargar el archivo via fetch
    const fileResponse = await fetch(borradorUrl);
    if (!fileResponse.ok) {
      return NextResponse.json(
        { error: "No se pudo descargar el borrador del acta" },
        { status: 500 }
      );
    }

    const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());
    const archivoHash = calcularHashSHA256(fileBuffer);

    // 7. Subir como documento de firma en storage
    const docId = randomUUID();
    const storagePath = `firmas/${centerId}/${docId}.docx`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("sgcc-documents")
      .upload(storagePath, fileBuffer, {
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Error subiendo archivo: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data: urlData } = supabaseAdmin.storage
      .from("sgcc-documents")
      .getPublicUrl(storagePath);

    const archivoUrl = urlData.publicUrl;

    // 8. Construir lista de firmantes en orden secuencial
    const firmantesRaw: Array<{
      nombre: string;
      cedula: string;
      email: string;
      orden: number;
    }> = [];

    // Firmante 1: Insolvente (convocante)
    firmantesRaw.push({
      nombre: insolventeNombre || "Insolvente",
      cedula: insolvente.numero_doc || insolvente.nit_empresa || "",
      email: insolvente.email || "",
      orden: 1,
    });

    // Firmante 2: Apoderado del insolvente (si existe)
    if (apoderadoInsolvente?.attorney) {
      firmantesRaw.push({
        nombre: apoderadoInsolvente.attorney.nombre || "Apoderado",
        cedula: apoderadoInsolvente.attorney.tarjeta_profesional || "",
        email: apoderadoInsolvente.attorney.email || "",
        orden: 2,
      });
    }

    // Firmante 3 (o 2): Operador (conciliador)
    if (caso.conciliador) {
      firmantesRaw.push({
        nombre: caso.conciliador.nombre || "Operador",
        cedula: "",
        email: caso.conciliador.email || "",
        orden: firmantesRaw.length + 1,
      });
    }

    if (!firmantesRaw.length) {
      return NextResponse.json(
        { error: "No se pudieron determinar los firmantes" },
        { status: 400 }
      );
    }

    // Filtrar firmantes sin email
    const firmantesValidos = firmantesRaw.filter((f) => f.email);
    if (!firmantesValidos.length) {
      return NextResponse.json(
        { error: "Ningún firmante tiene email configurado" },
        { status: 400 }
      );
    }

    // 9. Crear documento de firma en BD
    const diasExpiracion = 30;
    const fechaExpiracion = new Date(
      Date.now() + diasExpiracion * 24 * 60 * 60 * 1000
    ).toISOString();

    const nombreDoc = `Acta Insolvencia — ${acta.numero_acta || caso.numero_radicado}`;

    const { data: documento, error: docError } = await supabaseAdmin
      .from("sgcc_firma_documentos")
      .insert({
        id: docId,
        center_id: centerId,
        case_id: caseId,
        nombre: nombreDoc,
        descripcion: `Acta de audiencia de insolvencia del caso ${caso.numero_radicado}`,
        archivo_url: archivoUrl,
        archivo_hash: archivoHash,
        archivo_firmado_url: null,
        estado: "pendiente",
        orden_secuencial: true,
        dias_expiracion: diasExpiracion,
        fecha_expiracion: fechaExpiracion,
        total_firmantes: firmantesValidos.length,
        firmantes_completados: 0,
        creado_por: userId,
      })
      .select()
      .single();

    if (docError) {
      return NextResponse.json({ error: docError.message }, { status: 500 });
    }

    // 10. Crear firmantes con tokens
    const firmantesData = firmantesValidos.map((f) => ({
      id: randomUUID(),
      firma_documento_id: docId,
      nombre: f.nombre,
      cedula: f.cedula,
      email: f.email,
      telefono: null,
      orden: f.orden,
      token: generarTokenFirma(),
      estado: "pendiente" as const,
      canal_notificacion: "email",
    }));

    const { error: firmError } = await supabaseAdmin
      .from("sgcc_firmantes")
      .insert(firmantesData);

    if (firmError) {
      return NextResponse.json({ error: firmError.message }, { status: 500 });
    }

    // 11. Registrar en audit trail
    await supabaseAdmin.from("sgcc_firma_registros").insert({
      firma_documento_id: docId,
      firmante_id: null,
      accion: "documento_creado",
      ip: req.headers.get("x-forwarded-for") || "unknown",
      user_agent: req.headers.get("user-agent") || "unknown",
      metadatos: {
        creado_por: userId,
        acta_id,
        case_id: caseId,
        total_firmantes: firmantesValidos.length,
        origen: "acta_insolvencia",
      },
    });

    // 12. Actualizar estado del acta
    await supabaseAdmin
      .from("sgcc_actas")
      .update({ estado_firma: "pendiente", updated_at: new Date().toISOString() })
      .eq("id", acta_id);

    return NextResponse.json(
      {
        success: true,
        firma_documento_id: docId,
        firmantes: firmantesData.length,
        mensaje: `Documento de firma creado con ${firmantesData.length} firmante(s). Puede enviar las notificaciones desde el módulo de firmas.`,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("Error en acta-firma:", err);
    return NextResponse.json(
      { error: err.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}
