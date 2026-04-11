"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle, Trash2, ChevronDown, ChevronUp, Briefcase } from "lucide-react";

interface Conciliador { id: string; nombre: string }
interface Sala { id: string; nombre: string; tipo: string }

type RolParte = "convocante" | "convocado" | "insolvente" | "acreedor";

interface ApoderadoForm {
  tiene_apoderado: boolean;
  nombre: string;
  tipo_doc: string;
  numero_doc: string;
  tarjeta_profesional: string;
  email: string;
  telefono: string;
}

interface ParteForm {
  rol: RolParte;
  tipo_persona: "natural" | "juridica";
  nombres: string;
  apellidos: string;
  razon_social: string;
  tipo_doc: string;
  numero_doc: string;
  email: string;
  telefono: string;
  apoderado: ApoderadoForm;
  poderFile: File | null;
}

const emptyApoderado = (): ApoderadoForm => ({
  tiene_apoderado: false,
  nombre: "",
  tipo_doc: "CC",
  numero_doc: "",
  tarjeta_profesional: "",
  email: "",
  telefono: "",
});

const emptyParte = (rol: RolParte): ParteForm => ({
  rol,
  tipo_persona: "natural",
  nombres: "",
  apellidos: "",
  razon_social: "",
  tipo_doc: "CC",
  numero_doc: "",
  email: "",
  telefono: "",
  apoderado: emptyApoderado(),
  poderFile: null,
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
  const [tipoTramite, setTipoTramite] = useState("conciliacion");
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

  function updateConvocadoApoderado(idx: number, field: keyof ApoderadoForm, value: string | boolean) {
    setConvocados((prev) => prev.map((c, i) => (i === idx ? { ...c, apoderado: { ...c.apoderado, [field]: value } } : c)));
  }

  function updateConvocadoPoder(idx: number, file: File | null) {
    setConvocados((prev) => prev.map((c, i) => (i === idx ? { ...c, poderFile: file } : c)));
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

    const allPartes = tipoTramite === "insolvencia"
      ? [{ ...convocante, rol: "convocante" as const }, ...convocados.map((c) => ({ ...c, rol: "convocado" as const }))]
      : [convocante, ...convocados];

    // Preparar datos de partes sin archivos para JSON
    const partesData = allPartes.map((p) => ({
      rol: p.rol,
      tipo_persona: p.tipo_persona,
      nombres: p.nombres,
      apellidos: p.apellidos,
      razon_social: p.razon_social,
      tipo_doc: p.tipo_doc,
      numero_doc: p.numero_doc,
      email: p.email,
      telefono: p.telefono,
      apoderado: p.apoderado.tiene_apoderado ? {
        nombre: p.apoderado.nombre,
        tipo_doc: p.apoderado.tipo_doc,
        numero_doc: p.apoderado.numero_doc,
        tarjeta_profesional: p.apoderado.tarjeta_profesional,
        email: p.apoderado.email,
        telefono: p.apoderado.telefono,
      } : null,
    }));

    // Usar FormData para incluir archivos de poder
    const fd = new FormData();
    fd.append("data", JSON.stringify({
      centerId,
      tipo_tramite: tipoTramite,
      materia: tipoTramite === "insolvencia" ? "civil" : materia,
      descripcion,
      cuantia: cuantiaIndet ? null : cuantia ? Number(cuantia) : null,
      cuantia_indeterminada: cuantiaIndet,
      conciliador_id: conciliadorId || null,
      sala_id: salaId || null,
      partes: partesData,
    }));

    // Adjuntar archivos de poder con índice
    allPartes.forEach((p, idx) => {
      if (p.poderFile) {
        fd.append(`poder_${idx}`, p.poderFile);
      }
    });

    const res = await fetch("/api/casos", {
      method: "POST",
      body: fd,
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
    onApoderadoChange,
    onPoderFile,
    label,
  }: {
    parte: ParteForm;
    onChange: (field: keyof ParteForm, value: string) => void;
    onApoderadoChange: (field: keyof ApoderadoForm, value: string | boolean) => void;
    onPoderFile: (file: File | null) => void;
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

        {/* Apoderado */}
        <div className="border-t border-gray-100 pt-4 mt-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={parte.apoderado.tiene_apoderado}
              onChange={(e) => onApoderadoChange("tiene_apoderado", e.target.checked)}
              className="rounded border-gray-300 text-[#1B4F9B] focus:ring-[#1B4F9B]"
            />
            <span className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
              <Briefcase className="w-3.5 h-3.5" />
              Tiene apoderado
            </span>
          </label>

          {parte.apoderado.tiene_apoderado && (
            <div className="mt-3 bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nombre apoderado *</label>
                  <input
                    value={parte.apoderado.nombre}
                    onChange={(e) => onApoderadoChange("nombre", e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tarjeta profesional</label>
                  <input
                    value={parte.apoderado.tarjeta_profesional}
                    onChange={(e) => onApoderadoChange("tarjeta_profesional", e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tipo doc.</label>
                  <select
                    value={parte.apoderado.tipo_doc}
                    onChange={(e) => onApoderadoChange("tipo_doc", e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
                  >
                    <option value="CC">C.C.</option>
                    <option value="CE">C.E.</option>
                    <option value="Pasaporte">Pasaporte</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Número documento *</label>
                  <input
                    value={parte.apoderado.numero_doc}
                    onChange={(e) => onApoderadoChange("numero_doc", e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email apoderado</label>
                  <input
                    type="email"
                    value={parte.apoderado.email}
                    onChange={(e) => onApoderadoChange("email", e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono apoderado</label>
                  <input
                    value={parte.apoderado.telefono}
                    onChange={(e) => onApoderadoChange("telefono", e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Poder (PDF)</label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => onPoderFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#0D2340] file:text-white hover:file:bg-[#0D2340]/90 file:cursor-pointer"
                />
                {parte.poderFile && (
                  <p className="text-xs text-green-600 mt-1">Archivo: {parte.poderFile.name}</p>
                )}
              </div>
            </div>
          )}
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de trámite *</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { value: "conciliacion", label: "Conciliación", icon: "⚖️" },
              { value: "insolvencia", label: "Insolvencia", icon: "📉" },
              { value: "acuerdo_apoyo", label: "Acuerdo de Apoyo", icon: "🤝" },
              { value: "arbitraje_ejecutivo", label: "Arbitraje Ejecutivo", icon: "🏛️" },
            ].map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTipoTramite(t.value)}
                className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                  tipoTramite === t.value
                    ? "border-[#1B4F9B] bg-[#1B4F9B]/5 text-[#1B4F9B]"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                <span className="text-xl">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5">
          {tipoTramite !== "insolvencia" && (
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
          )}
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

        {tipoTramite === "insolvencia" ? (
          <>
            {/* Insolvente */}
            <div>
              <p className="text-xs font-semibold text-[#0D2340] uppercase tracking-wide mb-1">
                Insolvente
              </p>
              <p className="text-xs text-gray-500 mb-3">
                Persona natural no comerciante o pequeño comerciante
              </p>
              <ParteFields
                parte={convocante}
                onChange={(f, v) => setConvocante((p) => ({ ...p, [f]: v }))}
                onApoderadoChange={(f, v) => setConvocante((p) => ({ ...p, apoderado: { ...p.apoderado, [f]: v } }))}
                onPoderFile={(file) => setConvocante((p) => ({ ...p, poderFile: file }))}
                label="Insolvente"
              />
            </div>

            {/* Acreedores */}
            <div className="space-y-4">
              <p className="text-xs font-semibold text-[#0D2340] uppercase tracking-wide">
                Acreedor{convocados.length > 1 ? "es" : ""}
              </p>
              {convocados.map((c, idx) => (
                <div key={idx} className="relative">
                  <ParteFields
                    parte={c}
                    onChange={(f, v) => updateConvocado(idx, f, v)}
                    onApoderadoChange={(f, v) => updateConvocadoApoderado(idx, f, v)}
                    onPoderFile={(file) => updateConvocadoPoder(idx, file)}
                    label={`Acreedor ${convocados.length > 1 ? idx + 1 : ""}`}
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
                Agregar acreedor
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Convocante */}
            <div>
              <p className="text-xs font-semibold text-[#0D2340] uppercase tracking-wide mb-3">Convocante</p>
              <ParteFields
                parte={convocante}
                onChange={(f, v) => setConvocante((p) => ({ ...p, [f]: v }))}
                onApoderadoChange={(f, v) => setConvocante((p) => ({ ...p, apoderado: { ...p.apoderado, [f]: v } }))}
                onPoderFile={(file) => setConvocante((p) => ({ ...p, poderFile: file }))}
                label="Convocante"
              />
            </div>

            {/* Convocados */}
            <div className="space-y-4">
              <p className="text-xs font-semibold text-[#0D2340] uppercase tracking-wide">
                Convocado{convocados.length > 1 ? "s" : ""}
              </p>
              {convocados.map((c, idx) => (
                <div key={idx} className="relative">
                  <ParteFields
                    parte={c}
                    onChange={(f, v) => updateConvocado(idx, f, v)}
                    onApoderadoChange={(f, v) => updateConvocadoApoderado(idx, f, v)}
                    onPoderFile={(file) => updateConvocadoPoder(idx, file)}
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
          </>
        )}
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={loading}
          className="bg-[#0D2340] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[#0d2340dd] transition-colors disabled:opacity-60"
        >
          {loading ? "Creando..." : "Crear caso"}
        </button>
        <a href="/casos" className="text-sm text-gray-500 hover:underline">
          Cancelar
        </a>
      </div>
    </form>
  );
}
