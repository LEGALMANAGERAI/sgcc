"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Scale, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState<"staff" | "party">("staff");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await signIn(tab, {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setError("Correo o contraseña incorrectos");
      return;
    }

    if (tab === "party") {
      router.push("/mis-casos");
    } else {
      router.push(params.get("callbackUrl") ?? "/dashboard");
    }
  }

  return (
    <div className="min-h-screen bg-[#0D2340] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#0D2340] px-8 py-8 text-center">
          <div className="flex justify-center mb-3">
            <div className="bg-[#B8860B] p-3 rounded-full">
              <Scale className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-white text-2xl font-bold">SGCC</h1>
          <p className="text-white/60 text-sm mt-1">Sistema de Gestión de Centros de Conciliación</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setTab("staff")}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              tab === "staff"
                ? "text-[#0D2340] border-b-2 border-[#B8860B]"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Centro / Staff
          </button>
          <button
            onClick={() => setTab("party")}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              tab === "party"
                ? "text-[#0D2340] border-b-2 border-[#B8860B]"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Partes (Portal)
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 py-8 space-y-5">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@ejemplo.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340] focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340] focus:border-transparent pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#0D2340] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#0d2340dd] transition-colors disabled:opacity-60"
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>

          {tab === "party" && (
            <p className="text-center text-xs text-gray-500">
              ¿Primera vez?{" "}
              <a href="/registro" className="text-[#B8860B] hover:underline font-medium">
                Crear cuenta
              </a>
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
