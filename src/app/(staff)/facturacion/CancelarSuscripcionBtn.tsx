"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CancelarSuscripcionBtn({ suscripcionId }: { suscripcionId: string }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCancelar() {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch("/api/facturacion/cancelar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suscripcionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo cancelar");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setCargando(false);
    }
  }

  if (!confirmando) {
    return (
      <button
        onClick={() => setConfirmando(true)}
        className="text-sm font-bold text-red-600 border border-red-200 hover:bg-red-50 py-2 px-4 rounded-lg"
      >
        Cancelar suscripción
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs text-[#7A8FA6]">
        ¿Seguro? Mantendrás el acceso hasta la próxima fecha de cobro.
      </div>
      <div className="flex gap-2">
        <button
          onClick={onCancelar}
          disabled={cargando}
          className="text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 py-2 px-4 rounded-lg"
        >
          {cargando ? "Cancelando…" : "Sí, cancelar"}
        </button>
        <button
          onClick={() => setConfirmando(false)}
          disabled={cargando}
          className="text-sm font-bold text-[#0D2340] border border-[#DDE4ED] py-2 px-4 rounded-lg"
        >
          No
        </button>
      </div>
      {error && <div className="text-xs text-red-600">{error}</div>}
    </div>
  );
}
