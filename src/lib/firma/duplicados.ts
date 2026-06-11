import { supabaseAdmin } from "@/lib/supabase";

/**
 * Devuelve el documento de firma ACTIVO más reciente de un caso, o null.
 * "Activo" = aún en curso (pendiente / enviado / en_proceso). Los terminales
 * (completado / rechazado / expirado / cancelado) NO cuentan como duplicado.
 *
 * Se usa para avisar antes de crear un segundo documento de firma del mismo
 * caso (causa de la solicitud duplicada del acta C-0008-2026: se mandó a firma
 * dos veces y LM, que deduplica por hash del PDF, creó dos solicitudes).
 */
export async function firmaActivaDelCaso(caseId: string, centerId: string) {
  const { data } = await supabaseAdmin
    .from("sgcc_firma_documentos")
    .select("id, nombre, estado, total_firmantes, firmantes_completados")
    .eq("case_id", caseId)
    .eq("center_id", centerId)
    .in("estado", ["pendiente", "enviado", "en_proceso"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

/** Mensaje estándar para el aviso de duplicado (se muestra en un confirm()). */
export function mensajeDuplicado(existente: {
  nombre: string;
  estado: string;
  firmantes_completados: number;
  total_firmantes: number;
}) {
  return (
    `Ya existe un documento de firma activo para este caso: "${existente.nombre}" ` +
    `(estado: ${existente.estado}, ${existente.firmantes_completados}/${existente.total_firmantes} firmado). ` +
    `Crear otro generará una solicitud duplicada en Legal Manager y los firmantes podrían firmar el documento equivocado. ` +
    `¿Crear otro de todas formas?`
  );
}
