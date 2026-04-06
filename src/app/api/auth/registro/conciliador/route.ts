import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nombre, email, tarjeta_profesional, telefono, ciudad, center_code, password } = body;

    // ── Validaciones ──────────────────────────────────────────────────────
    const camposRequeridos: { valor: unknown; label: string }[] = [
      { valor: nombre, label: "Nombre" },
      { valor: email, label: "Email" },
      { valor: center_code, label: "Código del centro" },
      { valor: password, label: "Contraseña" },
    ];

    for (const { valor, label } of camposRequeridos) {
      if (!valor || (typeof valor === "string" && valor.trim() === "")) {
        return NextResponse.json(
          { error: `El campo "${label}" es requerido` },
          { status: 400 }
        );
      }
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 6 caracteres" },
        { status: 400 }
      );
    }

    // ── Buscar centro por código (UUID) ───────────────────────────────────
    const { data: centro, error: centerError } = await supabaseAdmin
      .from("sgcc_centers")
      .select("id, activo")
      .eq("id", center_code.trim())
      .maybeSingle();

    if (centerError || !centro) {
      return NextResponse.json(
        { error: "Centro no encontrado o inactivo" },
        { status: 404 }
      );
    }

    if (!centro.activo) {
      return NextResponse.json(
        { error: "Centro no encontrado o inactivo" },
        { status: 404 }
      );
    }

    // ── Verificar email duplicado en el centro ────────────────────────────
    const { data: staffExistente } = await supabaseAdmin
      .from("sgcc_staff")
      .select("id")
      .eq("email", email.trim().toLowerCase())
      .eq("center_id", centro.id)
      .maybeSingle();

    if (staffExistente) {
      return NextResponse.json(
        { error: "Ya existe un conciliador registrado con este email en este centro" },
        { status: 409 }
      );
    }

    // ── Hash de la contraseña ─────────────────────────────────────────────
    const passwordHash = await bcrypt.hash(password, 10);

    // ── Insertar conciliador ──────────────────────────────────────────────
    const { error: insertError } = await supabaseAdmin
      .from("sgcc_staff")
      .insert({
        id: randomUUID(),
        center_id: centro.id,
        nombre: nombre.trim(),
        email: email.trim().toLowerCase(),
        password_hash: passwordHash,
        rol: "conciliador",
        tarjeta_profesional: tarjeta_profesional?.trim() || null,
        telefono: telefono?.trim() || null,
        activo: true,
      });

    if (insertError) {
      console.error("Error al registrar conciliador:", insertError);
      return NextResponse.json(
        { error: "Error al registrar el conciliador" },
        { status: 500 }
      );
    }

    // ── Respuesta exitosa ─────────────────────────────────────────────────
    return NextResponse.json(
      { success: true },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error en registro de conciliador:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
