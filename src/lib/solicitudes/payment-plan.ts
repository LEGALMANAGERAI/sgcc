// src/lib/solicitudes/payment-plan.ts
// Cronograma de pagos por clase de prelación: amortización lineal sobre capital
// + intereses futuros + intereses de espera (causados desde la firma del acuerdo).

import type { CuotaCronograma } from "@/types/solicitudes";

interface Params {
  capital: number;
  numeroCuotas: number;
  tasaFuturaMensual: number; // porcentaje, ej. 1.5 = 1.5% mensual
  tasaEsperaMensual: number;
  fechaInicio: Date;
  intervaloMeses?: number; // default 1 (mensual)
}

export function generarCronograma({
  capital,
  numeroCuotas,
  tasaFuturaMensual,
  tasaEsperaMensual,
  fechaInicio,
  intervaloMeses = 1,
}: Params): CuotaCronograma[] {
  if (capital <= 0 || numeroCuotas <= 0) return [];

  const iFutura = tasaFuturaMensual / 100;
  const iEspera = tasaEsperaMensual / 100;

  const cuotaCapital = capital / numeroCuotas;
  let saldo = capital;
  const out: CuotaCronograma[] = [];

  for (let n = 1; n <= numeroCuotas; n++) {
    const interesesFuturos = saldo * iFutura;
    const interesesEspera = saldo * iEspera;
    const nuevoSaldo = saldo - cuotaCapital;
    const fecha = new Date(fechaInicio);
    fecha.setMonth(fecha.getMonth() + intervaloMeses * (n - 1));

    out.push({
      cuota: n,
      capital: round2(cuotaCapital),
      intereses_espera: round2(interesesEspera),
      intereses_futuros: round2(interesesFuturos),
      saldo: round2(Math.max(0, nuevoSaldo)),
      fecha_pago: fecha.toISOString().slice(0, 10),
    });

    saldo = nuevoSaldo;
  }
  return out;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
