"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const TRAMITES = [
  {
    value: "conciliacion",
    label: "Conciliación",
    desc: "Resolver conflictos civiles, familiares o comerciales con ayuda de un tercero neutral.",
  },
  {
    value: "insolvencia",
    label: "Insolvencia",
    desc: "Reorganizar tus deudas (persona natural no comerciante o pequeño comerciante). Ley 2445 de 2025.",
  },
] as const;

export default function NuevaSolicitudPage() {
  const router = useRouter();
  const [sel, setSel] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Redirige si el flag está desactivado (cliente) — la guardia server-side
  // ocurre en /mis-solicitudes via process.env.
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_ENABLE_PORTAL_PARTES_SOLICITUDES) {
      router.replace("/mis-casos");
    }
  }, [router]);

  async function crear() {
    if (!sel) return;
    setLoading(true);
    setError("");
    const res = await fetch("/api/partes/solicitudes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo_tramite: sel }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Error al crear la solicitud");
      return;
    }
    router.push(`/mis-solicitudes/${data.id}`);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-[#0D2340] mb-2">Nueva solicitud</h1>
      <p className="text-gray-600 mb-6">
        Selecciona el tipo de trámite que deseas radicar.
      </p>

      <div className="space-y-3">
        {TRAMITES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setSel(t.value)}
            className={`w-full text-left rounded-xl border-2 p-4 transition-colors ${
              sel === t.value
                ? "border-[#0D2340] bg-blue-50"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div className="font-semibold text-[#0D2340] mb-1">{t.label}</div>
            <div className="text-sm text-gray-600">{t.desc}</div>
          </button>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <button
        disabled={!sel || loading}
        onClick={crear}
        className="mt-6 bg-[#0D2340] text-white px-6 py-2.5 rounded-lg disabled:opacity-40 text-sm font-medium"
      >
        {loading ? "Creando…" : "Continuar"}
      </button>
    </div>
  );
}
