"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Building2, Users, Sparkles, ArrowLeft } from "lucide-react";
import { SgccLogo } from "@/components/ui/SgccLogo";

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
  // Cuando el staff trabaja en varios centros, mostramos un selector tras
  // validar credenciales en el endpoint check-centers.
  const [centerOptions, setCenterOptions] = useState<Array<{ id: string; nombre: string }> | null>(null);

  const placeholder =
    tab === "staff" ? "correo@centroconciliacion.com" : "correo@ejemplo.com";

  async function doStaffSignIn(centerId?: string) {
    const res = await signIn("staff", {
      email,
      password,
      ...(centerId ? { centerId } : {}),
      redirect: false,
    });

    if (res?.error) {
      setError("Correo o contrasena incorrectos");
      return false;
    }

    router.push(params.get("callbackUrl") ?? "/dashboard");
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (tab === "party") {
        const res = await signIn("party", { email, password, redirect: false });
        if (res?.error) {
          setError("Correo o contrasena incorrectos");
          return;
        }
        router.push("/mis-casos");
        return;
      }

      // Staff: primero preguntamos a qué centros tiene acceso esta credencial.
      const resp = await fetch("/api/auth/staff/check-centers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!resp.ok) {
        setError("Correo o contrasena incorrectos");
        return;
      }

      const { centers } = (await resp.json()) as {
        centers: Array<{ id: string; nombre: string }>;
      };

      if (!centers || centers.length === 0) {
        setError("Correo o contrasena incorrectos");
        return;
      }

      if (centers.length === 1) {
        await doStaffSignIn(centers[0].id);
        return;
      }

      // Más de un centro: mostrar selector al usuario.
      setCenterOptions(centers);
    } finally {
      setLoading(false);
    }
  }

  async function handleCenterSelected(centerId: string) {
    setError("");
    setLoading(true);
    try {
      await doStaffSignIn(centerId);
    } finally {
      setLoading(false);
    }
  }

  function handleBackToLogin() {
    setCenterOptions(null);
    setError("");
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
        <div className="bg-[color:var(--color-ink)] px-8 py-8 flex justify-center">
          <SgccLogo variant="dark" size="lg" showDescriptor />
        </div>

        {/* Selector de centros cuando el staff trabaja en varios */}
        {centerOptions && centerOptions.length > 1 ? (
          <div className="px-8 py-6 space-y-4">
            <button
              type="button"
              onClick={handleBackToLogin}
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-[#0D2340] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Volver
            </button>
            <div>
              <h2 className="text-base font-semibold text-[#0D2340]">
                Selecciona el centro
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Tu cuenta está asociada a varios centros. Elige a cuál quieres ingresar.
              </p>
            </div>
            {error && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
                {error}
              </div>
            )}
            <div className="space-y-2">
              {centerOptions.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={loading}
                  onClick={() => handleCenterSelected(c.id)}
                  className="w-full flex items-center gap-3 border border-gray-200 rounded-lg px-4 py-3 text-left hover:border-[#1B4F9B] hover:bg-[#1B4F9B]/5 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <div className="w-9 h-9 rounded-lg bg-[#1B4F9B]/10 text-[#1B4F9B] flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium text-[#0D2340] leading-snug">
                    {c.nombre}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
        <>
        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            type="button"
            onClick={() => { setTab("staff"); setError(""); }}
            className={`flex-1 py-3.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              tab === "staff"
                ? "text-[#0D2340] border-b-2 border-[#1B4F9B]"
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
                ? "text-[#0D2340] border-b-2 border-[#1B4F9B]"
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

          {/* Google OAuth */}
          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: tab === "staff" ? "/dashboard" : "/mis-casos" })}
            className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9s0 1.452.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Conectar con Google
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-white px-3 text-gray-400">o con correo</span></div>
          </div>

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
                className="text-[#1B4F9B] hover:underline font-medium"
              >
                Olvidaste tu contrasena?
              </a>
            </p>

            {tab === "party" && (
              <p className="text-center text-xs text-gray-500">
                No tienes cuenta?{" "}
                <a
                  href="/registro"
                  className="text-[#1B4F9B] hover:underline font-medium"
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
                  className="text-[#1B4F9B] hover:underline font-medium"
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
                className="flex flex-col items-center gap-1 py-2.5 px-2 rounded-lg border border-gray-200 hover:border-[#1B4F9B] hover:bg-[#1B4F9B]/5 transition-all text-xs text-gray-600 hover:text-[#0D2340] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="text-base">{demo.icon}</span>
                <span className="font-medium leading-tight text-center">
                  {demo.label}
                </span>
              </button>
            ))}
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
