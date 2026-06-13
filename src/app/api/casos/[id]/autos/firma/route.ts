import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { randomUUID } from "crypto";
import { resolverVariablesAuto } from "@/lib/autos/resolver-variables";
import { generarAutoSuspensionPdf } from "@/lib/autos/pdf-auto-suspension";
import { calcularHashSHA256 } from "@/lib/firma/pdf";
import { generarTokenFirma } from "@/lib/firma/tokens";
import { firmaActivaDelCaso, mensajeDuplicado } from "@/lib/firma/duplicados";
import type { AutoSuspensionOpciones } from "@/lib/autos/types";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/casos/[id]/autos/firma
 * Genera el Auto de Suspensión en PDF y lo deja listo para firma electrónica.
 *
 * Firmantes:
 *  - El OPERADOR (conciliador) siempre firma.
 *  - El INSOLVENTE si asistió a la audiencia; si NO asistió, firma su APODERADO.
 *
 * El documento queda en estado "pendiente"; las notificaciones se envían desde
 * el módulo de firmas (/firmas/[id] → "Enviar a firmantes").
 *
 * Body: { tipo: "suspension", hearing_id: string | null, opciones, confirmar_duplicado? }
 * Response: { success: true, firma_documento_id, firmantes }
 */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id: caseId } = await params;
  const userId = (session.user as any)?.id;

  try {
    const { tipo, hearing_id, opciones, confirmar_duplicado } = await req.json();

    if (tipo !== "suspension") {
      return NextResponse.json(
        { error: "Solo el auto de suspensión soporta firma por ahora" },
        { status: 400 },
      );
    }
    if (!opciones) {
      return NextResponse.json({ error: "El campo 'opciones' es requerido" }, { status: 400 });
    }

    // Verificar scope del centro.
    const { data: caso } = await supabaseAdmin
      .from("sgcc_cases")
      .select("id, numero_radicado")
      .eq("id", caseId)
      .eq("center_id", centerId)
      .single();
    if (!caso) return NextResponse.json({ error: "Caso no encontrado" }, { status: 404 });

    // Evitar duplicados: si el caso ya tiene un documento de firma activo, avisar.
    if (!confirmar_duplicado) {
      const existente = await firmaActivaDelCaso(caseId, centerId);
      if (existente) {
        return NextResponse.json(
          { error: mensajeDuplicado(existente), requiere_confirmacion: true, existente },
          { status: 409 },
        );
      }
    }

    // 1. Resolver variables y generar el PDF del auto.
    const vars = await resolverVariablesAuto(caseId, hearing_id ?? null);

    // Selección parcial de acreencias (igual que el POST de generación).
    const seleccionadas = (opciones as AutoSuspensionOpciones).acreenciasSeleccionadasIds;
    if (Array.isArray(seleccionadas) && seleccionadas.length > 0) {
      const set = new Set(seleccionadas);
      vars.acreedores = vars.acreedores.filter((a) => set.has(a.id));
    }

    const pdfBuffer = await generarAutoSuspensionPdf(vars, opciones as AutoSuspensionOpciones);
    const archivoHash = calcularHashSHA256(pdfBuffer);

    // 2. Determinar los firmantes (operador + insolvente/apoderado).
    const firmantesRaw: Array<{ nombre: string; cedula: string; email: string; orden: number }> = [];

    // (1) Operador (conciliador) — siempre firma.
    const op = vars.operador;
    firmantesRaw.push({
      nombre: op.nombre || "Operador de insolvencia",
      cedula: op.cedula ?? "",
      email: op.email ?? "",
      orden: 1,
    });

    // (2) Insolvente si asistió; si no asistió (o no hay registro), su apoderado.
    const d = vars.deudor;
    if (d.presente === true) {
      firmantesRaw.push({
        nombre: d.nombre || "Insolvente",
        cedula: d.documento ?? "",
        email: d.email ?? "",
        orden: 2,
      });
    } else if (d.apoderado) {
      firmantesRaw.push({
        nombre: d.apoderado.nombre || "Apoderado del insolvente",
        cedula: d.apoderado.cedula ?? "",
        email: d.apoderado.email ?? "",
        orden: 2,
      });
    } else {
      return NextResponse.json(
        {
          error:
            "El insolvente no asistió a la audiencia y no tiene apoderado activo registrado; no hay quién firme por la parte deudora.",
        },
        { status: 400 },
      );
    }

    // Validar que los firmantes tengan email.
    const firmantesValidos = firmantesRaw.filter((f) => f.email);
    if (firmantesValidos.length < firmantesRaw.length) {
      const sinEmail = firmantesRaw.filter((f) => !f.email).map((f) => f.nombre);
      return NextResponse.json(
        { error: `Faltan correos para firmar: ${sinEmail.join(", ")}. Complétalos en el expediente.` },
        { status: 400 },
      );
    }

    // 3. Subir el PDF al bucket de firmas (como PDF, para que el sellador lo abra).
    const docId = randomUUID();
    const storagePath = `firmas/${centerId}/${docId}.pdf`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("sgcc-documents")
      .upload(storagePath, pdfBuffer, { contentType: "application/pdf", upsert: true });
    if (uploadError) {
      return NextResponse.json(
        { error: `Error subiendo el PDF del auto: ${uploadError.message}` },
        { status: 500 },
      );
    }
    const { data: urlData } = supabaseAdmin.storage
      .from("sgcc-documents")
      .getPublicUrl(storagePath);
    const archivoUrl = urlData.publicUrl;

    // 4. Crear el documento de firma.
    const diasExpiracion = 30;
    const fechaExpiracion = new Date(
      Date.now() + diasExpiracion * 24 * 60 * 60 * 1000,
    ).toISOString();
    const nombreDoc = `Auto de Suspensión y Reprogramación — ${caso.numero_radicado}`;

    const { error: docError } = await supabaseAdmin.from("sgcc_firma_documentos").insert({
      id: docId,
      center_id: centerId,
      case_id: caseId,
      nombre: nombreDoc,
      descripcion: `Auto de suspensión del caso ${caso.numero_radicado}`,
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
    });
    if (docError) {
      return NextResponse.json({ error: docError.message }, { status: 500 });
    }

    // 5. Crear firmantes con tokens.
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

    // 6. Auditoría.
    await supabaseAdmin.from("sgcc_firma_registros").insert({
      firma_documento_id: docId,
      firmante_id: null,
      accion: "documento_creado",
      ip: req.headers.get("x-forwarded-for") || "unknown",
      user_agent: req.headers.get("user-agent") || "unknown",
      metadatos: {
        creado_por: userId,
        case_id: caseId,
        total_firmantes: firmantesValidos.length,
        origen: "auto_suspension",
      },
    });

    // Registrar el auto (consecutivo + Zoom heredable). Best-effort.
    const o = opciones as any;
    await supabaseAdmin.from("sgcc_autos").insert({
      center_id: centerId,
      case_id: caseId,
      tipo: "suspension",
      numero_auto: o.numero_auto ?? null,
      zoom_url: o.zoom_apertura_url ?? null,
      zoom_id: o.zoom_apertura_id ?? null,
      zoom_codigo: o.zoom_apertura_codigo ?? null,
      zoom_clave: o.zoom_apertura_clave ?? null,
    });

    return NextResponse.json(
      {
        success: true,
        firma_documento_id: docId,
        firmantes: firmantesData.length,
        mensaje: `Auto enviado a firma con ${firmantesData.length} firmante(s). Envía las notificaciones desde el módulo de firmas.`,
      },
      { status: 201 },
    );
  } catch (err: any) {
    console.error("[POST /autos/firma] error:", err);
    return NextResponse.json(
      { error: err.message || "Error interno del servidor" },
      { status: 500 },
    );
  }
}
