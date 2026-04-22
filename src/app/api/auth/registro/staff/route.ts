import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

const ROLES_PERMITIDOS = ["conciliador", "secretario"] as const;
type RolPermitido = (typeof ROLES_PERMITIDOS)[number];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      nombre,
      email,
      rol,
      tarjeta_profesional,
      telefono,
      codigo_centro,
      password,
    } = body;

    // ── Validaciones ──────────────────────────────────────────────────────
    const camposRequeridos: { valor: unknown; label: string }[] = [
      { valor: nombre, label: "Nombre" },
      { valor: email, label: "Email" },
      { valor: codigo_centro, label: "Código del centro" },
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

    if (!ROLES_PERMITIDOS.includes(rol as RolPermitido)) {
      return NextResponse.json(
        {
          error:
            "Rol inválido. El auto-registro solo permite conciliador o funcionario. Los administradores deben ser invitados desde el centro.",
        },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 6 caracteres" },
        { status: 400 }
      );
    }

    // ── Buscar centro por código corto o UUID ─────────────────────────────
    const code = codigo_centro.trim();
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code);

    const { data: centro, error: centerError } = await supabaseAdmin
      .from("sgcc_centers")
      .select("id, activo")
      .eq(isUUID ? "id" : "codigo_corto", isUUID ? code : code.toUpperCase())
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
        { error: "Ya existe un usuario registrado con este email en este centro" },
        { status: 409 }
      );
    }

    // ── Hash de la contraseña ─────────────────────────────────────────────
    const passwordHash = await bcrypt.hash(password, 10);

    // ── Insertar staff ────────────────────────────────────────────────────
    const { error: insertError } = await supabaseAdmin
      .from("sgcc_staff")
      .insert({
        id: randomUUID(),
        center_id: centro.id,
        nombre: nombre.trim(),
        email: email.trim().toLowerCase(),
        password_hash: passwordHash,
        rol,
        tarjeta_profesional:
          rol === "conciliador" ? tarjeta_profesional?.trim() || null : null,
        telefono: telefono?.trim() || null,
        activo: true,
      });

    if (insertError) {
      console.error("Error al registrar staff:", insertError);
      return NextResponse.json(
        { error: "Error al registrar el usuario" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Error en registro de staff:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
