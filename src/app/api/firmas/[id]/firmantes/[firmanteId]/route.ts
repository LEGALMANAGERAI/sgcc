import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { lmConfigured, lmEditarFirmante, LmApiError, type LmCanal } from "@/lib/firma/lm-client";

type Params = { params: Promise<{ id: string; firmanteId: string }> };

const CANALES = ["email", "whatsapp", "sms"] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Body = { email?: string; telefono?: string; canales?: LmCanal[]; reenviar?: boolean };

function parseBody(raw: any): Body | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "Cuerpo inválido" };
  const out: Body = {};
  if (raw.email !== undefined) {
    const e = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
    if (!EMAIL_RE.test(e) || e.length > 254) return { error: "Correo inválido" };
    out.email = e;
  }
  if (raw.telefono !== undefined) {
    const t = typeof raw.telefono === "string" ? raw.telefono.trim() : "";
    if (!t || t.length > 30) return { error: "Teléfono inválido" };
    out.telefono = t;
  }
  if (raw.canales !== undefined) {
    if (!Array.isArray(raw.canales) || !raw.canales.length || !raw.canales.every((c: any) => CANALES.includes(c))) {
      return { error: "Canales inválidos (email, whatsapp, sms)" };
    }
    out.canales = [...new Set<LmCanal>(raw.canales)];
  }
  if (raw.reenviar !== undefined) {
    if (typeof raw.reenviar !== "boolean") return { error: "reenviar debe ser booleano" };
    out.reenviar = raw.reenviar;
  }
  if (out.email === undefined && out.telefono === undefined && out.canales === undefined) {
    return { error: "Indique al menos un cambio (email, teléfono o canales)" };
  }
  return out;
}

