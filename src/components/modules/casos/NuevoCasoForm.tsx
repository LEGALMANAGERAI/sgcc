"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle, Trash2 } from "lucide-react";

interface Conciliador { id: string; nombre: string }
interface Sala { id: string; nombre: string; tipo: string }

interface ParteForm {
  rol: "convocante" | "convocado";
  tipo_persona: "natural" | "juridica";
  nombres: string;
  apellidos: string;
  razon_social: string;
  tipo_doc: string;
  numero_doc: string;
  email: string;
  telefono: string;
}

const emptyParte = (rol: "convocante" | "convocado"): ParteForm => ({
  rol,
  tipo_persona: "natural",
  nombres: "",
  apellidos: "",
  razon_social: "",
  tipo_doc: "CC",
  numero_doc: "",
  email: "",
  telefono: "",
});

const MATERIAS = [
  { value: "civil", label: "Civil" },
  { value: "comercial", label: "Comercial" },
  { value: "laboral", label: "Laboral" },
  { value: "familiar", label: "Familiar" },
  { value: "consumidor", label: "Consumidor" },
  { value: "arrendamiento", label: "Arrendamiento" },
  { value: "otro", label: "Otro" },
];

interface Props {
  centerId: string;
  conciliadores: Conciliador[];
  salas: Sala[];
}

export function NuevoCasoForm({ centerId, conciliadores, salas }: Props) {
  const router = useRouter();
  const [materia, setMateria] = useState("civil");
  const [descripcion, setDescripcion] = useState("");
  const [cuantia, setCuantia] = useState("");
  const [cuantiaIndet, setCuantiaIndet] = useState(false);
  const [conciliadorId, setConciliadorId] = useState("");
  const [salaId, setSalaId] = useState("");
  const [convocante, setConvocante] = useState<ParteForm>(emptyParte("convocante"));
  const [convocados, setConvocados] = useState<ParteForm[]>([emptyParte("convocado")]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function updateConvocado(idx: number, field: keyof ParteForm, value: string) {
    setConvocados((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  }

  function addConvocado() {
    setConvocados((prev) => [...prev, emptyParte("convocado")]);
  }

  function removeConvocado(idx: number) {
    setConvocados((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/casos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        centerId,
        materia,
        descripcion,
        cuantia: cuantiaIndet ? null : cuantia ? Number(cuantia) : null,
        cuantia_indeterminada: cuantiaIndet,
        conciliador_id: conciliadorId || null,
        sala_id: salaId || null,
        partes: [convocante, ...convocados],
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Error al radicar la solicitud");
      return;
    }

    router.push(`/casos/${data.caso.id}`);
  }

  function ParteFields({
    parte,
    onChange,
    label,
  }: {
    parte: ParteForm;
    onChange: (field: keyof ParteForm, value: string) => void;
    label: string;
  }) {
    return (
      <div className="border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-gray-900 text-sm">{label}</h4>
          <select
            value={parte.tipo_persona}
            onChange={(e) => onChange("tipo_persona", e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#0D2340]"
          >
            <option value="natural">Persona natural</option>
            <option value="juridica">Persona jurídica</option>
          </select>
        </div>

        {parte.tipo_persona === "natural" ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombres *</label>
              <input
                required
                value={parte.nombres}
                onChange={(e) => onChange("nombres", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Apellidos *</label>
              <input
                required
                value={parte.apellidos}
                onChange={(e) => onChange("apellidos", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Razón social *</label>
            <input
              required
              value={parte.razon_social}
              onChange={(e) => onChange("razon_social", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
            />
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tipo doc.</label>
            <select
              value={parte.tipo_doc}
              onChange={(e) => onChange("tipo_doc", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
            >
              {parte.tipo_persona === "natural" ? (
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
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Número documento</label>
            <input
              value={parte.numero_doc}
              onChange={(e) => onChange("numero_doc", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Correo *</label>
            <input
              type="email"
              required
              value={parte.email}
              onChange={(e) => onChange("email", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
            <input
              value={parte.telefono}
              onChange={(e) => onChange("telefono", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      {/* Sección 1: Datos del asunto */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
        <h3 className="font-semibold text-gray-900">1. Datos del asunto</h3>

        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Materia *</label>
            <select
              value={materia}
              onChange={(e) => setMateria(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
            >
              {MATERIAS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cuantía</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={cuantia}
                onChange={(e) => setCuantia(e.target.value)}
                disabled={cuantiaIndet}
                placeholder="0"
                min="0"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340] disabled:bg-gray-50 disabled:text-gray-400"
              />
              <label className="flex items-center gap-1.5 text-sm text-gray-600 whitespace-nowrap cursor-pointer">
                <input
                  type="checkbox"
                  checked={cuantiaIndet}
                  onChange={(e) => setCuantiaIndet(e.target.checked)}
                  className="rounded"
                />
                Indet.
              </label>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Hechos y pretensiones *
          </label>
          <textarea
            required
            rows={5}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Describa los hechos del conflicto y las pretensiones de las partes..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340] resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Conciliador (opcional)</label>
            <select
              value={conciliadorId}
              onChange={(e) => setConciliadorId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
            >
              <option value="">Asignar después</option>
              {conciliadores.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sala (opcional)</label>
            <select
              value={salaId}
              onChange={(e) => setSalaId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
            >
              <option value="">Asignar después</option>
              {salas.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre} ({s.tipo})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Sección 2: Partes */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
        <h3 className="font-semibold text-gray-900">2. Partes</h3>

        <div>
          <p className="text-xs font-semibold text-[#0D2340] uppercase tracking-wide mb-3">Convocante</p>
          <ParteFields
            parte={convocante}
            onChange={(f, v) => setConvocante((p) => ({ ...p, [f]: v }))}
            label="Convocante"
          />
        </div>

        <div className="space-y-4">
          <p className="text-xs font-semibold text-[#0D2340] uppercase tracking-wide">
            Convocado{convocados.length > 1 ? "s" : ""}
          </p>
          {convocados.map((c, idx) => (
            <div key={idx} className="relative">
              <ParteFields
                parte={c}
                onChange={(f, v) => updateConvocado(idx, f, v)}
                label={`Convocado ${convocados.length > 1 ? idx + 1 : ""}`}
              />
              {convocados.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeConvocado(idx)}
                  className="absolute top-4 right-4 text-red-400 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addConvocado}
            className="flex items-center gap-2 text-sm text-[#1B4F9B] hover:underline"
          >
            <PlusCircle className="w-4 h-4" />
            Agregar convocado
          </button>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={loading}
          className="bg-[#0D2340] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[#0d2340dd] transition-colors disabled:opacity-60"
        >
          {loading ? "Radicando..." : "Radicar solicitud"}
        </button>
        <a href="/casos" className="text-sm text-gray-500 hover:underline">
          Cancelar
        </a>
      </div>
    </form>
  );
}
