// scripts/migrar-logos-sgcc-public.mjs
// Uso único, DESPUÉS de correr la migración 052:
//   node scripts/migrar-logos-sgcc-public.mjs          (simulación)
//   node scripts/migrar-logos-sgcc-public.mjs --apply  (ejecuta)
//
// Por cada centro cuyo logo_url apunte a sgcc-documents: copia el archivo al
// bucket público sgcc-public (mismo path) y reescribe logo_url. NO borra el
// original. Idempotente.
import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf8");
const get = (k) => (env.match(new RegExp("^" + k + "=(.*)$", "m")) || [])[1]?.trim().replace(/^["']|["']$/g, "");
const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

const APPLY = process.argv.includes("--apply");
const MARCADOR = "/sgcc-documents/";

const { data: centros, error } = await sb
  .from("sgcc_centers")
  .select("id, nombre, logo_url")
  .like("logo_url", `%${MARCADOR}%`);
if (error) { console.error("ERROR:", error.message); process.exit(1); }

console.log(`${centros.length} centro(s) con logo en sgcc-documents. Modo: ${APPLY ? "APLICAR" : "SIMULACIÓN"}`);
let ok = 0, fallos = 0;
for (const c of centros) {
  const path = decodeURIComponent(c.logo_url.split(MARCADOR)[1].split(/[?#]/)[0]);
  const tag = `${c.nombre} → ${path}`;
  if (!APPLY) { console.log("  copiaría", tag); continue; }

  const { data: blob, error: dErr } = await sb.storage.from("sgcc-documents").download(path);
  if (dErr || !blob) { console.log("  ✗ no se pudo descargar", tag, dErr?.message); fallos++; continue; }

  const { error: uErr } = await sb.storage.from("sgcc-public")
    .upload(path, blob, { contentType: blob.type || undefined, upsert: true });
  if (uErr) { console.log("  ✗ no se pudo subir", tag, uErr.message); fallos++; continue; }

  const nueva = sb.storage.from("sgcc-public").getPublicUrl(path).data.publicUrl;
  const { error: rErr } = await sb.from("sgcc_centers").update({ logo_url: nueva }).eq("id", c.id);
  if (rErr) { console.log("  ✗ copiado pero sin actualizar logo_url", tag, rErr.message); fallos++; continue; }

  const r = await fetch(nueva);
  console.log(`  ${r.ok ? "✓" : "⚠ no abre (" + r.status + ")"} ${tag}`);
  r.ok ? ok++ : fallos++;
}
if (APPLY) console.log(`Listo: ${ok} migrados, ${fallos} con error.`);
