"use client";

import { useEffect, useState } from "react";

interface PerfilData {
  id: string;
  tipo_persona: string;
  nombres: string | null;
  apellidos: string | null;
  tipo_doc: string | null;
  numero_doc: string | null;
  razon_social: string | null;
  nit_empresa: string | null;
  email: string;
  telefono: string | null;
  direccion: string | null;
  ciudad: string | null;
}

export default function PerfilPage() {
  const [perfil, setPerfil] = useState<PerfilData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Formulario
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [ciudad, setCiudad] = useState("");

  useEffect(() => {
    fetchPerfil();
  }, []);

  async function fetchPerfil() {
    try {
      const res = await fetch("/api/partes/perfil");
      if (!res.ok) {
        setError("Error al cargar el perfil");
        return;
      }
      const data = await res.json();
      setPerfil(data);
      setNombres(data.nombres ?? "");
      setApellidos(data.apellidos ?? "");
      setTelefono(data.telefono ?? "");
      setDireccion(data.direccion ?? "");
      setCiudad(data.ciudad ?? "");
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/partes/perfil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombres, apellidos, telefono, direccion, ciudad }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Error al actualizar el perfil");
        return;
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Error de conexión");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-[#1B4F9B] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!perfil) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-600">{error ?? "No se pudo cargar el perfil"}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-[#0D2340] mb-6">Mi Perfil</h1>

      {/* Datos de solo lectura */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Datos de identificación
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500 block">Correo electrónico</span>
            <span className="font-medium text-gray-800">{perfil.email}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Tipo de persona</span>
            <span className="font-medium text-gray-800 capitalize">
              {perfil.tipo_persona}
            </span>
          </div>
          {perfil.tipo_doc && (
            <div>
              <span className="text-gray-500 block">Tipo de documento</span>
              <span className="font-medium text-gray-800">{perfil.tipo_doc}</span>
            </div>
          )}
          {perfil.numero_doc && (
            <div>
              <span className="text-gray-500 block">Número de documento</span>
              <span className="font-medium text-gray-800">{perfil.numero_doc}</span>
            </div>
          )}
          {perfil.razon_social && (
            <div>
              <span className="text-gray-500 block">Razón social</span>
              <span className="font-medium text-gray-800">
                {perfil.razon_social}
              </span>
            </div>
          )}
          {perfil.nit_empresa && (
            <div>
              <span className="text-gray-500 block">NIT</span>
              <span className="font-medium text-gray-800">
                {perfil.nit_empresa}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Formulario editable */}
      <form onSubmit={handleSubmit}>
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Datos de contacto
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="nombres"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Nombres
              </label>
              <input
                id="nombres"
                type="text"
                value={nombres}
                onChange={(e) => setNombres(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1B4F9B]/30 focus:border-[#1B4F9B] outline-none transition-colors"
              />
            </div>
            <div>
              <label
                htmlFor="apellidos"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Apellidos
              </label>
              <input
                id="apellidos"
                type="text"
                value={apellidos}
                onChange={(e) => setApellidos(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1B4F9B]/30 focus:border-[#1B4F9B] outline-none transition-colors"
              />
            </div>
            <div>
              <label
                htmlFor="telefono"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Teléfono
              </label>
              <input
                id="telefono"
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1B4F9B]/30 focus:border-[#1B4F9B] outline-none transition-colors"
              />
            </div>
            <div>
              <label
                htmlFor="ciudad"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Ciudad
              </label>
              <input
                id="ciudad"
                type="text"
                value={ciudad}
                onChange={(e) => setCiudad(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1B4F9B]/30 focus:border-[#1B4F9B] outline-none transition-colors"
              />
            </div>
            <div className="sm:col-span-2">
              <label
                htmlFor="direccion"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Dirección
              </label>
              <input
                id="direccion"
                type="text"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1B4F9B]/30 focus:border-[#1B4F9B] outline-none transition-colors"
              />
            </div>
          </div>

          {/* Mensajes */}
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          {success && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-600">
                Perfil actualizado exitosamente.
              </p>
            </div>
          )}

          {/* Botón */}
          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-[#0D2340] text-white text-sm font-medium rounded-lg hover:bg-[#0D2340]/90 transition-colors disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </section>
      </form>
    </div>
  );
}
