"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Scale } from "lucide-react";

export default function RegistroPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    tipo_persona: "natural",
    nombres: "",
    apellidos: "",
    razon_social: "",
    tipo_doc: "CC",
    numero_doc: "",
    email: "",
    telefono: "",
    password: "",
    confirm: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }
    if (form.password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/partes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, selfRegister: true }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Error al crear la cuenta");
      return;
    }
    router.push("/login?registered=1");
  }

  return (
    <div className="min-h-screen bg-[#0D2340] flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-[#0D2340] px-8 py-6 text-center">
          <div className="flex justify-center mb-2">
            <div className="bg-[#B8860B] p-2.5 rounded-full">
              <Scale className="w-6 h-6 text-white" />
            </div>
          </div>
          <h1 className="text-white text-xl font-bold">Portal de Partes</h1>
          <p className="text-white/60 text-xs mt-1">Crear cuenta para seguimiento de asuntos</p>
        </div>

        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de persona</label>
            <select
              value={form.tipo_persona}
              onChange={(e) => set("tipo_persona", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
            >
              <option value="natural">Persona Natural</option>
              <option value="juridica">Persona Jurídica</option>
            </select>
          </div>

          {form.tipo_persona === "natural" ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombres</label>
                <input
                  required
                  value={form.nombres}
                  onChange={(e) => set("nombres", e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Apellidos</label>
                <input
                  required
                  value={form.apellidos}
                  onChange={(e) => set("apellidos", e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Razón social</label>
              <input
                required
                value={form.razon_social}
                onChange={(e) => set("razon_social", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo documento</label>
              <select
                value={form.tipo_doc}
                onChange={(e) => set("tipo_doc", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
              >
                {form.tipo_persona === "natural" ? (
                  <>
                    <option value="CC">C.C.</option>
                    <option value="CE">C.E.</option>
                    <option value="Pasaporte">Pasaporte</option>
                    <option value="PPT">PPT</option>
                  </>
                ) : (
                  <option value="NIT">NIT</option>
                )}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
              <input
                required
                value={form.numero_doc}
                onChange={(e) => set("numero_doc", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input
              value={form.telefono}
              onChange={(e) => set("telefono", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar</label>
              <input
                type="password"
                required
                value={form.confirm}
                onChange={(e) => set("confirm", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#0D2340] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#0d2340dd] transition-colors disabled:opacity-60 mt-2"
          >
            {loading ? "Registrando..." : "Crear cuenta"}
          </button>

          <p className="text-center text-xs text-gray-500">
            ¿Ya tienes cuenta?{" "}
            <a href="/login" className="text-[#B8860B] hover:underline font-medium">
              Ingresar
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
