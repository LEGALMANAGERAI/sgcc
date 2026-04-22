"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Scale, Building2 } from "lucide-react";
import { PasswordInput } from "@/components/ui/PasswordInput";

const TIPOS_CENTRO = [
  { value: "privado", label: "Privado" },
  { value: "camara_comercio", label: "Camara de Comercio" },
  { value: "universidad", label: "Universidad" },
  { value: "notaria", label: "Notaria" },
  { value: "otro", label: "Otro" },
];

export default function RegistroCentroPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    nombre: "",
    nit: "",
    tipo_centro: "privado",
    representante_legal: "",
    resolucion_habilitacion: "",
    fecha_habilitacion: "",
    direccion: "",
    ciudad: "",
    departamento: "",
    telefono: "",
    email_contacto: "",
    admin_nombre: "",
    admin_email: "",
    admin_password: "",
    admin_confirm: "",
  });

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (form.admin_password !== form.admin_confirm) {
      setError("Las contrasenas no coinciden");
      return;
    }
    if (form.admin_password.length < 8) {
      setError("La contrasena debe tener al menos 8 caracteres");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        centro: {
          nombre: form.nombre,
          nit: form.nit,
          tipo: form.tipo_centro,
          rep_legal: form.representante_legal,
          resolucion_habilitacion: form.resolucion_habilitacion,
          fecha_habilitacion: form.fecha_habilitacion,
          direccion: form.direccion,
          ciudad: form.ciudad,
          departamento: form.departamento,
          telefono: form.telefono,
          email_contacto: form.email_contacto,
        },
        admin: {
          nombre: form.admin_nombre,
          email: form.admin_email,
          password: form.admin_password,
        },
      };

      const res = await fetch("/api/auth/registro/centro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Error al registrar el centro");
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
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#0D2340] px-8 py-6 text-center">
          <div className="flex justify-center mb-2">
            <div className="bg-[#1B4F9B] p-2.5 rounded-full">
              <Building2 className="w-6 h-6 text-white" />
            </div>
          </div>
          <h1 className="text-white text-xl font-bold">
            Registro de Centro de Conciliacion
          </h1>
          <p className="text-white/60 text-xs mt-1">
            Completa la informacion para habilitar tu centro en el SGCC
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-5">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
              {error}
            </div>
          )}

          {/* ── Datos del centro ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelCls}>Nombre del centro *</label>
              <input
                required
                value={form.nombre}
                onChange={(e) => set("nombre", e.target.value)}
                placeholder="Centro de Conciliacion XYZ"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>NIT *</label>
              <input
                required
                value={form.nit}
                onChange={(e) => set("nit", e.target.value)}
                placeholder="900.123.456-7"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Tipo de centro</label>
              <select
                value={form.tipo_centro}
                onChange={(e) => set("tipo_centro", e.target.value)}
                className={inputCls}
              >
                {TIPOS_CENTRO.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className={labelCls}>Representante legal</label>
              <input
                value={form.representante_legal}
                onChange={(e) => set("representante_legal", e.target.value)}
                placeholder="Nombre completo"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Resolucion de habilitacion *</label>
              <input
                required
                value={form.resolucion_habilitacion}
                onChange={(e) =>
                  set("resolucion_habilitacion", e.target.value)
                }
                placeholder="No. resolucion MinJusticia"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Fecha de habilitacion</label>
              <input
                type="date"
                value={form.fecha_habilitacion}
                onChange={(e) => set("fecha_habilitacion", e.target.value)}
                className={inputCls}
              />
            </div>

            <div className="sm:col-span-2">
              <label className={labelCls}>Direccion</label>
              <input
                value={form.direccion}
                onChange={(e) => set("direccion", e.target.value)}
                placeholder="Calle / Carrera / Av."
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Ciudad *</label>
              <input
                required
                value={form.ciudad}
                onChange={(e) => set("ciudad", e.target.value)}
                placeholder="Bogota"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Departamento</label>
              <input
                value={form.departamento}
                onChange={(e) => set("departamento", e.target.value)}
                placeholder="Cundinamarca"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Telefono</label>
              <input
                value={form.telefono}
                onChange={(e) => set("telefono", e.target.value)}
                placeholder="601 234 5678"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Email de contacto *</label>
              <input
                type="email"
                required
                value={form.email_contacto}
                onChange={(e) => set("email_contacto", e.target.value)}
                placeholder="centro@ejemplo.com"
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
                Datos del administrador
              </span>
            </div>
          </div>

          {/* ── Datos del admin ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelCls}>Nombre completo *</label>
              <input
                required
                value={form.admin_nombre}
                onChange={(e) => set("admin_nombre", e.target.value)}
                placeholder="Nombre del administrador"
                className={inputCls}
              />
            </div>

            <div className="sm:col-span-2">
              <label className={labelCls}>Correo del administrador *</label>
              <input
                type="email"
                required
                value={form.admin_email}
                onChange={(e) => set("admin_email", e.target.value)}
                placeholder="admin@ejemplo.com"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Contrasena *</label>
              <PasswordInput
                required
                minLength={8}
                value={form.admin_password}
                onChange={(e) => set("admin_password", e.target.value)}
                placeholder="Min. 8 caracteres"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Confirmar contrasena *</label>
              <PasswordInput
                required
                minLength={8}
                value={form.admin_confirm}
                onChange={(e) => set("admin_confirm", e.target.value)}
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
            {loading ? "Registrando centro..." : "Registrar centro"}
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
