import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    const userType = (session.user as any)?.userType;
    if (userType !== "party") {
      return NextResponse.json(
        { error: "Acceso denegado" },
        { status: 403 }
      );
    }

    const userId = (session.user as any).id as string;

    const { data: party, error } = await supabaseAdmin
      .from("sgcc_parties")
      .select(
        "id, tipo_persona, nombres, apellidos, tipo_doc, numero_doc, razon_social, nit_empresa, email, telefono, direccion, ciudad"
      )
      .eq("id", userId)
      .single();

    if (error || !party) {
      return NextResponse.json(
        { error: "No se encontró el perfil" },
        { status: 404 }
      );
    }

    return NextResponse.json(party);
  } catch (err) {
    console.error("Error en GET perfil:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    const userType = (session.user as any)?.userType;
    if (userType !== "party") {
      return NextResponse.json(
        { error: "Acceso denegado" },
        { status: 403 }
      );
    }

    const userId = (session.user as any).id as string;
    const body = await req.json();

    // Solo permitir campos autorizados
    const camposPermitidos = ["nombres", "apellidos", "telefono", "direccion", "ciudad"];
    const update: Record<string, string | null> = {};

    for (const campo of camposPermitidos) {
      if (campo in body) {
        const valor = body[campo];
        update[campo] = typeof valor === "string" && valor.trim() !== "" ? valor.trim() : null;
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: "No se proporcionaron campos válidos para actualizar" },
        { status: 400 }
      );
    }

    update.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("sgcc_parties")
      .update(update)
      .eq("id", userId)
      .select(
        "id, tipo_persona, nombres, apellidos, tipo_doc, numero_doc, razon_social, nit_empresa, email, telefono, direccion, ciudad"
      )
      .single();

    if (error) {
      console.error("Error actualizando perfil:", error);
      return NextResponse.json(
        { error: "Error al actualizar el perfil" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Error en PATCH perfil:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
