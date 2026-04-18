"use client";

import { useState } from "react";
import { X, Loader2, AlertCircle, Upload } from "lucide-react";

interface CambiarApoderadoModalProps {
  caseId: string;
  partyId: string;
  parteNombre: string;
  apoderadoActualNombre?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

type MotivoCambio = "renuncia" | "revocatoria" | "sustitucion";

const MOTIVO_LABEL: Record<MotivoCambio, string> = {
  renuncia: "Renuncia del apoderado actual",
  revocatoria: "Revocatoria del poder",
  sustitucion: "Sustitución",
};

export function CambiarApoderadoModal({
  caseId,
  partyId,
  parteNombre,
  apoderadoActualNombre,
  onClose,
  onSuccess,
}: CambiarApoderadoModalProps) {
  const [motivo, setMotivo] = useState<MotivoCambio>("sustitucion");
  const [nombre, setNombre] = useState("");
  const [tipoDoc, setTipoDoc] = useState<"CC" | "CE" | "Pasaporte" | "PPT" | "otro">("CC");
  const [numeroDoc, setNumeroDoc] = useState("");
  const [tarjetaProfesional, setTarjetaProfesional] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [poderFile, setPoderFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!nombre.trim() || !numeroDoc.trim()) {
      setError("Nombre y número de documento son obligatorios");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        party_id: partyId,
        motivo_cambio: motivo,
        attorney: {
          nombre: nombre.trim(),
          tipo_doc: tipoDoc,
          numero_doc: numeroDoc.trim(),
          tarjeta_profesional: tarjetaProfesional.trim() || null,
          email: email.trim() || null,
          telefono: telefono.trim() || null,
        },
      };

      const formData = new FormData();
      formData.append("data", JSON.stringify(payload));
      if (poderFile) formData.append("poderFile", poderFile);

      const res = await fetch(`/api/expediente/${caseId}/apoderados`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Error registrando cambio de apoderado");
      }

      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message ?? "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <div>
            <h3 className="text-base font-bold text-[#0D2340]">Cambiar apoderado</h3>
            <p className="text-xs text-gray-500">
              {parteNombre}
              {apoderadoActualNombre && (
                <span className="text-gray-400"> · Actual: {apoderadoActualNombre}</span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Motivo del cambio *
            </label>
            <div className="grid grid-cols-1 gap-2">
              {(Object.keys(MOTIVO_LABEL) as MotivoCambio[]).map((m) => (
                <label
                  key={m}
                  className={`flex items-center gap-2 p-2.5 border rounded-lg cursor-pointer transition-colors ${
                    motivo === m
                      ? "border-[#1B4F9B] bg-blue-50"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    checked={motivo === m}
                    onChange={() => setMotivo(m)}
                    className="text-[#1B4F9B]"
                  />
                  <span className="text-sm text-gray-700">{MOTIVO_LABEL[m]}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre completo *
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F9B]"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo doc *
              </label>
              <select
                value={tipoDoc}
                onChange={(e) => setTipoDoc(e.target.value as any)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F9B]"
              >
                <option value="CC">CC</option>
                <option value="CE">CE</option>
                <option value="Pasaporte">Pasaporte</option>
                <option value="PPT">PPT</option>
                <option value="otro">Otro</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Número doc *
              </label>
              <input
                type="text"
                value={numeroDoc}
                onChange={(e) => setNumeroDoc(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F9B]"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tarjeta profesional
              </label>
              <input
                type="text"
                value={tarjetaProfesional}
                onChange={(e) => setTarjetaProfesional(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F9B]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F9B]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono
              </label>
              <input
                type="text"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F9B]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Poder (PDF, opcional)
            </label>
            <label className="flex items-center gap-2 border border-dashed border-gray-300 rounded-lg px-3 py-3 text-sm text-gray-500 cursor-pointer hover:bg-gray-50">
              <Upload className="w-4 h-4" />
              <span>{poderFile?.name ?? "Seleccionar PDF del poder"}</span>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setPoderFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </label>
            {!poderFile && (
              <p className="text-[11px] text-gray-400 mt-1">
                Si no se adjunta, el poder queda pendiente de verificación por admin.
              </p>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#0D2340] hover:bg-[#1B4F9B] rounded-lg disabled:opacity-50"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? "Guardando..." : "Registrar cambio"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
