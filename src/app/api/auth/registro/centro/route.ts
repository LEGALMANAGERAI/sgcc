import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { centro, admin } = body;

    // ── Validaciones ──────────────────────────────────────────────────────
    if (!centro || !admin) {
      return NextResponse.json(
        { error: "Datos del centro y administrador son requeridos" },
        { status: 400 }
      );
    }

    const camposRequeridos: { campo: string; valor: unknown; label: string }[] = [
      { campo: "nombre", valor: centro.nombre, label: "Nombre del centro" },
      { campo: "nit", valor: centro.nit, label: "NIT" },
      { campo: "ciudad", valor: centro.ciudad, label: "Ciudad" },
      { campo: "resolucion_habilitacion", valor: centro.resolucion_habilitacion, label: "Resolución de habilitación" },
      { campo: "nombre", valor: admin.nombre, label: "Nombre del administrador" },
      { campo: "email", valor: admin.email, label: "Email del administrador" },
      { campo: "password", valor: admin.password, label: "Contraseña del administrador" },
    ];

    for (const { valor, label } of camposRequeridos) {
      if (!valor || (typeof valor === "string" && valor.trim() === "")) {
        return NextResponse.json(
          { error: `El campo "${label}" es requerido` },
          { status: 400 }
        );
      }
    }

    if (admin.password.length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 6 caracteres" },
        { status: 400 }
      );
    }

    // ── Verificar NIT duplicado ───────────────────────────────────────────
    const { data: centroExistente } = await supabaseAdmin
      .from("sgcc_centers")
      .select("id")
      .eq("nit", centro.nit.trim())
      .maybeSingle();

    if (centroExistente) {
      return NextResponse.json(
        { error: "Ya existe un centro registrado con este NIT" },
        { status: 409 }
      );
    }

    // ── Verificar email duplicado ─────────────────────────────────────────
    const { data: staffExistente } = await supabaseAdmin
      .from("sgcc_staff")
      .select("id")
      .eq("email", admin.email.trim().toLowerCase())
      .maybeSingle();

    if (staffExistente) {
      return NextResponse.json(
        { error: "Ya existe un usuario registrado con este email" },
        { status: 409 }
      );
    }

    // ── Hash de la contraseña ─────────────────────────────────────────────
    const passwordHash = await bcrypt.hash(admin.password, 10);

    // ── Insertar centro ───────────────────────────────────────────────────
    const centerId = randomUUID();

    const { error: centerError } = await supabaseAdmin
      .from("sgcc_centers")
      .insert({
        id: centerId,
        nombre: centro.nombre.trim(),
        nit: centro.nit.trim(),
        tipo: centro.tipo || "privado",
        rep_legal: centro.rep_legal?.trim() || null,
        resolucion_habilitacion: centro.resolucion_habilitacion.trim(),
        fecha_habilitacion: centro.fecha_habilitacion || null,
        direccion: centro.direccion?.trim() || null,
        ciudad: centro.ciudad.trim(),
        departamento: centro.departamento?.trim() || null,
        telefono: centro.telefono?.trim() || null,
        email_contacto: centro.email_contacto?.trim() || null,
        activo: true,
      });

    if (centerError) {
      console.error("Error al crear centro:", centerError);
      return NextResponse.json(
        { error: "Error al registrar el centro de conciliación" },
        { status: 500 }
      );
    }

    // ── Insertar usuario admin ────────────────────────────────────────────
    const { error: staffError } = await supabaseAdmin
      .from("sgcc_staff")
      .insert({
        id: randomUUID(),
        center_id: centerId,
        nombre: admin.nombre.trim(),
        email: admin.email.trim().toLowerCase(),
        password_hash: passwordHash,
        rol: "admin",
        activo: true,
      });

    if (staffError) {
      console.error("Error al crear admin:", staffError);
      // Rollback: eliminar el centro creado
      await supabaseAdmin.from("sgcc_centers").delete().eq("id", centerId);
      return NextResponse.json(
        { error: "Error al registrar el usuario administrador" },
        { status: 500 }
      );
    }

    // ── Crear checklists por defecto ──────────────────────────────────────
    const checklistsDefault = [
      {
        tipo_tramite: "conciliacion",
        tipo_checklist: "admision",
        nombre: "Admisión — Conciliación",
        items: [
          { nombre: "Solicitud firmada", requerido: true, descripcion: "Solicitud de conciliación con firma del convocante" },
          { nombre: "Copia documento de identidad convocante", requerido: true, descripcion: "CC, CE o pasaporte" },
          { nombre: "Poder (si aplica)", requerido: false, descripcion: "Poder especial o general del apoderado" },
          { nombre: "Pruebas documentales", requerido: false, descripcion: "Contratos, facturas, recibos, etc." },
          { nombre: "Certificado de existencia y representación legal", requerido: false, descripcion: "Solo si una parte es persona jurídica" },
        ],
      },
      {
        tipo_tramite: "insolvencia",
        tipo_checklist: "admision",
        nombre: "Admisión — Insolvencia Persona Natural",
        items: [
          { nombre: "Solicitud firmada", requerido: true, descripcion: "Solicitud de negociación de deudas" },
          { nombre: "Documento de identidad", requerido: true, descripcion: "CC, CE o pasaporte del deudor" },
          { nombre: "Relación completa de acreedores", requerido: true, descripcion: "Nombre, monto, dirección de cada acreedor" },
          { nombre: "Relación de bienes", requerido: true, descripcion: "Inventario de bienes del deudor" },
          { nombre: "Relación de ingresos y egresos", requerido: true, descripcion: "Certificado de ingresos o declaración juramentada" },
          { nombre: "Flujo de caja proyectado", requerido: true, descripcion: "Proyección a 5 años" },
          { nombre: "Propuesta de pago", requerido: true, descripcion: "Plan de pagos propuesto a los acreedores" },
          { nombre: "Certificado de no comerciante", requerido: false, descripcion: "Certificado de Cámara de Comercio o declaración" },
          { nombre: "Declaración de renta (si aplica)", requerido: false, descripcion: "Últimos 2 años" },
          { nombre: "Poder del apoderado", requerido: false, descripcion: "Si actúa mediante apoderado" },
        ],
      },
      {
        tipo_tramite: "acuerdo_apoyo",
        tipo_checklist: "admision",
        nombre: "Admisión — Acuerdo de Apoyo",
        items: [
          { nombre: "Solicitud firmada", requerido: true, descripcion: "Solicitud de acuerdo de apoyo" },
          { nombre: "Documento de identidad del titular", requerido: true, descripcion: "Persona con discapacidad" },
          { nombre: "Documento de identidad persona de apoyo", requerido: true, descripcion: "Persona propuesta como apoyo" },
          { nombre: "Valoración de apoyos", requerido: true, descripcion: "Valoración funcional o concepto médico" },
          { nombre: "Certificado de discapacidad", requerido: false, descripcion: "Si está disponible" },
          { nombre: "Descripción de actos jurídicos", requerido: true, descripcion: "Actos para los que se requiere apoyo" },
        ],
      },
      {
        tipo_tramite: "conciliacion",
        tipo_checklist: "poderes",
        nombre: "Poderes — Conciliación",
        items: [
          { nombre: "Poder especial o general", requerido: true, descripcion: "Poder otorgado al apoderado" },
          { nombre: "Tarjeta profesional vigente", requerido: true, descripcion: "Verificar en SIRNA o copia" },
          { nombre: "Certificado de existencia y representación legal", requerido: false, descripcion: "Si la parte es persona jurídica" },
        ],
      },
      {
        tipo_tramite: "insolvencia",
        tipo_checklist: "poderes",
        nombre: "Poderes — Insolvencia",
        items: [
          { nombre: "Poder especial o general", requerido: true, descripcion: "Poder otorgado al apoderado" },
          { nombre: "Tarjeta profesional vigente", requerido: true, descripcion: "Verificar en SIRNA o copia" },
          { nombre: "Certificado de existencia y representación legal", requerido: true, descripcion: "Para cada acreedor persona jurídica" },
          { nombre: "Acreditación de la calidad de acreedor", requerido: true, descripcion: "Documento que pruebe la acreencia" },
        ],
      },
      {
        tipo_tramite: "acuerdo_apoyo",
        tipo_checklist: "poderes",
        nombre: "Poderes — Acuerdo de Apoyo",
        items: [
          { nombre: "Poder especial o general", requerido: true, descripcion: "Si aplica" },
          { nombre: "Tarjeta profesional vigente", requerido: true, descripcion: "Si actúa con apoderado" },
        ],
      },
    ];

    const checklistRows = checklistsDefault.map((cl) => ({
      id: randomUUID(),
      center_id: centerId,
      tipo_tramite: cl.tipo_tramite,
      tipo_checklist: cl.tipo_checklist,
      nombre: cl.nombre,
      items: JSON.stringify(cl.items),
    }));

    const { error: checklistError } = await supabaseAdmin
      .from("sgcc_checklists")
      .insert(checklistRows);

    if (checklistError) {
      console.error("Error al crear checklists:", checklistError);
      // No hacemos rollback completo, las checklists se pueden crear después
    }

    // ── Respuesta exitosa ─────────────────────────────────────────────────
    return NextResponse.json(
      { success: true, centerId },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error en registro de centro:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
