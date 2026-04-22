"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Users, Gavel, Briefcase } from "lucide-react";

type Rol = "conciliador" | "secretario";

export default function RegistroStaffPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [rol, setRol] = useState<Rol>("conciliador");
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
      const res = await fetch("/api/auth/registro/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, rol }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Error al registrar el staff");
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

  const roles: { value: Rol; title: string; desc: string; icon: typeof Gavel }[] = [
    {
      value: "conciliador",
      title: "Conciliador",
      desc: "Lleva casos, dirige audiencias y firma actas",
      icon: Gavel,
    },
    {
      value: "secretario",
      title: "Funcionario",
      desc: "Personal administrativo, secretaria o auxiliar del centro",
      icon: Briefcase,
    },
  ];

  return (
    <div className="min-h-screen bg-[#0D2340] flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#0D2340] px-8 py-6 text-center">
          <div className="flex justify-center mb-2">
            <div className="bg-[#1B4F9B] p-2.5 rounded-full">
              <Users className="w-6 h-6 text-white" />
            </div>
          </div>
          <h1 className="text-white text-xl font-bold">
            Registro de Staff
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

          {/* ── Selector de rol ── */}
          <div>
            <label className={labelCls}>Tu rol en el centro *</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {roles.map((r) => {
                const active = rol === r.value;
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRol(r.value)}
                    className={`text-left border rounded-xl p-3 transition-all ${
                      active
                        ? "border-[#1B4F9B] bg-[#1B4F9B]/5 ring-2 ring-[#1B4F9B]/20"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <r.icon
                        className={`w-4 h-4 ${
                          active ? "text-[#1B4F9B]" : "text-gray-500"
                        }`}
                      />
                      <span
                        className={`text-sm font-semibold ${
                          active ? "text-[#0D2340]" : "text-gray-700"
                        }`}
                      >
                        {r.title}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 leading-snug">
                      {r.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

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

            {rol === "conciliador" && (
              <div className="sm:col-span-2">
                <label className={labelCls}>Tarjeta profesional</label>
                <input
                  value={form.tarjeta_profesional}
                  onChange={(e) => set("tarjeta_profesional", e.target.value)}
                  placeholder="No. tarjeta"
                  className={inputCls}
                />
              </div>
            )}

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

            <div className="sm:col-span-2">
              <label className={labelCls}>Codigo del centro *</label>
              <input
                required
                value={form.codigo_centro}
                onChange={(e) => set("codigo_centro", e.target.value)}
                placeholder="Ej: ABCD1234"
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
              <span className="bg-white px-4 text-[10px] font-semibold text-[#1B4F9B] uppercase tracking-widest">
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
            {loading ? "Registrando..." : "Registrar staff"}
          </button>

          <p className="text-center text-xs text-gray-500">
            <Link
              href="/registro"
              className="text-[#1B4F9B] hover:underline font-medium"
            >
              Volver a opciones de registro
            </Link>
            {" | "}
            <Link
              href="/login"
              className="text-[#1B4F9B] hover:underline font-medium"
            >
              Ya tengo cuenta
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
