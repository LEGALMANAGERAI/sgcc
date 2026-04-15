"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Trash2,
  Loader2,
  Save,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Vote,
  FileText,
  Users,
  Calculator,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
} from "lucide-react";
import type { SgccAcreencia, VotoInsolvencia, ClaseCredito } from "@/types";
import { Handshake } from "lucide-react";

/* ─── Props ─────────────────────────────────────────────────────────── */

interface Props {
  caseId: string;
  acreedoresIniciales: SgccAcreencia[];
  partesConvocados: Array<{ id: string; nombre: string; documento: string }>;
}

/* ─── Helpers ─────────────────────────────────────────────────────── */

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

const conceptos = [
  { key: "capital", label: "Capital" },
  { key: "intereses_corrientes", label: "Int. corrientes" },
  { key: "intereses_moratorios", label: "Int. moratorios" },
  { key: "seguros", label: "Seguros" },
  { key: "otros", label: "Otros conceptos" },
] as const;

type ConceptoKey = (typeof conceptos)[number]["key"];

const CLASES: { value: ClaseCredito; label: string; color: string }[] = [
  { value: "primera", label: "1ra Clase", color: "bg-red-100 text-red-700" },
  { value: "segunda", label: "2da Clase", color: "bg-orange-100 text-orange-700" },
  { value: "tercera", label: "3ra Clase", color: "bg-yellow-100 text-yellow-700" },
  { value: "cuarta", label: "4ta Clase", color: "bg-blue-100 text-blue-700" },
  { value: "quinta", label: "5ta Clase", color: "bg-gray-100 text-gray-700" },
];

/** Cálculo PMT (cuota mensual) */
function calcularCuotaPMT(capital: number, tasaAnual: number, meses: number): number {
  if (capital <= 0 || meses <= 0) return 0;
  if (tasaAnual === 0) return capital / meses;
  const r = tasaAnual / 12;
  const factor = Math.pow(1 + r, meses);
  return capital * (r * factor) / (factor - 1);
}

/* ─── Componente ─────────────────────────────────────────────────── */