/**
 * PATCH /api/firmas/[id]/firmantes/[firmanteId]
 * Edita correo, teléfono y/o canales de un firmante de una firma de Legal Manager.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id, firmanteId } = await params;
  const userId = (session.user as any)?.id;

  const parsed = parseBody(await req.json().catch(() => null));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 422 });
  const { email, telefono, canales, reenviar } = parsed;

  // Anti-IDOR: documento del centro y firmante dentro de ese documento.
  const { data: documento } = await supabaseAdmin
    .from("sgcc_firma_documentos")
    .select("id, proveedor, lm_solicitud_id, estado")
    .eq("id", id)
    .eq("center_id", centerId)
    .single();
  if (!documento) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });

  const { data: firmante } = await supabaseAdmin
    .from("sgcc_firmantes")
    .select("id, email, telefono, canal_notificacion, lm_firmante_id")
    .eq("id", firmanteId)
    .eq("firma_documento_id", id)
    .single();
  if (!firmante) return NextResponse.json({ error: "Firmante no encontrado" }, { status: 404 });

  // Documento aún no enviado: edición solo local.
  if (documento.estado === "pendiente" && !documento.lm_solicitud_id) {
    const telFinal = telefono ?? firmante.telefono;
    const canalesFinal = canales ?? String(firmante.canal_notificacion ?? "email").split(",");
    if (canalesFinal.includes("whatsapp") && String(telFinal ?? "").replace(/\D/g, "").length < 10) {
      return NextResponse.json(
        { error: "WhatsApp requiere un celular válido (mínimo 10 dígitos)" },
        { status: 422 },
      );
    }
    const nuevo = {
      email: email ?? firmante.email,
      telefono: telFinal,
      canal_notificacion: canales ? canales.join(",") : firmante.canal_notificacion,
    };
    const { error: updErr } = await supabaseAdmin.from("sgcc_firmantes").update(nuevo).eq("id", firmanteId);
    if (updErr) {
      console.error("Error actualizando firmante local:", updErr.message);
      return NextResponse.json({ error: "No se pudo guardar el cambio" }, { status: 500 });
    }
    await supabaseAdmin.from("sgcc_firma_registros").insert({
      id: randomUUID(),
      firma_documento_id: id,
      firmante_id: firmanteId,
      accion: "contacto_actualizado",
      ip: req.headers.get("x-forwarded-for") || "unknown",
      user_agent: req.headers.get("user-agent") || "unknown",
      metadatos: {
        local: true,
        actualizado_por: userId,
        antes: { email: firmante.email, telefono: firmante.telefono, canal: firmante.canal_notificacion },
        despues: { email: nuevo.email, telefono: nuevo.telefono, canal: nuevo.canal_notificacion },
      },
      created_at: new Date().toISOString(),
    });
    return NextResponse.json({
      ok: true,
      firmante: { id: firmanteId, ...nuevo },
      reenvio: null,
      reenvio_omitido: "El documento aún no se ha enviado",
    });
  }

  if (documento.proveedor !== "lm" || !documento.lm_solicitud_id || !firmante.lm_firmante_id) {
    return NextResponse.json({ error: "Solo disponible para firmas de Legal Manager" }, { status: 400 });
  }

  if (canales?.some((c) => c !== "email") && !(telefono ?? firmante.telefono)) {
    return NextResponse.json(
      { error: "Para usar WhatsApp o SMS se requiere un número de teléfono" },
      { status: 422 },
    );
  }

  if (!lmConfigured()) {
    return NextResponse.json(
      { error: "La firma con Legal Manager no está configurada (faltan credenciales del partner)." },
      { status: 502 },
    );
  }

  let r: Awaited<ReturnType<typeof lmEditarFirmante>>;
  try {
    r = await lmEditarFirmante(documento.lm_solicitud_id, firmante.lm_firmante_id, {
      ...(email !== undefined ? { email } : {}),
      ...(telefono !== undefined ? { telefono } : {}),
      ...(canales ? { canales } : {}),
      ...(reenviar !== undefined ? { reenviar } : {}),
    });
  } catch (err: any) {
    if (err instanceof LmApiError) {
      if (err.status === 422) {
        return NextResponse.json({ error: err.message || "Datos inválidos" }, { status: 422 });
      }
      if (err.status === 409) {
        return NextResponse.json(
          { error: "El firmante ya firmó o rechazó, o el documento está cerrado" },
          { status: 409 },
        );
      }
      if (err.status === 404) {
        return NextResponse.json({ error: "Firmante no encontrado en Legal Manager" }, { status: 404 });
      }
    }
    console.error("Error editando firmante en Legal Manager:", err?.message);
    return NextResponse.json(
      { error: `No se pudo editar el firmante en Legal Manager: ${err?.message ?? "error desconocido"}` },
      { status: 502 },
    );
  }

  const nuevo = {
    email: r.email ?? email ?? firmante.email,
    telefono: r.telefono ?? telefono ?? firmante.telefono,
    canal_notificacion: r.canales?.length ? r.canales.join(",") : canales ? canales.join(",") : firmante.canal_notificacion,
  };

  // sgcc_firmantes NO tiene updated_at.
  const { error: updErr } = await supabaseAdmin.from("sgcc_firmantes").update(nuevo).eq("id", firmanteId);
  if (updErr) {
    console.error("Error actualizando firmante local:", updErr.message);
    return NextResponse.json(
      { error: "Se actualizó en Legal Manager pero falló el guardado local. Use Sincronizar." },
      { status: 500 },
    );
  }

  await supabaseAdmin.from("sgcc_firma_registros").insert({
    id: randomUUID(),
    firma_documento_id: id,
    firmante_id: firmanteId,
    accion: "contacto_actualizado",
    ip: req.headers.get("x-forwarded-for") || "unknown",
    user_agent: req.headers.get("user-agent") || "unknown",
    metadatos: {
      proveedor: "lm",
      actualizado_por: userId,
      antes: { email: firmante.email, telefono: firmante.telefono, canal: firmante.canal_notificacion },
      despues: { email: nuevo.email, telefono: nuevo.telefono, canal: nuevo.canal_notificacion },
      reenvio: r.reenvio ?? null,
    },
    created_at: new Date().toISOString(),
  });

  return NextResponse.json({
    ok: true,
    firmante: { id: firmanteId, ...nuevo },
    reenvio: r.reenvio ?? null,
    reenvio_omitido: r.reenvio_omitido ?? null,
  });
}
