"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Gavel } from "lucide-react";

export default function RegistroConciliadorPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    nombre: "",
    email: "",
    tarjeta_profesional: "",
    telefono: "",
    ciudad: "",
    codigo_centro: "",
    password: "",
    confirm: "",
  });

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirm) {
      setError("Las contrasenas no coinciden");
      return;
    }
    if (form.password.length < 8) {
      setError("La contrasena debe tener al menos 8 caracteres");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/registro/conciliador", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Error al registrar el conciliador");
        return;
      }

      router.push("/login?registered=1");
    } catch {
      setError("Error de conexion. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340] focus:border-transparent";
  const labelCls =
    "block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5";

  return (
    <div className="min-h-screen bg-[#0D2340] flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#0D2340] px-8 py-6 text-center">
          <div className="flex justify-center mb-2">
            <div className="bg-[#B8860B] p-2.5 rounded-full">
              <Gavel className="w-6 h-6 text-white" />
            </div>
          </div>
          <h1 className="text-white text-xl font-bold">
            Registro de Conciliador
          </h1>
          <p className="text-white/60 text-xs mt-1">
            Unete a un centro de conciliacion existente
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-5">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelCls}>Nombre completo *</label>
              <input
                required
                value={form.nombre}
                onChange={(e) => set("nombre", e.target.value)}
                placeholder="Tu nombre completo"
                className={inputCls}
              />
            </div>

            <div className="sm:col-span-2">
              <label className={labelCls}>Correo electronico *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="correo@ejemplo.com"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Tarjeta profesional</label>
              <input
                value={form.tarjeta_profesional}
                onChange={(e) => set("tarjeta_profesional", e.target.value)}
                placeholder="No. tarjeta"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Telefono</label>
              <input
                value={form.telefono}
                onChange={(e) => set("telefono", e.target.value)}
                placeholder="300 123 4567"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Ciudad</label>
              <input
                value={form.ciudad}
                onChange={(e) => set("ciudad", e.target.value)}
                placeholder="Bogota"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Codigo del centro *</label>
              <input
                required
                value={form.codigo_centro}
                onChange={(e) => set("codigo_centro", e.target.value)}
                placeholder="UUID o codigo de invitacion"
                className={inputCls}
              />
            </div>
          </div>

          {/* ── Separador ── */}
          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-4 text-[10px] font-semibold text-[#B8860B] uppercase tracking-widest">
                Credenciales de acceso
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Contrasena *</label>
              <input
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder="Min. 8 caracteres"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Confirmar contrasena *</label>
              <input
                type="password"
                required
                minLength={8}
                value={form.confirm}
                onChange={(e) => set("confirm", e.target.value)}
                placeholder="Repetir contrasena"
                className={inputCls}
              />
            </div>
          </div>

          {/* ── Submit ── */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#0D2340] text-white rounded-lg py-3 text-sm font-medium hover:bg-[#0d2340dd] transition-colors disabled:opacity-60 mt-2"
          >
            {loading ? "Registrando..." : "Registrar conciliador"}
          </button>

          <p className="text-center text-xs text-gray-500">
            <Link
              href="/registro"
              className="text-[#B8860B] hover:underline font-medium"
            >
              Volver a opciones de registro
            </Link>
            {" | "}
            <Link
              href="/login"
              className="text-[#B8860B] hover:underline font-medium"
            >
              Ya tengo cuenta
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
