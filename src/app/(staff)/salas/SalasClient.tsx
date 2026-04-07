"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Sala {
  id: string;
  nombre: string;
  tipo: string;
  capacidad: number | null;
  link_virtual: string | null;
  activo: boolean;
}

interface Props {
  salas: Sala[];
}

export function SalasClient({ salas }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    nombre: "",
    tipo: "presencial",
    capacidad: "",
    link_virtual: "",
  });

  function resetForm() {
    setForm({ nombre: "", tipo: "presencial", capacidad: "", link_virtual: "" });
    setEditingId(null);
    setError("");
  }

  function startEdit(sala: Sala) {
    setForm({
      nombre: sala.nombre,
      tipo: sala.tipo,
      capacidad: sala.capacidad?.toString() ?? "",
      link_virtual: sala.link_virtual ?? "",
    });
    setEditingId(sala.id);
    setShowForm(true);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const payload = {
      nombre: form.nombre,
      tipo: form.tipo,
      capacidad: form.capacidad ? parseInt(form.capacidad) : null,
      link_virtual: form.link_virtual || null,
    };

    try {
      if (editingId) {
        const res = await fetch(`/api/salas/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Error actualizando sala");
        }
      } else {
        const res = await fetch("/api/salas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Error creando sala");
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
    if (!confirm(`¿Desactivar la sala "${nombre}"?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/salas/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error desactivando sala");
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
      {/* Acciones por sala */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-700">Administrar salas</h3>
          <button
            onClick={() => { resetForm(); setShowForm(!showForm); }}
            className="bg-[#0D2340] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0d2340dd] transition-colors"
          >
            {showForm ? "Cancelar" : "+ Agregar sala"}
          </button>
        </div>

        {salas.length > 0 && (
          <div className="divide-y divide-gray-50">
            {salas.map((sala) => (
              <div key={sala.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <span className="font-medium text-gray-800">{sala.nombre}</span>
                  <span className="text-gray-400 text-xs ml-2 capitalize">({sala.tipo})</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(sala)}
                    className="text-[#1B4F9B] hover:underline text-xs font-medium"
                    disabled={loading}
                  >
                    Editar
                  </button>
                  {sala.activo && (
                    <button
                      onClick={() => handleDeactivate(sala.id, sala.nombre)}
                      className="text-red-500 hover:underline text-xs font-medium"
                      disabled={loading}
                    >
                      Desactivar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-700 mb-4">
            {editingId ? "Editar sala" : "Agregar nueva sala"}
          </h3>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3 mb-4">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input
                required
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
                placeholder="Sala de audiencias 1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
              <select
                required
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
              >
                <option value="presencial">Presencial</option>
                <option value="virtual">Virtual</option>
                <option value="hibrida">Hibrida</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Capacidad</label>
              <input
                type="number"
                min="1"
                value={form.capacidad}
                onChange={(e) => setForm({ ...form, capacidad: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
                placeholder="Numero de personas"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Link virtual</label>
              <input
                type="url"
                value={form.link_virtual}
                onChange={(e) => setForm({ ...form, link_virtual: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
                placeholder="https://meet.google.com/..."
              />
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
        </div>
      )}
    </div>
  );
}
