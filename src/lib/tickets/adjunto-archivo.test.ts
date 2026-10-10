// Ejecutar: node --test src/lib/tickets/adjunto-archivo.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { detectarMimeAdjunto, extensionAdjunto } from "./adjunto-archivo.ts";

const bytes = (...xs: number[]) => new Uint8Array(xs);
const ascii = (s: string) => new TextEncoder().encode(s);

test("detecta PDF, JPG, PNG y WebP por magic bytes", () => {
  assert.equal(detectarMimeAdjunto(ascii("%PDF-1.7\n...")), "application/pdf");
  assert.equal(detectarMimeAdjunto(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0)), "image/jpeg");
  assert.equal(
    detectarMimeAdjunto(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0)),
    "image/png",
  );
  assert.equal(detectarMimeAdjunto(ascii("RIFF\x10\x00\x00\x00WEBPVP8 ")), "image/webp");
});

test("rechaza contenido que no coincide aunque el navegador diga otra cosa", () => {
  assert.equal(detectarMimeAdjunto(ascii("<html><script>alert(1)</script>")), null);
  assert.equal(detectarMimeAdjunto(ascii("MZ\x90\x00")), null); // .exe
  assert.equal(detectarMimeAdjunto(ascii("RIFF\x10\x00\x00\x00WAVE")), null); // RIFF no-WebP
  assert.equal(detectarMimeAdjunto(ascii("%PD")), null); // truncado
  assert.equal(detectarMimeAdjunto(new Uint8Array()), null);
});

test("la extensión sale del tipo real y es [a-z0-9]{1,5}", () => {
  for (const m of ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const) {
    assert.match(extensionAdjunto(m), /^[a-z0-9]{1,5}$/);
  }
});