export function HerramientaAcreencias({ caseId, acreedoresIniciales, partesConvocados }: Props) {
  const [acreencias, setAcreencias] = useState<SgccAcreencia[]>(acreedoresIniciales);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Propuesta
  const [propuestas, setPropuestas] = useState<any[]>([]);
  const [showPropForm, setShowPropForm] = useState(false);
  const [propForm, setPropForm] = useState({ titulo: "", descripcion: "", plazo_meses: "", tasa_interes: "", periodo_gracia_meses: "" });

  // Votación
  const [votos, setVotos] = useState<Record<string, VotoInsolvencia>>({});
  const [votacionResult, setVotacionResult] = useState<any>(null);

  // Secciones expandidas
  // Acuerdo de pagos
  const [acuerdo, setAcuerdo] = useState<any>(null);
  const [acuerdoForm, setAcuerdoForm] = useState({
    tasa_interes_anual: "0",
    plazo_meses: "12",
    periodo_gracia_meses: "0",
    fecha_inicio_pago: "",
    notas: "",
  });

  const [seccion, setSeccion] = useState<"acreencias" | "definitiva" | "propuesta" | "votacion" | "acuerdo">("acreencias");
  const [fullscreen, setFullscreen] = useState(false);

  const flash = useCallback((type: "ok" | "error", msg: string) => {
    if (type === "ok") { setSuccess(msg); setError(""); }
    else { setError(msg); setSuccess(""); }
    setTimeout(() => { setSuccess(""); setError(""); }, 4000);
  }, []);

  // Cargar propuestas y acuerdo
  useEffect(() => {
    fetchPropuestas();
    fetchAcuerdo();
  }, []);

  async function fetchPropuestas() {
    const res = await fetch(`/api/expediente/${caseId}/propuesta`);
    if (res.ok) {
      const data = await res.json();
      setPropuestas(data);
      // Si hay propuesta en votación, cargar votos existentes
      const enVotacion = data.find((p: any) => p.estado === "en_votacion");
      if (enVotacion?.votos) {
        const votosMap: Record<string, VotoInsolvencia> = {};
        for (const v of enVotacion.votos) {
          votosMap[v.acreencia_id] = v.voto;
        }
        setVotos(votosMap);
      }
    }
  }

  /* ─── CRUD Acreencias ────────────────────────────────────────────── */

  async function addAcreencia() {
    setSaving("add");
    try {
      const res = await fetch(`/api/expediente/${caseId}/acreencias`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acreedor_nombre: "" }),
      });
      if (!res.ok) { flash("error", "Error al crear"); return; }
      const data = await res.json();
      setAcreencias((prev) => [...prev, data]);
    } finally { setSaving(null); }
  }

  async function updateAcreencia(acreenciaId: string, campos: Record<string, any>) {
    setSaving(acreenciaId);
    try {
      const res = await fetch(`/api/expediente/${caseId}/acreencias`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acreencia_id: acreenciaId, ...campos }),
      });
      if (!res.ok) { flash("error", "Error al guardar"); return; }
      const data = await res.json();
      setAcreencias(data);
    } finally { setSaving(null); }
  }

  async function deleteAcreencia(acreenciaId: string) {
    if (!confirm("¿Eliminar este acreedor?")) return;
    setSaving(acreenciaId);
    try {
      const res = await fetch(`/api/expediente/${caseId}/acreencias`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acreencia_id: acreenciaId }),
      });
      if (res.ok) setAcreencias((prev) => prev.filter((a) => a.id !== acreenciaId));
    } finally { setSaving(null); }
  }

  /* ─── Propuesta ──────────────────────────────────────────────────── */

  async function crearPropuesta() {
    if (!propForm.titulo.trim() || !propForm.descripcion.trim()) {
      flash("error", "Título y descripción son requeridos");
      return;
    }
    setSaving("prop");
    try {
      const res = await fetch(`/api/expediente/${caseId}/propuesta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...propForm,
          plazo_meses: propForm.plazo_meses ? parseInt(propForm.plazo_meses) : null,
          periodo_gracia_meses: propForm.periodo_gracia_meses ? parseInt(propForm.periodo_gracia_meses) : 0,
        }),
      });
      if (!res.ok) { flash("error", "Error al crear propuesta"); return; }
      await fetchPropuestas();
      setShowPropForm(false);
      setPropForm({ titulo: "", descripcion: "", plazo_meses: "", tasa_interes: "", periodo_gracia_meses: "" });
      flash("ok", "Propuesta creada");
    } finally { setSaving(null); }
  }

  async function cambiarEstadoPropuesta(propuestaId: string, estado: string, modoVotacion?: string) {
    setSaving("prop-" + propuestaId);
    try {
      const body: any = { propuesta_id: propuestaId, estado };
      if (modoVotacion) body.modo_votacion = modoVotacion;
      const res = await fetch(`/api/expediente/${caseId}/propuesta`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await fetchPropuestas();
        flash("ok", estado === "en_votacion"
          ? `Votación abierta en modo ${modoVotacion === "link" ? "link (emails enviados)" : modoVotacion === "dual" ? "dual (emails + manual)" : "manual"}`
          : `Propuesta ${estado}`);
      }
    } finally { setSaving(null); }
  }

  /* ─── Votación ───────────────────────────────────────────────────── */

  async function registrarVoto(propuestaId: string, acreenciaId: string, voto: VotoInsolvencia) {
    setSaving(`voto-${acreenciaId}`);
    try {
      const res = await fetch(`/api/expediente/${caseId}/votacion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propuesta_id: propuestaId, acreencia_id: acreenciaId, voto }),
      });
      if (res.ok) {
        const data = await res.json();
        setVotos((prev) => ({ ...prev, [acreenciaId]: voto }));
        setVotacionResult(data);
      }
    } finally { setSaving(null); }
  }

  /* ─── Acuerdo de pagos ───────────────────────────────────────────── */

  async function fetchAcuerdo() {
    const res = await fetch(`/api/expediente/${caseId}/acuerdo`);
    if (res.ok) {
      const data = await res.json();
      if (data) setAcuerdo(data);
    }
  }

  async function generarAcuerdo() {
    const propAprobada = propuestas.find((p) => p.estado === "aprobada");
    setSaving("acuerdo");
    try {
      const res = await fetch(`/api/expediente/${caseId}/acuerdo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propuesta_id: propAprobada?.id || null,
          tasa_interes_anual: parseFloat(acuerdoForm.tasa_interes_anual) || 0,
          plazo_meses: parseInt(acuerdoForm.plazo_meses) || 12,
          periodo_gracia_meses: parseInt(acuerdoForm.periodo_gracia_meses) || 0,
          fecha_inicio_pago: acuerdoForm.fecha_inicio_pago || null,
          notas: acuerdoForm.notas || null,
        }),
      });
      if (!res.ok) { flash("error", "Error al generar acuerdo"); return; }
      const data = await res.json();
      setAcuerdo(data);
      flash("ok", "Acuerdo de pagos generado");
    } finally { setSaving(null); }
  }

  /* ─── Cálculos ───────────────────────────────────────────────────── */

  const totalSol = acreencias.reduce((s, a) => s + Number(a.sol_capital) + Number(a.sol_intereses_corrientes) + Number(a.sol_intereses_moratorios) + Number(a.sol_seguros) + Number(a.sol_otros), 0);
  const totalAcr = acreencias.reduce((s, a) => s + Number(a.acr_capital) + Number(a.acr_intereses_corrientes) + Number(a.acr_intereses_moratorios) + Number(a.acr_seguros) + Number(a.acr_otros), 0);
  const totalCon = acreencias.reduce((s, a) => s + Number(a.con_capital) + Number(a.con_intereses_corrientes) + Number(a.con_intereses_moratorios) + Number(a.con_seguros) + Number(a.con_otros), 0);
  const totalCapitalCon = acreencias.reduce((s, a) => s + Number(a.con_capital), 0);
  const pequenosCount = acreencias.filter((a) => a.es_pequeno_acreedor).length;

  const propEnVotacion = propuestas.find((p) => p.estado === "en_votacion");

  /* ─── Render ─────────────────────────────────────────────────────── */

  return (
    <div className={fullscreen ? "fixed inset-0 z-50 bg-white overflow-auto p-6 space-y-4" : "space-y-4"}>
      {/* Toggle pantalla completa */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setFullscreen((v) => !v)}
          className="inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-[#0D2340] border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
          title={fullscreen ? "Salir de pantalla completa" : "Pantalla completa (modo audiencia)"}
        >
          {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          {fullscreen ? "Salir pantalla completa" : "Pantalla completa"}
        </button>
      </div>
      {/* Mensajes */}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm">{success}</div>}

      {/* Stats rápidas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-500">Acreedores</p>
          <p className="text-xl font-bold text-[#0D2340]">{acreencias.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-500">Total conciliado</p>
          <p className="text-lg font-bold text-[#0D2340]">{fmt(totalCon)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-500">Capital conciliado</p>
          <p className="text-lg font-bold text-[#1B4F9B]">{fmt(totalCapitalCon)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-500">Pequeños acreedores</p>
          <p className="text-xl font-bold text-amber-600">{pequenosCount} <span className="text-xs font-normal text-gray-400">(&le;5%)</span></p>
        </div>
      </div>

      {/* ═══ SECCIÓN 1: Relación de acreencias ═══ */}
      <SectionHeader
        icon={<Users className="w-4 h-4" />}
        title="Relación de acreencias"
        subtitle="Registre los valores reportados por el deudor y cada acreedor"
        active={seccion === "acreencias"}
        onClick={() => setSeccion(seccion === "acreencias" ? "definitiva" : "acreencias")}
      />

      {seccion === "acreencias" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 min-w-[180px]">Acreedor</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-600 min-w-[90px]">Tipo</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-600 min-w-[100px]">Documento</th>
                  <th className="px-2 py-2 text-center font-semibold text-gray-600">Clase</th>
                  <th className="px-2 py-2 text-center font-semibold text-gray-600">Días mora</th>
                  {conceptos.map((c) => (
                    <th key={c.key} colSpan={2} className="px-2 py-2 text-center font-semibold text-gray-600 border-l border-gray-200">
                      {c.label}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-center font-semibold text-gray-600 border-l border-gray-200">Acciones</th>
                </tr>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th colSpan={5}></th>
                  {conceptos.map((c) => (
                    <Fragment key={c.key}>
                      <th className="px-2 py-1 text-center text-[10px] text-blue-600 font-medium border-l border-gray-200">Solicitud</th>
                      <th className="px-2 py-1 text-center text-[10px] text-purple-600 font-medium">Acreedor</th>
                    </Fragment>
                  ))}
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {acreencias.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50/50">
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        defaultValue={a.acreedor_nombre}
                        placeholder="Nombre del acreedor"
                        onBlur={(e) => {
                          if (e.target.value !== a.acreedor_nombre)
                            updateAcreencia(a.id, { acreedor_nombre: e.target.value });
                        }}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#1B4F9B] focus:border-[#1B4F9B] outline-none"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        defaultValue={a.acreedor_tipo ?? "natural"}
                        onChange={(e) => updateAcreencia(a.id, { acreedor_tipo: e.target.value })}
                        className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs focus:ring-1 focus:ring-[#1B4F9B] outline-none"
                      >
                        <option value="natural">Persona natural</option>
                        <option value="juridica">Persona jurídica</option>
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        defaultValue={a.acreedor_documento ?? ""}
                        onBlur={(e) => updateAcreencia(a.id, { acreedor_documento: e.target.value })}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#1B4F9B] outline-none"
                        placeholder={a.acreedor_tipo === "juridica" ? "NIT" : "CC/CE"}
                      />
                    </td>
                    <td className="px-1 py-2">
                      <select
                        defaultValue={a.clase_credito ?? "quinta"}
                        onChange={(e) => updateAcreencia(a.id, { clase_credito: e.target.value })}
                        className="border border-gray-200 rounded px-1.5 py-1 text-xs focus:ring-1 focus:ring-[#1B4F9B] outline-none w-20"
                      >
                        {CLASES.map((cl) => (
                          <option key={cl.value} value={cl.value}>{cl.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-1 py-2">
                      <input
                        type="number"
                        defaultValue={a.dias_mora ?? 0}
                        onBlur={(e) => updateAcreencia(a.id, { dias_mora: parseInt(e.target.value) || 0 })}
                        className={`w-16 border rounded px-1.5 py-1 text-xs text-right focus:ring-1 focus:ring-[#1B4F9B] outline-none ${
                          (a.dias_mora ?? 0) > 90 ? "border-green-400 bg-green-50 text-green-700" : "border-gray-200"
                        }`}
                      />
                    </td>
                    {conceptos.map((c) => (
                      <Fragment key={c.key}>
                        <td className="px-1 py-2 border-l border-gray-100">
                          <MoneyInput
                            value={Number((a as any)[`sol_${c.key}`]) || 0}
                            onSave={(v) => updateAcreencia(a.id, { [`sol_${c.key}`]: v })}
                          />
                        </td>
                        <td className="px-1 py-2">
                          <MoneyInput
                            value={Number((a as any)[`acr_${c.key}`]) || 0}
                            onSave={(v) => updateAcreencia(a.id, { [`acr_${c.key}`]: v })}
                          />
                        </td>
                      </Fragment>
                    ))}
                    <td className="px-2 py-2 text-center border-l border-gray-100">
                      <button
                        onClick={() => deleteAcreencia(a.id)}
                        disabled={saving === a.id}
                        className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
                      >
                        {saving === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-100">
            <button
              onClick={addAcreencia}
              disabled={saving === "add"}
              className="flex items-center gap-1.5 text-sm text-[#1B4F9B] font-medium hover:underline disabled:opacity-50"
            >
              {saving === "add" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Agregar acreedor
            </button>
          </div>
        </div>
      )}

      {/* ═══ SECCIÓN 2: Relación definitiva de acreencias ═══ */}
      <SectionHeader
        icon={<Calculator className="w-4 h-4" />}
        title="Relación definitiva de acreencias"
        subtitle="Valores conciliados, porcentaje de voto y pequeños acreedores"
        active={seccion === "definitiva"}
        onClick={() => setSeccion(seccion === "definitiva" ? "acreencias" : "definitiva")}
      />

      {seccion === "definitiva" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#0D2340] text-white">
                  <th className="px-3 py-2.5 text-left font-semibold min-w-[180px]">Acreedor</th>
                  {conceptos.map((c) => (
                    <th key={c.key} className="px-2 py-2.5 text-right font-semibold">{c.label}</th>
                  ))}
                  <th className="px-2 py-2.5 text-right font-semibold">Total</th>
                  <th className="px-2 py-2.5 text-center font-semibold">Fecha conc.</th>
                  <th className="px-2 py-2.5 text-center font-semibold">% Voto</th>
                  <th className="px-2 py-2.5 text-center font-semibold">Pequeño</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {acreencias.map((a) => {
                  const totalRow = Number(a.con_capital) + Number(a.con_intereses_corrientes) + Number(a.con_intereses_moratorios) + Number(a.con_seguros) + Number(a.con_otros);
                  return (
                    <tr key={a.id} className={`hover:bg-gray-50/50 ${a.es_pequeno_acreedor ? "bg-amber-50/30" : ""}`}>
                      <td className="px-3 py-2 font-medium text-gray-900">
                        {a.acreedor_nombre}
                        {a.acreedor_documento && <span className="text-gray-400 ml-1">({a.acreedor_documento})</span>}
                      </td>
                      {conceptos.map((c) => (
                        <td key={c.key} className="px-1 py-2 text-right">
                          <MoneyInput
                            value={Number((a as any)[`con_${c.key}`]) || 0}
                            onSave={(v) => updateAcreencia(a.id, { [`con_${c.key}`]: v })}
                          />
                        </td>
                      ))}
                      <td className="px-2 py-2 text-right font-semibold text-[#0D2340]">
                        {fmt(totalRow)}
                      </td>
                      <td className="px-1 py-2 text-center">
                        <input
                          type="date"
                          defaultValue={a.fecha_conciliacion ?? ""}
                          onBlur={(e) => updateAcreencia(a.id, { fecha_conciliacion: e.target.value || null })}
                          className="border border-gray-200 rounded px-1.5 py-1 text-xs focus:ring-1 focus:ring-[#1B4F9B] outline-none w-28"
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <span className="font-bold text-[#1B4F9B]">{pct(a.porcentaje_voto)}</span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        {a.es_pequeno_acreedor ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">Sí</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-[#0D2340] font-bold text-xs">
                  <td className="px-3 py-2 text-gray-900">TOTALES</td>
                  {conceptos.map((c) => {
                    const total = acreencias.reduce((s, a) => s + (Number((a as any)[`con_${c.key}`]) || 0), 0);
                    return <td key={c.key} className="px-2 py-2 text-right text-gray-900">{fmt(total)}</td>;
                  })}
                  <td className="px-2 py-2 text-right text-[#0D2340]">{fmt(totalCon)}</td>
                  <td></td>
                  <td className="px-2 py-2 text-center text-[#0D2340]">100%</td>
                  <td className="px-2 py-2 text-center text-amber-600">{pequenosCount}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ═══ SECCIÓN 3: Propuesta de pago ═══ */}
      <SectionHeader
        icon={<FileText className="w-4 h-4" />}
        title="Propuesta de pago"
        subtitle="Estructure la mejor propuesta para socializar con los acreedores"
        active={seccion === "propuesta"}
        onClick={() => setSeccion(seccion === "propuesta" ? "definitiva" : "propuesta")}
      />

      {seccion === "propuesta" && (
        <div className="space-y-4">
          {/* Propuestas existentes */}
          {propuestas.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h4 className="font-semibold text-[#0D2340]">{p.titulo}</h4>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium mt-1 ${
                    p.estado === "aprobada" ? "bg-green-100 text-green-700" :
                    p.estado === "rechazada" ? "bg-red-100 text-red-700" :
                    p.estado === "en_votacion" ? "bg-blue-100 text-blue-700" :
                    p.estado === "socializada" ? "bg-purple-100 text-purple-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>
                    {p.estado.replace("_", " ")}
                  </span>
                </div>
                <div className="flex gap-2">
                  {p.estado === "borrador" && (
                    <button
                      onClick={() => cambiarEstadoPropuesta(p.id, "socializada")}
                      disabled={!!saving}
                      className="text-xs px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 disabled:opacity-50"
                    >
                      Marcar como socializada
                    </button>
                  )}
                  {p.estado === "socializada" && (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => cambiarEstadoPropuesta(p.id, "en_votacion", "manual")}
                        disabled={!!saving || acreencias.length === 0}
                        className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                        title="El operador registra cada voto manualmente"
                      >
                        Voto manual
                      </button>
                      <button
                        onClick={() => cambiarEstadoPropuesta(p.id, "en_votacion", "link")}
                        disabled={!!saving || acreencias.length === 0}
                        className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                        title="Cada acreedor recibe un link para votar con OTP"
                      >
                        Voto por link
                      </button>
                      <button
                        onClick={() => cambiarEstadoPropuesta(p.id, "en_votacion", "dual")}
                        disabled={!!saving || acreencias.length === 0}
                        className="text-xs px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 disabled:opacity-50"
                        title="Links + operador puede registrar votos manualmente"
                      >
                        Dual
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{p.descripcion}</p>
              <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
                {p.plazo_meses && <span>Plazo: {p.plazo_meses} meses</span>}
                {p.tasa_interes && <span>Tasa: {p.tasa_interes}</span>}
                {p.periodo_gracia_meses > 0 && <span>Gracia: {p.periodo_gracia_meses} meses</span>}
              </div>
            </div>
          ))}

          {/* Formulario nueva propuesta */}
          {showPropForm ? (
            <div className="bg-white rounded-xl border border-[#1B4F9B]/30 p-5">
              <h4 className="text-sm font-semibold text-[#0D2340] mb-3">Nueva propuesta de pago</h4>
              <div className="space-y-3">
                <input
                  type="text" value={propForm.titulo} onChange={(e) => setPropForm({ ...propForm, titulo: e.target.value })}
                  placeholder="Título de la propuesta" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1B4F9B]/30 focus:border-[#1B4F9B] outline-none"
                />
                <textarea
                  value={propForm.descripcion} onChange={(e) => setPropForm({ ...propForm, descripcion: e.target.value })}
                  rows={5} placeholder="Describa la propuesta completa de pago..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1B4F9B]/30 focus:border-[#1B4F9B] outline-none resize-y"
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Plazo (meses)</label>
                    <input type="number" value={propForm.plazo_meses} onChange={(e) => setPropForm({ ...propForm, plazo_meses: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1B4F9B]/30 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Tasa de interés</label>
                    <input type="text" value={propForm.tasa_interes} onChange={(e) => setPropForm({ ...propForm, tasa_interes: e.target.value })}
                      placeholder="Ej: DTF + 2%" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1B4F9B]/30 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Periodo de gracia (meses)</label>
                    <input type="number" value={propForm.periodo_gracia_meses} onChange={(e) => setPropForm({ ...propForm, periodo_gracia_meses: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1B4F9B]/30 outline-none" />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowPropForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
                  <button onClick={crearPropuesta} disabled={!!saving}
                    className="px-4 py-2 bg-[#0D2340] text-white rounded-lg text-sm font-medium hover:bg-[#0D2340]/90 disabled:opacity-50">
                    {saving === "prop" ? "Creando..." : "Crear propuesta"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowPropForm(true)}
              className="flex items-center gap-2 text-sm text-[#1B4F9B] font-medium hover:underline">
              <Plus className="w-4 h-4" /> Nueva propuesta
            </button>
          )}
        </div>
      )}

      {/* ═══ SECCIÓN 4: Votación ═══ */}
      <SectionHeader
        icon={<Vote className="w-4 h-4" />}
        title="Votación"
        subtitle="Registre el voto de cada acreedor (>50% positivo + mín. 2 acreedores = acuerdo)"
        active={seccion === "votacion"}
        onClick={() => setSeccion(seccion === "votacion" ? "propuesta" : "votacion")}
      />

      {seccion === "votacion" && (
        <div className="space-y-4">
          {!propEnVotacion ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
              <Vote className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No hay propuesta en estado de votación.</p>
              <p className="text-xs mt-1">Cree una propuesta y ábrala a votación desde la sección anterior.</p>
            </div>
          ) : (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm font-medium text-blue-800">Votando: {propEnVotacion.titulo}</p>
                <p className="text-xs text-blue-600 mt-1">
                  Modo: <strong>{propEnVotacion.modo_votacion === "link" ? "Por link (OTP)" : propEnVotacion.modo_votacion === "dual" ? "Dual (link + manual)" : "Manual"}</strong>
                  {" — "}Regla: &gt;50% votos positivos + mín. 2 acreedores a favor
                </p>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Acreedor</th>
                      <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Capital conc.</th>
                      <th className="px-3 py-2.5 text-center font-semibold text-gray-600">% Voto</th>
                      <th className="px-3 py-2.5 text-center font-semibold text-gray-600">Pequeño</th>
                      <th className="px-4 py-2.5 text-center font-semibold text-gray-600">Voto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {acreencias.map((a) => (
                      <tr key={a.id} className={`hover:bg-gray-50/50 ${a.es_pequeno_acreedor ? "bg-amber-50/20" : ""}`}>
                        <td className="px-4 py-3 font-medium text-gray-900">{a.acreedor_nombre}</td>
                        <td className="px-3 py-3 text-right text-gray-700">{fmt(Number(a.con_capital))}</td>
                        <td className="px-3 py-3 text-center font-bold text-[#1B4F9B]">{pct(a.porcentaje_voto)}</td>
                        <td className="px-3 py-3 text-center">
                          {a.es_pequeno_acreedor && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">Sí</span>}
                        </td>
                        <td className="px-4 py-3">
                          {propEnVotacion.modo_votacion === "link" && !votos[a.id] ? (
                            <span className="text-xs text-gray-400 italic">Pendiente por link</span>
                          ) : votos[a.id] ? (
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                              votos[a.id] === "positivo" ? "bg-green-100 text-green-700" :
                              votos[a.id] === "negativo" ? "bg-red-100 text-red-700" :
                              "bg-gray-100 text-gray-600"
                            }`}>
                              {votos[a.id] === "positivo" ? "A favor" : votos[a.id] === "negativo" ? "En contra" : "Abstiene"}
                            </span>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              {(["positivo", "negativo", "abstiene"] as VotoInsolvencia[]).map((v) => (
                                <button
                                  key={v}
                                  onClick={() => registrarVoto(propEnVotacion.id, a.id, v)}
                                  disabled={saving === `voto-${a.id}`}
                                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                                >
                                  {v === "positivo" ? "A favor" : v === "negativo" ? "En contra" : "Abstiene"}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Resultado de votación */}
              {votacionResult && (
                <div className={`rounded-xl border-2 p-5 text-center ${
                  votacionResult.aprobada
                    ? "border-green-400 bg-green-50"
                    : votacionResult.todos_votaron
                    ? "border-red-400 bg-red-50"
                    : "border-blue-200 bg-blue-50"
                }`}>
                  <div className="flex items-center justify-center gap-3 mb-3">
                    {votacionResult.aprobada ? (
                      <CheckCircle2 className="w-8 h-8 text-green-600" />
                    ) : votacionResult.todos_votaron ? (
                      <XCircle className="w-8 h-8 text-red-600" />
                    ) : (
                      <AlertTriangle className="w-8 h-8 text-blue-500" />
                    )}
                    <h3 className={`text-lg font-bold ${
                      votacionResult.aprobada ? "text-green-800" :
                      votacionResult.todos_votaron ? "text-red-800" : "text-blue-800"
                    }`}>
                      {votacionResult.aprobada
                        ? "Propuesta APROBADA — Procede acuerdo de pagos"
                        : votacionResult.todos_votaron
                        ? "Propuesta RECHAZADA"
                        : "Votación en curso"}
                    </h3>
                  </div>
                  <div className="flex items-center justify-center gap-6 text-sm">
                    <span className="text-green-700">A favor: <strong>{votacionResult.votos_positivos}</strong> ({pct(votacionResult.porcentaje_aprobacion)})</span>
                    <span className="text-red-700">En contra: <strong>{votacionResult.votos_negativos}</strong></span>
                    <span className="text-gray-600">Acreedores a favor: <strong>{votacionResult.acreedores_positivos}</strong></span>
                  </div>
                  {votacionResult.aprobada && (
                    <p className="mt-3 text-sm text-green-700">
                      Se cumple: &gt;50% votos positivos ({pct(votacionResult.porcentaje_aprobacion)}) y al menos 2 acreedores a favor ({votacionResult.acreedores_positivos}).
                      <br />Se puede proceder a suscribir el acuerdo de pagos.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══ SECCIÓN 5: Acuerdo de pagos ═══ */}
      <SectionHeader
        icon={<Handshake className="w-4 h-4" />}
        title="Acuerdo de pagos"
        subtitle="Estructura del acuerdo con cálculo de cuotas por acreedor"
        active={seccion === "acuerdo"}
        onClick={() => setSeccion(seccion === "acuerdo" ? "votacion" : "acuerdo")}
      />

      {seccion === "acuerdo" && (
        <div className="space-y-4">
          {!acuerdo ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h4 className="text-sm font-semibold text-[#0D2340] mb-4">Configurar acuerdo de pagos</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Tasa interés anual (%)</label>
                  <input type="number" step="0.01" value={acuerdoForm.tasa_interes_anual}
                    onChange={(e) => setAcuerdoForm({ ...acuerdoForm, tasa_interes_anual: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1B4F9B]/30 outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Plazo (meses)</label>
                  <input type="number" value={acuerdoForm.plazo_meses}
                    onChange={(e) => setAcuerdoForm({ ...acuerdoForm, plazo_meses: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1B4F9B]/30 outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Periodo gracia (meses)</label>
                  <input type="number" value={acuerdoForm.periodo_gracia_meses}
                    onChange={(e) => setAcuerdoForm({ ...acuerdoForm, periodo_gracia_meses: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1B4F9B]/30 outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Fecha inicio pago</label>
                  <input type="date" value={acuerdoForm.fecha_inicio_pago}
                    onChange={(e) => setAcuerdoForm({ ...acuerdoForm, fecha_inicio_pago: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1B4F9B]/30 outline-none" />
                </div>
              </div>

              {/* Preview cuota */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800">
                  <strong>Vista previa:</strong> Capital total {fmt(totalCapitalCon)} a {acuerdoForm.tasa_interes_anual}% anual
                  en {parseInt(acuerdoForm.plazo_meses) - parseInt(acuerdoForm.periodo_gracia_meses || "0")} meses efectivos
                  = cuota de <strong>{fmt(calcularCuotaPMT(
                    totalCapitalCon,
                    parseFloat(acuerdoForm.tasa_interes_anual) / 100,
                    (parseInt(acuerdoForm.plazo_meses) || 12) - (parseInt(acuerdoForm.periodo_gracia_meses) || 0)
                  ))}</strong>/mes
                </p>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">Notas del acuerdo</label>
                <textarea value={acuerdoForm.notas}
                  onChange={(e) => setAcuerdoForm({ ...acuerdoForm, notas: e.target.value })}
                  rows={3} placeholder="Ej: Se condonan los intereses causados hasta la fecha..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1B4F9B]/30 outline-none resize-y" />
              </div>

              <div className="mt-4 flex justify-end">
                <button onClick={generarAcuerdo} disabled={!!saving || totalCapitalCon === 0}
                  className="px-5 py-2.5 bg-[#0D2340] text-white rounded-lg text-sm font-medium hover:bg-[#0D2340]/90 disabled:opacity-50">
                  {saving === "acuerdo" ? "Generando..." : "Generar acuerdo de pagos"}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Resumen del acuerdo */}
              <div className="bg-[#0D2340] rounded-xl p-5 text-white">
                <h4 className="font-semibold text-lg mb-3">Acuerdo de pagos suscrito</h4>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400 text-xs">Capital total</p>
                    <p className="font-bold">{fmt(acuerdo.capital_total)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Tasa anual</p>
                    <p className="font-bold">{(acuerdo.tasa_interes_anual * 100).toFixed(2)}%</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Plazo</p>
                    <p className="font-bold">{acuerdo.plazo_meses} meses</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Gracia</p>
                    <p className="font-bold">{acuerdo.periodo_gracia_meses} meses</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Cuota mensual</p>
                    <p className="font-bold text-green-400">{fmt(acuerdo.valor_cuota_global)}</p>
                  </div>
                </div>
                {acuerdo.notas && (
                  <div className="mt-3 pt-3 border-t border-white/20">
                    <p className="text-xs text-gray-300">{acuerdo.notas}</p>
                  </div>
                )}
              </div>

              {/* Tabla detalle por acreedor */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Acreedor</th>
                        <th className="px-2 py-2.5 text-center font-semibold text-gray-600">Clase</th>
                        <th className="px-2 py-2.5 text-right font-semibold text-gray-600">Capital</th>
                        <th className="px-2 py-2.5 text-right font-semibold text-gray-600">Int. causados</th>
                        <th className="px-2 py-2.5 text-right font-semibold text-gray-600">Int. futuros</th>
                        <th className="px-2 py-2.5 text-right font-semibold text-gray-600">Descuentos</th>
                        <th className="px-2 py-2.5 text-right font-semibold text-gray-600">Total a pagar</th>
                        <th className="px-2 py-2.5 text-right font-semibold text-gray-600">Cuota</th>
                        <th className="px-2 py-2.5 text-center font-semibold text-gray-600">% Voto</th>
                        <th className="px-2 py-2.5 text-center font-semibold text-gray-600">Voto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {(acuerdo.detalles ?? []).map((d: any) => {
                        const claseInfo = CLASES.find((c) => c.value === d.acreencia?.clase_credito);
                        return (
                          <tr key={d.id} className="hover:bg-gray-50/50">
                            <td className="px-3 py-2 font-medium text-gray-900">{d.acreencia?.acreedor_nombre ?? "—"}</td>
                            <td className="px-2 py-2 text-center">
                              {claseInfo && (
                                <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${claseInfo.color}`}>
                                  {claseInfo.label}
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-2 text-right">{fmt(d.capital)}</td>
                            <td className="px-2 py-2 text-right text-gray-500">{fmt(d.intereses_causados)}</td>
                            <td className="px-2 py-2 text-right">{fmt(d.intereses_futuros)}</td>
                            <td className="px-2 py-2 text-right text-red-600">{d.descuentos_capital > 0 ? `-${fmt(d.descuentos_capital)}` : "—"}</td>
                            <td className="px-2 py-2 text-right font-semibold text-[#0D2340]">{fmt(d.total_a_pagar)}</td>
                            <td className="px-2 py-2 text-right font-semibold text-green-700">{fmt(d.valor_cuota)}</td>
                            <td className="px-2 py-2 text-center font-bold text-[#1B4F9B]">{pct(d.derecho_voto)}</td>
                            <td className="px-2 py-2 text-center">
                              {d.sentido_voto === "positivo" && <span className="text-green-600 font-bold">A favor</span>}
                              {d.sentido_voto === "negativo" && <span className="text-red-600 font-bold">En contra</span>}
                              {d.sentido_voto === "abstiene" && <span className="text-gray-500">Abstiene</span>}
                              {!d.sentido_voto && <span className="text-gray-300">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t-2 border-[#0D2340] font-bold text-xs">
                        <td className="px-3 py-2" colSpan={2}>TOTALES</td>
                        <td className="px-2 py-2 text-right">{fmt(acuerdo.capital_total)}</td>
                        <td className="px-2 py-2 text-right text-gray-500">
                          {fmt((acuerdo.detalles ?? []).reduce((s: number, d: any) => s + (Number(d.intereses_causados) || 0), 0))}
                        </td>
                        <td className="px-2 py-2 text-right">
                          {fmt((acuerdo.detalles ?? []).reduce((s: number, d: any) => s + (Number(d.intereses_futuros) || 0), 0))}
                        </td>
                        <td className="px-2 py-2 text-right text-red-600">—</td>
                        <td className="px-2 py-2 text-right text-[#0D2340]">
                          {fmt((acuerdo.detalles ?? []).reduce((s: number, d: any) => s + (Number(d.total_a_pagar) || 0), 0))}
                        </td>
                        <td className="px-2 py-2 text-right text-green-700">{fmt(acuerdo.valor_cuota_global)}</td>
                        <td className="px-2 py-2 text-center">100%</td>
                        <td className="px-2 py-2 text-center text-green-700">{pct(acuerdo.porcentaje_aprobacion)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Componentes auxiliares ─────────────────────────────────────────── */

import { Fragment } from "react";

function SectionHeader({ icon, title, subtitle, active, onClick }: {
  icon: React.ReactNode; title: string; subtitle: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-5 py-3 rounded-xl border transition-colors ${
        active ? "bg-[#0D2340] text-white border-[#0D2340]" : "bg-white text-gray-900 border-gray-200 hover:border-[#1B4F9B]/50"
      }`}
    >
      <div className="flex items-center gap-3">
        {icon}
        <div className="text-left">
          <p className="font-semibold text-sm">{title}</p>
          <p className={`text-xs ${active ? "text-gray-300" : "text-gray-500"}`}>{subtitle}</p>
        </div>
      </div>
      {active ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
    </button>
  );
}

function MoneyInput({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(String(value || ""));

  if (editing) {
    return (
      <input
        type="number"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const num = parseFloat(text) || 0;
          setEditing(false);
          if (num !== value) onSave(num);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") { setEditing(false); setText(String(value || "")); }
        }}
        autoFocus
        className="w-20 border border-[#1B4F9B] rounded px-1.5 py-0.5 text-xs text-right focus:ring-1 focus:ring-[#1B4F9B] outline-none"
      />
    );
  }

  return (
    <button
      onClick={() => { setText(String(value || "")); setEditing(true); }}
      className="w-20 text-right text-xs text-gray-700 hover:bg-blue-50 rounded px-1.5 py-0.5 transition-colors"
    >
      {value ? fmt(value) : "—"}
    </button>
  );
}
