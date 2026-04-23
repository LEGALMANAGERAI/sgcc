// scripts/smoke-payment-plan.mjs
// Smoke test autonomo de la matematica de cronogramas.
// Valida las formulas contra el ejemplo real de BBVA compartido por el usuario.
// Ejecutar: node scripts/smoke-payment-plan.mjs

function round2(n) { return Math.round(n * 100) / 100; }
function tasaMensualAEA(iMensualPct) { return Math.pow(1 + iMensualPct / 100, 12) - 1; }
function tasaEAAMensual(eaPct) { return Math.pow(1 + eaPct / 100, 1 / 12) - 1; }

function cuotaFrancesa(capital, iMensual, n) {
  if (iMensual === 0) return capital / n;
  const f = Math.pow(1 + iMensual, n);
  return (capital * iMensual * f) / (f - 1);
}

function generarCronogramaFrances({ capital, tasaMensualPct, numeroCuotas, mesesGracia = 0 }) {
  if (capital <= 0 || numeroCuotas <= 0) return [];
  const i = tasaMensualPct / 100;
  const C = cuotaFrancesa(capital, i, numeroCuotas);
  let saldo = capital;
  const out = [];
  for (let k = 1; k <= numeroCuotas; k++) {
    const intereses = saldo * i;
    const amort = C - intereses;
    saldo = saldo - amort;
    if (k === numeroCuotas) saldo = 0;
    out.push({
      cuota: k,
      mes_relativo: mesesGracia + k,
      cuota_total: round2(C),
      intereses: round2(intereses),
      amortizacion: round2(amort),
      saldo: round2(saldo),
    });
  }
  return out;
}

function generarCronogramaLineal({ capital, tasaMensualPct, numeroCuotas, mesesGracia = 0 }) {
  if (capital <= 0 || numeroCuotas <= 0) return [];
  const i = tasaMensualPct / 100;
  const amort = capital / numeroCuotas;
  let saldo = capital;
  const out = [];
  for (let k = 1; k <= numeroCuotas; k++) {
    const intereses = saldo * i;
    const cuotaTotal = amort + intereses;
    saldo = saldo - amort;
    if (k === numeroCuotas) saldo = 0;
    out.push({
      cuota: k,
      mes_relativo: mesesGracia + k,
      cuota_total: round2(cuotaTotal),
      intereses: round2(intereses),
      amortizacion: round2(amort),
      saldo: round2(saldo),
    });
  }
  return out;
}

function generarCronogramaProrrataQuinta({ creditos, numeroCuotasCompartido, mesesGraciaCompartido, tipoAmortizacion = "francesa" }) {
  const capitalTotal = creditos.reduce((s, c) => s + c.capital, 0);
  const gen = tipoAmortizacion === "lineal" ? generarCronogramaLineal : generarCronogramaFrances;
  return creditos.map((c) => ({
    credito_id: c.id,
    capital: c.capital,
    porcentaje_prorrata: capitalTotal > 0 ? round2((c.capital / capitalTotal) * 100) : 0,
    cronograma: gen({
      capital: c.capital,
      tasaMensualPct: c.tasaMensualPct,
      numeroCuotas: numeroCuotasCompartido,
      mesesGracia: mesesGraciaCompartido,
    }),
  }));
}

const TOL = 200;
let ok = 0;
let fail = 0;

function assertClose(label, actual, expected, tol = TOL) {
  const diff = Math.abs(actual - expected);
  if (diff <= tol) { console.log(`  ok   ${label}: ${fmt(actual)} (esperado ${fmt(expected)}, delta ${fmt(diff)})`); ok++; }
  else { console.log(`  FAIL ${label}: ${fmt(actual)} (esperado ${fmt(expected)}, delta ${fmt(diff)})`); fail++; }
}
function assertEq(label, actual, expected) {
  if (actual === expected) { console.log(`  ok   ${label}: ${actual}`); ok++; }
  else { console.log(`  FAIL ${label}: ${actual} (esperado ${expected})`); fail++; }
}
function fmt(n) { return "$" + Math.round(n).toLocaleString("es-CO"); }

console.log("\n=== Caso BBVA real (libre inversion 5a clase) ===");
const bbva = generarCronogramaFrances({ capital: 112977993, tasaMensualPct: 0.48, numeroCuotas: 60, mesesGracia: 15 });
assertEq("cantidad de cuotas", bbva.length, 60);
assertClose("cuota fija", bbva[0].cuota_total, 2175841, 5000);
assertClose("intereses cuota 1", bbva[0].intereses, 549926, 8000);
assertClose("saldo tras cuota 60", bbva[59].saldo, 0, 1);
assertEq("mes_relativo cuota 1", bbva[0].mes_relativo, 16);
assertEq("mes_relativo cuota 60", bbva[59].mes_relativo, 75);

console.log("\n=== Equivalencia de tasas ===");
assertClose("0.48% mensual -> EA", tasaMensualAEA(0.48) * 100, 5.91, 0.1);
assertClose("6% EA -> mensual", tasaEAAMensual(6) * 100, 0.487, 0.01);

console.log("\n=== Amortizacion lineal ===");
const lineal = generarCronogramaLineal({ capital: 12000000, tasaMensualPct: 1, numeroCuotas: 12, mesesGracia: 0 });
assertClose("lineal: amortizacion constante", lineal[0].amortizacion, 1000000, 1);
assertClose("lineal: intereses cuota 1", lineal[0].intereses, 120000, 1);
assertClose("lineal: saldo final", lineal[11].saldo, 0, 1);

console.log("\n=== Prorrata quinta clase ===");
const quinta = generarCronogramaProrrataQuinta({
  creditos: [
    { id: "A", capital: 10000000, tasaMensualPct: 1 },
    { id: "B", capital: 30000000, tasaMensualPct: 2 },
    { id: "C", capital: 60000000, tasaMensualPct: 1.5 },
  ],
  numeroCuotasCompartido: 24,
  mesesGraciaCompartido: 3,
});
assertClose("prorrata A: % = 10%", quinta[0].porcentaje_prorrata, 10, 0.01);
assertClose("prorrata B: % = 30%", quinta[1].porcentaje_prorrata, 30, 0.01);
assertClose("prorrata C: % = 60%", quinta[2].porcentaje_prorrata, 60, 0.01);
assertEq("prorrata A: arranca en mes 4", quinta[0].cronograma[0].mes_relativo, 4);
assertClose("prorrata A: saldo final 0", quinta[0].cronograma[23].saldo, 0, 1);

console.log("\n=== Resumen ===");
console.log(`  ok:   ${ok}`);
console.log(`  fail: ${fail}`);
process.exit(fail === 0 ? 0 : 1);
