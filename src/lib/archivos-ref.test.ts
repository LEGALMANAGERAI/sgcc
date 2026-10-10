// Ejecutar: node --test src/lib/archivos-ref.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { pathDeArchivo, archivoHref } from "./archivos-ref.ts";

const PUB = "https://abc.supabase.co/storage/v1/object/public/sgcc-documents/";

test("extrae el path de URL pública, firmada o path plano", () => {
  assert.equal(pathDeArchivo(PUB + "autos/c1/k1/auto.docx"), "autos/c1/k1/auto.docx");
  assert.equal(
    pathDeArchivo("https://abc.supabase.co/storage/v1/object/sign/sgcc-documents/firmas/c1/d.pdf?token=x"),
    "firmas/c1/d.pdf",
  );
  assert.equal(pathDeArchivo(PUB + "centers/c1/cases/k1/1-mi%20archivo.pdf"), "centers/c1/cases/k1/1-mi archivo.pdf");
  assert.equal(pathDeArchivo("plantillas/c1/x.docx"), "plantillas/c1/x.docx");
});

test("ignora lo que no es de sgcc-documents o es peligroso", () => {
  assert.equal(pathDeArchivo(null), null);
  assert.equal(pathDeArchivo(""), null);
  assert.equal(pathDeArchivo("https://legalmanager.com.co/doc/1.pdf"), null);
  assert.equal(pathDeArchivo("https://abc.supabase.co/storage/v1/object/public/poderes/a/b.pdf"), null);
  assert.equal(pathDeArchivo("/api/firmas/1/documento-firmado"), null);
  assert.equal(pathDeArchivo("centers/../otro/x.pdf"), null);
  assert.equal(pathDeArchivo(PUB + "centers/%2e%2e/x.pdf"), null);
  assert.equal(pathDeArchivo("solo-un-segmento"), null);
  assert.equal(pathDeArchivo(PUB + "a//b"), null);
});

test("archivoHref manda al proxy y deja pasar URLs externas", () => {
  assert.equal(archivoHref(PUB + "sgcc-docs/c1/k1/acta.docx"), "/api/archivo?path=sgcc-docs%2Fc1%2Fk1%2Facta.docx");
  assert.equal(archivoHref("https://lm.co/x.pdf"), "https://lm.co/x.pdf");
  assert.equal(archivoHref("/api/firmas/1/documento-firmado"), "/api/firmas/1/documento-firmado");
  assert.equal(archivoHref(null), null);
});
