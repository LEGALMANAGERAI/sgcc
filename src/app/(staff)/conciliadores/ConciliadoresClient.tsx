"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface StaffMember {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  tarjeta_profesional: string | null;
  codigo_interno: string | null;
  rol: string;
  activo: boolean;
  supervisor_id: string | null;
  casos_activos: number;
  supervisor_nombre: string;
}

interface Props {
  staff: StaffMember[];
  conciliadores: { id: string; nombre: string }[];
}

export function ConciliadoresClient({ staff, conciliadores }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    nombre: "",
    email: "",
    telefono: "",
    rol: "conciliador",
    tarjeta_profesional: "",
    codigo_interno: "",
    supervisor_id: "",
  });

  function resetForm() {
    setForm({ nombre: "", email: "", telefono: "", rol: "conciliador", tarjeta_profesional: "", codigo_interno: "", supervisor_id: "" });
    setEditingId(null);
    setError("");
  }

  function startEdit(s: StaffMember) {
    setForm({
      nombre: s.nombre,
      email: s.email,
      telefono: s.telefono ?? "",
      rol: s.rol,
      tarjeta_profesional: s.tarjeta_profesional ?? "",
      codigo_interno: s.codigo_interno ?? "",
      supervisor_id: s.supervisor_id ?? "",
    });
    setEditingId(s.id);
    setShowForm(true);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (editingId) {
        const res = await fetch(`/api/conciliadores/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Error actualizando conciliador");
        }
      } else {
        const res = await fetch("/api/conciliadores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Error creando conciliador");
        }
      }
      resetForm();
      setShowForm(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeactivate(id: string, nombre: string) {
    if (!confirm(`¿Desactivar a ${nombre}? No podrá acceder al sistema.`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/conciliadores/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error desactivando");
      }
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Header con boton Agregar */}
      <div className="flex items-center justify-end mb-4">
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="bg-[#0D2340] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0d2340dd] transition-colors"
        >
          {showForm ? "Cancelar" : "+ Agregar miembro"}
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto mb-6">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Nombre</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Email</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Telefono</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">T.P.</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Rol</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Secretario asignado</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Casos activos</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Estado</th>
              <th className="text-right px-5 py-3 font-semibold text-gray-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {!staff.length ? (
              <tr>
                <td colSpan={9} className="px-5 py-10 text-center text-gray-400">
                  No hay miembros del equipo registrados
                </td>
              </tr>
            ) : (
              staff.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3 font-medium text-[#0D2340]">{s.nombre}</td>
                  <td className="px-5 py-3 text-gray-600">{s.email}</td>
                  <td className="px-5 py-3 text-gray-600">{s.telefono ?? "—"}</td>
                  <td className="px-5 py-3 text-gray-600 font-mono text-xs">{s.tarjeta_profesional ?? "—"}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                      {s.rol}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{s.supervisor_nombre}</td>
                  <td className="px-5 py-3">
                    <span className={`font-semibold ${s.casos_activos > 0 ? "text-[#1B4F9B]" : "text-gray-400"}`}>
                      {s.casos_activos}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        s.activo ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                      }`}
                    >
                      {s.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => startEdit(s)}
                      className="text-[#1B4F9B] hover:underline text-xs font-medium disabled:opacity-50"
                      disabled={loading}
                    >
                      Editar
                    </button>
                    {s.activo && (
                      <button
                        onClick={() => handleDeactivate(s.id, s.nombre)}
                        className="ml-3 text-red-500 hover:underline text-xs font-medium disabled:opacity-50"
                        disabled={loading}
                      >
                        Desactivar
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-700 mb-4">
            {editingId ? "Editar miembro" : "Agregar nuevo miembro"}
          </h3>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3 mb-4">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
              <input
                required
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
                placeholder="Nombre completo"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
                placeholder="correo@ejemplo.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
              <input
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
                placeholder="+57 300 1234567"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rol *</label>
              <select
                required
                value={form.rol}
                onChange={(e) => setForm({ ...form, rol: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
              >
                <option value="conciliador">Conciliador</option>
                <option value="secretario">Secretario</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tarjeta profesional</label>
              <input
                value={form.tarjeta_profesional}
                onChange={(e) => setForm({ ...form, tarjeta_profesional: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
                placeholder="Numero T.P."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Código interno <span className="text-gray-400 font-normal">(opcional, asignado por el centro)</span>
              </label>
              <input
                value={form.codigo_interno}
                onChange={(e) => setForm({ ...form, codigo_interno: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
                placeholder="Ej: 1789"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supervisor (conciliador)</label>
              <select
                value={form.supervisor_id}
                onChange={(e) => setForm({ ...form, supervisor_id: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
              >
                <option value="">Sin supervisor</option>
                {conciliadores.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2 flex gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="bg-[#0D2340] text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-[#0d2340dd] transition-colors disabled:opacity-50"
              >
                {loading ? "Guardando..." : editingId ? "Actualizar" : "Agregar"}
              </button>
              <button
                type="button"
                onClick={() => { resetForm(); setShowForm(false); }}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>

          {!editingId && (
            <p className="text-xs text-gray-400 mt-3">
              La contrasena por defecto sera &quot;Sgcc2026*&quot;. El usuario debera cambiarla al iniciar sesion.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
