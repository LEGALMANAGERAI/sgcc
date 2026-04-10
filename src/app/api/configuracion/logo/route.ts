import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin, uploadFile, deleteFile } from "@/lib/supabase";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

/**
 * POST /api/configuracion/logo
 * Subir logo del centro (solo admin).
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.sgccRol !== "admin") {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  }

  const centerId = user.centerId as string;
  const formData = await req.formData();
  const file = formData.get("logo") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Archivo de logo requerido" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Formato no permitido. Use JPG, PNG, WebP o SVG" },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "El logo no debe exceder 2MB" },
      { status: 400 }
    );
  }

  try {
    // Obtener logo anterior para eliminarlo
    const { data: center } = await supabaseAdmin
      .from("sgcc_centers")
      .select("logo_url")
      .eq("id", centerId)
      .single();

    // Subir nuevo logo
    const ext = file.name.split(".").pop() ?? "png";
    const storagePath = `sgcc/${centerId}/branding/logo.${ext}`;
    const url = await uploadFile(file, "documentos", storagePath, file.type);

    // Actualizar URL en el centro
    const { error: updateError } = await supabaseAdmin
      .from("sgcc_centers")
      .update({ logo_url: url, updated_at: new Date().toISOString() })
      .eq("id", centerId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ logo_url: url });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Error al subir logo: ${err.message}` },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/configuracion/logo
 * Eliminar logo del centro.
 */
export async function DELETE() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.sgccRol !== "admin") {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  }

  const centerId = user.centerId as string;

  const { error } = await supabaseAdmin
    .from("sgcc_centers")
    .update({ logo_url: null, updated_at: new Date().toISOString() })
    .eq("id", centerId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
