import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * El motor de firma propio de SIGECC está congelado: los documentos con
 * proveedor 'lm' se firman solo en Legal Manager. Las rutas POST del motor
 * propio (firmar, otp, verificar, rechazar) llaman esto antes de actuar para
 * que nadie firme un documento LM por la vía vieja usando el token local.
 *
 * @returns respuesta 409 si el documento es de LM (o no se pudo leer), o null si puede seguir.
 */
export async function rechazarSiEsDeLm(firmaDocumentoId: string | null | undefined) {
  if (!firmaDocumentoId) return null; // el propio handler ya responde por token inválido
  const { data, error } = await supabaseAdmin
    .from("sgcc_firma_documentos")
    .select("proveedor")
    .eq("id", firmaDocumentoId)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: "No se pudo verificar el documento." }, { status: 500 });
  }
  if (data?.proveedor === "lm") {
    return NextResponse.json(
      { error: "Este documento se firma en Legal Manager. Use el enlace que recibió de Legal Manager." },
      { status: 409 },
    );
  }
  return null;
}
