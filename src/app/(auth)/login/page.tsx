"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Scale, Eye, EyeOff, Building2, Users, Sparkles } from "lucide-react";

type Tab = "staff" | "party";

const DEMO_ACCOUNTS = [
  { label: "Demo Admin", email: "admin@centrodemo.com", password: "demo1234", icon: "🛡️" },
  { label: "Demo Conciliador", email: "conciliador@centrodemo.com", password: "demo1234", icon: "⚖️" },
  { label: "Demo Secretaria", email: "secretaria@centrodemo.com", password: "demo1234", icon: "📋" },
];

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const registered = params.get("registered") === "1";

  const [tab, setTab] = useState<Tab>("staff");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const placeholder =
    tab === "staff" ? "correo@centroconciliacion.com" : "correo@ejemplo.com";

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
      setError("Correo o contrasena incorrectos");
      return;
    }

    if (tab === "party") {
      router.push("/mis-casos");
    } else {
      router.push(params.get("callbackUrl") ?? "/dashboard");
    }
  }

  async function handleDemo(demoEmail: string, demoPassword: string) {
    setError("");
    setLoading(true);

    const res = await signIn("staff", {
      email: demoEmail,
      password: demoPassword,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setError("Error al iniciar sesion demo");
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-[#0D2340] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#0D2340] px-8 py-8 text-center">
          <div className="flex justify-center mb-3">
            <div className="bg-[#B8860B] p-3 rounded-full shadow-lg shadow-[#B8860B]/30">
              <Scale className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-white text-2xl font-bold tracking-wide">SGCC</h1>
          <p className="text-white/60 text-sm mt-1">
            Sistema de Gestion de Centros de Conciliacion
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            type="button"
            onClick={() => { setTab("staff"); setError(""); }}
            className={`flex-1 py-3.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              tab === "staff"
                ? "text-[#0D2340] border-b-2 border-[#B8860B]"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <Building2 className="w-4 h-4" />
            Centro / Staff
          </button>
          <button
            type="button"
            onClick={() => { setTab("party"); setError(""); }}
            className={`flex-1 py-3.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              tab === "party"
                ? "text-[#0D2340] border-b-2 border-[#B8860B]"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <Users className="w-4 h-4" />
            Partes
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 pt-6 pb-4 space-y-4">
          {/* Banner de registro exitoso */}
          {registered && (
            <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg border border-green-200">
              Cuenta creada. Revisa tu correo para verificar.
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
              {error}
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Correo electronico
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={placeholder}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340] focus:border-transparent transition-shadow"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contrasena
            </label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340] focus:border-transparent pr-10 transition-shadow"
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPwd ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#0D2340] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#162d4d] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>

          {/* Links secundarios */}
          <div className="space-y-2 pt-1">
            <p className="text-center text-xs text-gray-500">
              <a
                href="/recuperar"
                className="text-[#B8860B] hover:underline font-medium"
              >
                Olvidaste tu contrasena?
              </a>
            </p>

            {tab === "party" && (
              <p className="text-center text-xs text-gray-500">
                No tienes cuenta?{" "}
                <a
                  href="/registro"
                  className="text-[#B8860B] hover:underline font-medium"
                >
                  Crear cuenta
                </a>
              </p>
            )}

            {tab === "staff" && (
              <p className="text-center text-xs text-gray-500">
                Quieres registrar tu centro?{" "}
                <a
                  href="/registro/centro"
                  className="text-[#B8860B] hover:underline font-medium"
                >
                  Registrar mi centro
                </a>
              </p>
            )}
          </div>
        </form>

        {/* Separador Demo */}
        <div className="px-8 pb-6">
          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-gray-200" />
            <span className="mx-3 text-xs text-gray-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Explorar demo
            </span>
            <div className="flex-grow border-t border-gray-200" />
          </div>

          <div className="grid grid-cols-3 gap-2 mt-2">
            {DEMO_ACCOUNTS.map((demo) => (
              <button
                key={demo.email}
                type="button"
                disabled={loading}
                onClick={() => handleDemo(demo.email, demo.password)}
                className="flex flex-col items-center gap-1 py-2.5 px-2 rounded-lg border border-gray-200 hover:border-[#B8860B] hover:bg-[#B8860B]/5 transition-all text-xs text-gray-600 hover:text-[#0D2340] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="text-base">{demo.icon}</span>
                <span className="font-medium leading-tight text-center">
                  {demo.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
