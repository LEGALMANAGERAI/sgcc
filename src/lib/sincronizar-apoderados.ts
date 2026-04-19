import { supabaseAdmin } from "@/lib/supabase";
import { randomUUID } from "crypto";

/**
 * Sincroniza apoderados capturados como texto en sgcc_case_parties
 * (campos apoderado_nombre / apoderado_doc) hacia la estructura relacional
 * sgcc_attorneys + sgcc_case_attorneys usada por el flujo de actas y firmas.
 *
 * Se llama de forma idempotente: si ya hay un sgcc_case_attorneys.activo para
 * la parte, no hace nada. Si no, crea o reutiliza el attorney (match por
 * tarjeta_profesional) y crea el case_attorney con motivo_cambio='inicial'.
 *
 * Retorna el número de registros creados.
 */
export async function sincronizarApoderadosDePartes(
  caseId: string,
  staffId?: string | null
): Promise<number> {
  // 1. Partes con apoderado capturado como texto
  const { data: partes } = await supabaseAdmin
    .from("sgcc_case_parties")
    .select("party_id, apoderado_nombre, apoderado_doc")
    .eq("case_id", caseId);

  if (!partes || partes.length === 0) return 0;

  const partesConApoderado = partes.filter(
    (p) => p.apoderado_nombre && p.apoderado_nombre.trim().length > 0
  );
  if (partesConApoderado.length === 0) return 0;

  // 2. Apoderados ya registrados en sgcc_case_attorneys (activos)
  const { data: yaRegistrados } = await supabaseAdmin
    .from("sgcc_case_attorneys")
    .select("party_id")
    .eq("case_id", caseId)
    .eq("activo", true);

  const partyIdsYaRegistrados = new Set(
    (yaRegistrados ?? []).map((r) => r.party_id)
  );

  const pendientes = partesConApoderado.filter(
    (p) => !partyIdsYaRegistrados.has(p.party_id)
  );
  if (pendientes.length === 0) return 0;

  let creados = 0;

  for (const p of pendientes) {
    const nombre = (p.apoderado_nombre ?? "").trim();
    const tp = (p.apoderado_doc ?? "").trim() || null;

    // 3. Buscar attorney existente (prioridad: tarjeta_profesional)
    let attorneyId: string | null = null;
    if (tp) {
      const { data: match } = await supabaseAdmin
        .from("sgcc_attorneys")
        .select("id")
        .eq("tarjeta_profesional", tp)
        .maybeSingle();
      if (match) attorneyId = match.id;
    }
    if (!attorneyId) {
      // buscar por nombre exacto como fallback (menos confiable)
      const { data: porNombre } = await supabaseAdmin
        .from("sgcc_attorneys")
        .select("id")
        .eq("nombre", nombre)
        .limit(1)
        .maybeSingle();
      if (porNombre) attorneyId = porNombre.id;
    }

    // 4. Crear attorney si no existe
    if (!attorneyId) {
      const nuevoAttorneyId = randomUUID();
      // numero_doc es UNIQUE y NOT NULL. Usamos un placeholder estable:
      // si hay TP, usamos "TP-<tp>"; si no, "SYNC-<uuid>"
      const numeroDocPlaceholder = tp ? `TP-${tp}` : `SYNC-${nuevoAttorneyId.slice(0, 8)}`;

      const { error: insError } = await supabaseAdmin
        .from("sgcc_attorneys")
        .insert({
          id: nuevoAttorneyId,
          nombre,
          tipo_doc: "otro",
          numero_doc: numeroDocPlaceholder,
          tarjeta_profesional: tp,
          verificado: false,
          activo: true,
        });

      if (insError) {
        // Puede fallar por colisión de numero_doc; intentar buscar por placeholder
        const { data: yaCreado } = await supabaseAdmin
          .from("sgcc_attorneys")
          .select("id")
          .eq("numero_doc", numeroDocPlaceholder)
          .maybeSingle();
        if (yaCreado) attorneyId = yaCreado.id;
        else continue; // skip si no pudimos crear
      } else {
        attorneyId = nuevoAttorneyId;
      }
    }

    // 5. Crear registro en sgcc_case_attorneys
    const { error: caError } = await supabaseAdmin
      .from("sgcc_case_attorneys")
      .insert({
        id: randomUUID(),
        case_id: caseId,
        party_id: p.party_id,
        attorney_id: attorneyId,
        motivo_cambio: "inicial",
        registrado_por: staffId ?? null,
        activo: true,
      });

    if (!caError) creados++;
  }

  return creados;
}
