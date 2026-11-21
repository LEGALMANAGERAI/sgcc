// Ejecutar: node --test src/lib/rate-limit.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { crearLimitador, ipDe } from "./rate-limit.ts";

test("permite hasta max por ventana y luego bloquea; se reinicia al vencer", () => {
  const ok = crearLimitador(2, 1000);
  assert.equal(ok("a", 0), true);
  assert.equal(ok("a", 10), true);
  assert.equal(ok("a", 20), false);
  assert.equal(ok("b", 20), true); // otra clave, cupo propio
  assert.equal(ok("a", 1000), true); // ventana vencida
});

test("ipDe toma el primer valor de x-forwarded-for", () => {
  const req = new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" } });
  assert.equal(ipDe(req), "1.2.3.4");
  assert.equal(ipDe(new Request("http://x")), "unknown");
});
