"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  Upload,
  FileText,
  FileSignature,
  X,
  Plus,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

/* ─── Tipos ──────────────────────────────────────────────────────────── */

interface Firmante {
  id: string;
  nombre: string;
  cedula: string;
  email: string;
  telefono: string;
  orden: number;
}

interface CasoOption {
  id: string;
  numero_radicado: string;
}

/* ─── Page ───────────────────────────────────────────────────────────── */

export default function NuevaFirmaPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estado del formulario
  const [archivo, setArchivo] = useState<File | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [caseId, setCaseId] = useState("");
  const [ordenSecuencial, setOrdenSecuencial] = useState(false);
  const [diasExpiracion, setDiasExpiracion] = useState(3);
  const [firmantes, setFirmantes] = useState<Firmante[]>([
    { id: crypto.randomUUID(), nombre: "", cedula: "", email: "", telefono: "", orden: 1 },
  ]);
  const [casos, setCasos] = useState<CasoOption[]>([]);
  const [casosLoaded, setCasosLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);

  // Cargar casos al montar (lazy)
  const loadCasos = useCallback(async () => {
    if (casosLoaded) return;
    try {
      const res = await fetch("/api/casos?select=id,numero_radicado&limit=200");
      if (res.ok) {
        const data = await res.json();
        setCasos(data.cases ?? data ?? []);
      }
    } catch {
      // silenciar
    }
    setCasosLoaded(true);
  }, [casosLoaded]);

  // Manejar archivo
  const handleFile = (file: File) => {
    if (file.type !== "application/pdf") {
      setError("Solo se permiten archivos PDF");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("El archivo no puede superar 10 MB");
      return;
    }
    setArchivo(file);
    if (!nombre) setNombre(file.name.replace(/\.pdf$/i, ""));
    setError("");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  // Firmantes
  const addFirmante = () => {
    setFirmantes((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        nombre: "",
        cedula: "",
        email: "",
        telefono: "",
        orden: prev.length + 1,
      },
    ]);
  };

  const removeFirmante = (id: string) => {
    setFirmantes((prev) => {
      const updated = prev.filter((f) => f.id !== id);
      return updated.map((f, i) => ({ ...f, orden: i + 1 }));
    });
  };

  const updateFirmante = (id: string, field: keyof Firmante, value: string | number) => {
    setFirmantes((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [field]: value } : f))
    );
  };

  // Enviar
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!archivo) {
      setError("Debes subir un archivo PDF");
      return;
    }
    if (!nombre.trim()) {
      setError("El nombre del documento es requerido");
      return;
    }
    if (firmantes.length === 0) {
      setError("Debes agregar al menos un firmante");
      return;
    }

    const firmantesInvalidos = firmantes.some(
      (f) => !f.nombre.trim() || !f.cedula.trim() || !f.email.trim()
    );
    if (firmantesInvalidos) {
      setError("Todos los firmantes deben tener nombre, c\u00e9dula y email");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("archivo", archivo);
      formData.append("nombre", nombre.trim());
      if (descripcion.trim()) formData.append("descripcion", descripcion.trim());
      if (caseId) formData.append("case_id", caseId);
      formData.append("orden_secuencial", String(ordenSecuencial));
      formData.append("dias_expiracion", String(diasExpiracion));
      formData.append("firmantes", JSON.stringify(
        firmantes.map((f) => ({
          nombre: f.nombre.trim(),
          cedula: f.cedula.trim(),
          email: f.email.trim(),
          telefono: f.telefono.trim() || null,
          orden: f.orden,
        }))
      ));

      const res = await fetch("/api/firmas", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Error al crear el documento");
        return;
      }

      router.push(`/firmas/${data.id}`);
    } catch {
      setError("Error de conexi\u00f3n. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="Nueva Firma Electr&#243;nica" subtitle="Crea un documento para firma electr\u00f3nica">
        <Link
          href="/firmas"
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </Link>
      </PageHeader>

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Archivo PDF */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Upload className="w-5 h-5 text-[#0D2340]" />
            Documento PDF
          </h2>

          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={() => setDragActive(false)}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragActive
                ? "border-[#B8860B] bg-amber-50"
                : archivo
                ? "border-green-300 bg-green-50"
                : "border-gray-300 hover:border-[#0D2340] hover:bg-gray-50"
            }`}
          >
            {archivo ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="w-8 h-8 text-green-600" />
                <div className="text-left">
                  <p className="font-medium text-gray-900">{archivo.name}</p>
                  <p className="text-xs text-gray-500">
                    {(archivo.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setArchivo(null);
                  }}
                  className="ml-4 p-1 hover:bg-red-100 rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-red-500" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">
                  Arrastra un archivo PDF aqu&#237; o haz clic para seleccionar
                </p>
                <p className="text-xs text-gray-400 mt-1">M&#225;ximo 10 MB</p>
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>

        {/* Info del documento */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Informaci&#243;n del documento</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre del documento <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Contrato de arrendamiento"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0D2340] focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripci&#243;n (opcional)
              </label>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={2}
                placeholder="Describe brevemente el documento..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0D2340] focus:border-transparent outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vincular a caso (opcional)
              </label>
              <select
                value={caseId}
                onChange={(e) => setCaseId(e.target.value)}
                onFocus={loadCasos}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0D2340] focus:border-transparent outline-none"
              >
                <option value="">Sin vincular</option>
                {casos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.numero_radicado}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Orden secuencial
                </label>
                <button
                  type="button"
                  onClick={() => setOrdenSecuencial(!ordenSecuencial)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    ordenSecuencial ? "bg-[#0D2340]" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      ordenSecuencial ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <p className="text-xs text-gray-400 mt-1">
                  {ordenSecuencial
                    ? "Los firmantes firmar\u00e1n en el orden asignado"
                    : "Los firmantes pueden firmar en cualquier orden"}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  D&#237;as de expiraci&#243;n
                </label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={diasExpiracion}
                  onChange={(e) => setDiasExpiracion(Number(e.target.value))}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0D2340] focus:border-transparent outline-none"
                />
                <p className="text-xs text-gray-400 mt-1">Entre 1 y 8 d&#237;as</p>
              </div>
            </div>
          </div>
        </div>

        {/* Firmantes */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Firmantes</h2>
            <button
              type="button"
              onClick={addFirmante}
              className="flex items-center gap-1 text-sm text-[#B8860B] hover:text-[#8a6508] font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Agregar firmante
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 text-xs font-medium text-gray-500 uppercase">
                    Orden
                  </th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-gray-500 uppercase">
                    Nombre *
                  </th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-gray-500 uppercase">
                    C&#233;dula *
                  </th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-gray-500 uppercase">
                    Email *
                  </th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-gray-500 uppercase">
                    Tel&#233;fono
                  </th>
                  <th className="py-2 px-2 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {firmantes.map((f) => (
                  <tr key={f.id}>
                    <td className="py-2 px-2">
                      <span className="inline-flex items-center justify-center w-7 h-7 bg-[#0D2340] text-white text-xs font-bold rounded-full">
                        {f.orden}
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        value={f.nombre}
                        onChange={(e) => updateFirmante(f.id, "nombre", e.target.value)}
                        placeholder="Nombre completo"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-[#0D2340] outline-none"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        value={f.cedula}
                        onChange={(e) => updateFirmante(f.id, "cedula", e.target.value)}
                        placeholder="C.C."
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-[#0D2340] outline-none"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="email"
                        value={f.email}
                        onChange={(e) => updateFirmante(f.id, "email", e.target.value)}
                        placeholder="correo@ejemplo.com"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-[#0D2340] outline-none"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="tel"
                        value={f.telefono}
                        onChange={(e) => updateFirmante(f.id, "telefono", e.target.value)}
                        placeholder="3001234567"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-[#0D2340] outline-none"
                      />
                    </td>
                    <td className="py-2 px-2">
                      {firmantes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeFirmante(f.id)}
                          className="p-1 hover:bg-red-100 rounded transition-colors"
                        >
                          <X className="w-4 h-4 text-red-500" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pb-8">
          <Link
            href="/firmas"
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="bg-[#0D2340] text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-[#0d2340dd] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <FileSignature className="w-4 h-4" />
                Crear documento
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
