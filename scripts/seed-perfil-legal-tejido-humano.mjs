// ============================================================
// Seed del perfil legal del centro "Tejido Humano" para el motor de autos
// de insolvencia (SIGECC).
//
// Rellena las columnas legales del centro (resolución de insolvencia, código
// MinJusticia, correos de radicación/secretaría, pie de vigilado, etc.) y los
// datos de los conciliadores (cédula, ciudad de expedición, tarjeta profesional,
// código de inscripción) con los valores REALES del centro.
//
// Respeta los valores ya existentes que NO estén vacíos: los campos marcados
// "solo si vacío" no se sobrescriben si ya tienen contenido. Los campos nuevos
// del motor de autos sí se setean siempre. Es idempotente.
//
// Requiere la migración 045_centro_perfil_legal_autos.sql aplicada.
//
// Uso:
//   node scripts/seed-perfil-legal-tejido-humano.mjs           (dry-run: solo muestra)
//   node scripts/seed-perfil-legal-tejido-humano.mjs --apply   (escribe de verdad)
// ============================================================

import { readFileSync } from "fs";

const APPLY = process.argv.includes("--apply");

// Lee credenciales de .env.local (mismo patrón que los otros scripts del repo).
const env = readFileSync(".env.local", "utf8");
const get = (k) => (env.match(new RegExp("^" + k + "=(.*)$", "m")) || [])[1]?.trim().replace(/^["']|["']$/g, "");

const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

// Helper: devuelve true si un valor está vacío (null/undefined/string en blanco).
const vacio = (v) => v === null || v === undefined || (typeof v === "string" && v.trim() === "");

// ─── 1) Localizar el centro Tejido Humano ───────────────────────────────────
const { data: centros, error: cErr } = await sb
  .from("sgcc_centers")
  .select(
    "id, nombre, rep_legal, direccion, ciudad, telefono, email_contacto, " +
      "resolucion_habilitacion, resolucion_insolvencia, codigo_ministerio, " +
      "email_radicacion, email_secretaria, pie_vigilado"
  )
  .ilike("nombre", "%Tejido Humano%");

if (cErr) {
  console.error("SELECT centro FALLÓ:", cErr.message);
  process.exit(1);
}
if (!centros || centros.length === 0) {
  console.error('No se encontró ningún centro que coincida con "%Tejido Humano%" — abortando.');
  process.exit(1);
}
if (centros.length > 1) {
  console.error(
    "Se encontró más de un centro con ese nombre — abortando por seguridad:",
    centros.map((c) => `${c.id} (${c.nombre})`)
  );
  process.exit(1);
}

const centro = centros[0];
console.log("Centro encontrado:");
console.log("  id:     ", centro.id);
console.log("  nombre: ", centro.nombre);

// ─── 2) Calcular los cambios del centro ─────────────────────────────────────
// "solo si vacío": respeta el valor actual si ya tiene contenido.
// "siempre": campos nuevos del motor de autos, se setean sin condición.
const camposCentro = [
  { col: "resolucion_habilitacion", valor: "Resolución 0026 del 16 de enero de 2014", soloSiVacio: true },
  { col: "resolucion_insolvencia", valor: "Resolución 0748 del 21 de junio de 2021", soloSiVacio: false },
  { col: "codigo_ministerio", valor: "1414", soloSiVacio: false },
  { col: "direccion", valor: "Calle 12 B No. 8 A-34, Local 13, Pasaje Banco del Comercio", soloSiVacio: true },
  { col: "ciudad", valor: "Bogotá D.C.", soloSiVacio: true },
  { col: "telefono", valor: "2848345", soloSiVacio: true },
  { col: "email_contacto", valor: "radicacionccth@gmail.com", soloSiVacio: true },
  { col: "email_radicacion", valor: "radicacionccth@gmail.com", soloSiVacio: false },
  { col: "email_secretaria", valor: "secretariadeinsolvencia@gmail.com", soloSiVacio: false },
  { col: "rep_legal", valor: "José Ricardo Archila Guio", soloSiVacio: true },
];

const updateCentro = {};
const skipCentro = [];
for (const { col, valor, soloSiVacio } of camposCentro) {
  const actual = centro[col];
  if (soloSiVacio && !vacio(actual)) {
    skipCentro.push({ col, actual, valor });
    continue;
  }
  if (actual === valor) continue; // ya está como debe (idempotente)
  updateCentro[col] = valor;
}

console.log("\nCambios planificados para el centro:");
if (Object.keys(updateCentro).length === 0) {
  console.log("  (sin cambios — ya está al día)");
} else {
  for (const [col, valor] of Object.entries(updateCentro)) {
    console.log(`  ${col}: ${JSON.stringify(centro[col])} -> ${JSON.stringify(valor)}`);
  }
}
if (skipCentro.length > 0) {
  console.log("  Respetados (ya tienen valor, 'solo si vacío'):");
  for (const s of skipCentro) console.log(`    ${s.col}: ${JSON.stringify(s.actual)} (no se toca)`);
}

// ─── 3) Localizar conciliadores del centro ──────────────────────────────────
const { data: conciliadores, error: sErr } = await sb
  .from("sgcc_staff")
  .select("id, nombre, cedula, ciudad_cedula, tarjeta_profesional, codigo_inscripcion")
  .eq("center_id", centro.id)
  .eq("rol", "conciliador");

if (sErr) {
  console.error("SELECT conciliadores FALLÓ:", sErr.message);
  process.exit(1);
}

// Definición de los conciliadores reales y sus datos.
// match: regex (case-insensitive, sin acentos sensibles) contra el nombre.
const perfilesConciliadores = [
  {
    etiqueta: "Michael Bermúdez",
    match: /bermudez|bermúdez/i,
    campos: [
      { col: "cedula", valor: "1.032.418.853", soloSiVacio: false },
      { col: "ciudad_cedula", valor: "Bogotá D.C.", soloSiVacio: false },
      { col: "tarjeta_profesional", valor: "254.182", soloSiVacio: true },
      { col: "codigo_inscripcion", valor: "455.291", soloSiVacio: false },
    ],
  },
  {
    etiqueta: "María del Pilar Díaz",
    match: /d[ií]az/i,
    campos: [
      { col: "cedula", valor: "51.976.612", soloSiVacio: false },
      { col: "tarjeta_profesional", valor: "89.268", soloSiVacio: true },
    ],
  },
];

console.log("\nConciliadores del centro en BD:", (conciliadores || []).map((c) => c.nombre).join(", ") || "(ninguno)");

const updatesStaff = []; // { id, etiqueta, nombre, update }
for (const perfil of perfilesConciliadores) {
  const match = (conciliadores || []).find((c) => perfil.match.test(c.nombre || ""));
  if (!match) {
    console.log(`\n[INFO] Conciliador "${perfil.etiqueta}" no existe en la BD — solo se informa, no se crea.`);
    continue;
  }

  const update = {};
  const skip = [];
  for (const { col, valor, soloSiVacio } of perfil.campos) {
    const actual = match[col];
    if (soloSiVacio && !vacio(actual)) {
      skip.push({ col, actual });
      continue;
    }
    if (actual === valor) continue;
    update[col] = valor;
  }

  console.log(`\nConciliador "${match.nombre}" (id ${match.id}):`);
  if (Object.keys(update).length === 0) {
    console.log("  (sin cambios — ya está al día)");
  } else {
    for (const [col, valor] of Object.entries(update)) {
      console.log(`  ${col}: ${JSON.stringify(match[col])} -> ${JSON.stringify(valor)}`);
    }
  }
  for (const s of skip) console.log(`    (respetado) ${s.col}: ${JSON.stringify(s.actual)} (no se toca)`);

  if (Object.keys(update).length > 0) updatesStaff.push({ id: match.id, nombre: match.nombre, update });
}

// ─── 4) Aplicar (o no) ──────────────────────────────────────────────────────
if (!APPLY) {
  console.log("\n[DRY-RUN] No se escribió nada. Revisa los cambios y vuelve a correr con --apply.");
  process.exit(0);
}

let cambios = 0;

if (Object.keys(updateCentro).length > 0) {
  const { error } = await sb.from("sgcc_centers").update(updateCentro).eq("id", centro.id);
  if (error) {
    console.error("\nUPDATE centro FALLÓ:", error.message);
    process.exit(1);
  }
  console.log(`\n✓ Centro actualizado (${Object.keys(updateCentro).length} campo(s)).`);
  cambios++;
} else {
  console.log("\n· Centro sin cambios.");
}

for (const u of updatesStaff) {
  const { error } = await sb.from("sgcc_staff").update(u.update).eq("id", u.id);
  if (error) {
    console.error(`UPDATE conciliador "${u.nombre}" FALLÓ:`, error.message);
    process.exit(1);
  }
  console.log(`✓ Conciliador "${u.nombre}" actualizado (${Object.keys(u.update).length} campo(s)).`);
  cambios++;
}

if (cambios === 0) {
  console.log("\nNada que aplicar — la BD ya estaba al día (idempotente).");
} else {
  console.log(`\n✓ Listo. ${cambios} registro(s) actualizado(s).`);
}
