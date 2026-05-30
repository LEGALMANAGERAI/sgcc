"use client";

import { useState } from "react";

export function CheckoutButton({
  planKey,
  periodo,
}: {
  planKey: string;
  periodo: "MENSUAL" | "ANUAL";
}) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPay() {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout/wompi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey, periodo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.checkoutUrl) {
        const partes = [
          data.error ?? "No se pudo iniciar el pago",
          data.detalle,
          data.code ? `code: ${data.code}` : null,
          data.hint,
          data.details,
        ].filter(Boolean);
        throw new Error(partes.join(" — "));
      }
      window.location.assign(data.checkoutUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
      setCargando(false);
    }
  }

  return (
    <>
      <button
        onClick={onPay}
        disabled={cargando}
        className="w-full bg-[#0D2340] hover:bg-[#1a3a5c] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm py-4 rounded-lg transition-colors"
      >
        {cargando ? "Redirigiendo a Wompi…" : "Pagar con Wompi"}
      </button>
      {error && (
        <p className="text-sm text-red-600 mt-3 text-center bg-red-50 border border-red-200 rounded-lg py-2 px-3">
          {error}
        </p>
      )}
    </>
  );
}
