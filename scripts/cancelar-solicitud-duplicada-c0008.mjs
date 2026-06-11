// ============================================================
// Limpieza operativa: cancelar la solicitud de firma DUPLICADA del acta
// "ACTA DE ACUERDO CONCILIATORIO C-0008-2026" en SIGECC.
//
// Contexto (diagnóstico legados 2026-06-10): se crearon DOS documentos de firma
// del mismo acta con PDFs distintos. El BUENO ya está 9/9 (external_solicitud_id
// 499a99c3-f591-4888-8d92-ce7e2500fae8). El DUPLICADO quedó 2/9 (Flor Omaira y
// Helí firmaron ahí por error) y hay que cancelarlo para que no confunda.
//
// El target es el external_solicitud_id (= sgcc_firma_documentos.id). Por
// robustez también se busca por lm_solicitud_id.
//
// Uso:
//   node scripts/cancelar-solicitud-duplicada-c0008.mjs           (dry-run: solo muestra)
//   node scripts/cancelar-solicitud-duplicada-c0008.mjs --apply   (cancela de verdad)
// ============================================================

import { readFileSync } from "fs";
import { randomUUID } from "crypto";

const TARGET = "5c09a74d-6af5-4fdc-98fa-c7369ebea74a";
const APPLY = process.argv.includes("--apply");

// Lee credenciales de .env.local (mismo patrón que los otros scripts del repo).
const env = readFileSync(".env.local", "utf8");
const get = (k) => (env.match(new RegExp("^" + k + "=(.*)$", "m")) || [])[1]?.trim().replace(/^["']|["']$/g, "");

const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

// 1) Localizar el documento duplicado por id O lm_solicitud_id.
const { data: docs, error: selErr } = await sb
  .from("sgcc_firma_documentos")
  .select("id, nombre, estado, proveedor, lm_solicitud_id, total_firmantes, firmantes_completados, center_id")
  .or(`id.eq.${TARGET},lm_solicitud_id.eq.${TARGET}`);

if (selErr) {
  console.error("SELECT error:", selErr.message);
  process.exit(1);
}
if (!docs || docs.length === 0) {
  console.error(`No se encontró ningún documento con id/lm_solicitud_id = ${TARGET}`);
  process.exit(1);
}
if (docs.length > 1) {
  console.error("Se encontró más de un documento — abortando por seguridad:", docs.map((d) => d.id));
  process.exit(1);
}

const doc = docs[0];
console.log("Documento encontrado:");
console.log("  id:               ", doc.id);
console.log("  nombre:           ", doc.nombre);
console.log("  estado:           ", doc.estado);
console.log("  proveedor:        ", doc.proveedor);
console.log("  lm_solicitud_id:  ", doc.lm_solicitud_id);
console.log("  firmantes:        ", `${doc.firmantes_completados}/${doc.total_firmantes}`);

// 2) Mostrar firmantes para confirmar que es el duplicado correcto (2/9: Omaira y Helí).
const { data: firmantes } = await sb
  .from("sgcc_firmantes")
  .select("nombre, cedula, estado")
  .eq("firma_documento_id", doc.id)
  .order("orden", { ascending: true });
console.log("  firmantes detalle:");
for (const f of firmantes || []) {
  console.log(`    - ${f.nombre} (${f.cedula}) → ${f.estado}`);
}

if (["cancelado", "completado"].includes(doc.estado)) {
  console.log(`\nEl documento ya está en estado "${doc.estado}" — no se hace nada (idempotente).`);
  process.exit(0);
}

if (!APPLY) {
  console.log("\n[DRY-RUN] No se cambió nada. Revisa que sea el duplicado correcto (2/9, Omaira + Helí) y vuelve a correr con --apply.");
  process.exit(0);
}

// 3) Cancelar el documento + firmantes aún abiertos + auditoría.
const now = new Date().toISOString();

const { error: docErr } = await sb
  .from("sgcc_firma_documentos")
  .update({ estado: "cancelado", updated_at: now })
  .eq("id", doc.id);
if (docErr) {
  console.error("UPDATE documento FALLÓ:", docErr.message);
  process.exit(1);
}

// OJO: sgcc_firmantes NO tiene columna updated_at.
const { error: firmErr } = await sb
  .from("sgcc_firmantes")
  .update({ estado: "cancelado" })
  .eq("firma_documento_id", doc.id)
  .in("estado", ["pendiente", "enviado", "visto"]);
if (firmErr) console.error("Aviso: no se pudieron cancelar firmantes:", firmErr.message);

await sb.from("sgcc_firma_registros").insert({
  id: randomUUID(),
  firma_documento_id: doc.id,
  firmante_id: null,
  accion: "cancelado",
  metadatos: {
    motivo: "Solicitud de firma DUPLICADA del acta C-0008-2026 (el documento bueno está 9/9 en external_solicitud_id 499a99c3-f591-4888-8d92-ce7e2500fae8). Limpieza operativa 2026-06-10.",
    via: "script_limpieza",
  },
  created_at: now,
});

console.log("\n✓ Documento duplicado CANCELADO y auditado.");
