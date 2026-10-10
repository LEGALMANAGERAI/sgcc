// scripts/migrar-adjuntos-tickets-privados.mjs
// Uso único, DESPUÉS de correr la migración 050 y desplegar el código:
//   node scripts/migrar-adjuntos-tickets-privados.mjs          (simulación)
//   node scripts/migrar-adjuntos-tickets-privados.mjs --apply  (ejecuta)
//
// Por cada fila de sgcc_ticket_adjuntos cuya url aún sea pública:
//   copia el archivo sgcc-documents → sgcc-tickets (mismo path) y reescribe
//   url = /api/tickets/adjuntos/<id>.
// NO borra nada del bucket público: los originales se limpian aparte, con
// aprobación. Idempotente: se puede volver a correr.
import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf8");
const get = (k) => (env.match(new RegExp("^" + k + "=(.*)$", "m")) || [])[1]?.trim().replace(/^["']|["']$/g, "");
const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

const APPLY = process.argv.includes("--apply");
const ORIGEN = "sgcc-documents";
const DESTINO = "sgcc-tickets";

const { data: filas, error } = await sb
  .from("sgcc_ticket_adjuntos")
  .select("id, storage_path, url, mime_type")
  .not("url", "like", "/api/%");
if (error) { console.error("ERROR leyendo adjuntos:", error.message); process.exit(1); }

console.log(`${filas.length} adjunto(s) con URL pública. Modo: ${APPLY ? "APLICAR" : "SIMULACIÓN"}`);
let ok = 0, fallos = 0;
for (const f of filas) {
  const tag = `${f.id} ${f.storage_path}`;
  if (!APPLY) { console.log("  copiaría", tag); continue; }

  const { data: blob, error: dErr } = await sb.storage.from(ORIGEN).download(f.storage_path);
  if (dErr || !blob) { console.log("  ✗ no se pudo descargar", tag, dErr?.message); fallos++; continue; }

  const { error: uErr } = await sb.storage.from(DESTINO)
    .upload(f.storage_path, blob, { contentType: f.mime_type ?? blob.type, upsert: true });
  if (uErr) { console.log("  ✗ no se pudo subir", tag, uErr.message); fallos++; continue; }

  const { error: rErr } = await sb.from("sgcc_ticket_adjuntos")
    .update({ url: `/api/tickets/adjuntos/${f.id}` }).eq("id", f.id);
  if (rErr) { console.log("  ✗ copiado pero sin actualizar url", tag, rErr.message); fallos++; continue; }

  console.log("  ✓", tag); ok++;
}
if (APPLY) console.log(`Listo: ${ok} migrados, ${fallos} con error.`);
