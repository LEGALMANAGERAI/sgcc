"use client";

import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
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
  FileDown,
  Users,
  Calculator,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Maximize2,
  Minimize2,
  GripVertical,
} from "lucide-react";
import type { SgccAcreencia, VotoInsolvencia, ClaseCredito } from "@/types";
import { Handshake } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

/** Normaliza un documento (NIT/CC) eliminando puntos, guiones, espacios y pasando a mayúsculas.
 *  Se usa como clave estable para agrupar al mismo acreedor aunque lo hayan escrito con formatos distintos. */
function normalizarDocumento(d: string | null | undefined): string {
  if (!d) return "";
  return d.replace(/[\s.\-_]/g, "").toUpperCase();
}

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
  const [downloading, setDownloading] = useState<"docx" | "pdf" | "vot-docx" | "vot-pdf" | null>(null);

  const flash = useCallback((type: "ok" | "error", msg: string) => {
    if (type === "ok") { setSuccess(msg); setError(""); }
    else { setError(msg); setSuccess(""); }
    setTimeout(() => { setSuccess(""); setError(""); }, 4000);
  }, []);

  async function descargarRelacion(format: "docx" | "pdf") {
    if (acreencias.length === 0) {
      flash("error", "No hay acreencias registradas para exportar");
      return;
    }
    setDownloading(format);
    try {
      const res = await fetch(`/api/expediente/${caseId}/acreencias/export?format=${format}`);
      if (!res.ok) {
        const msg = await res.json().catch(() => ({ error: "Error al generar el documento" }));
        flash("error", msg.error ?? "Error al generar el documento");
        return;
      }
      const blob = await res.blob();
      const dispo = res.headers.get("Content-Disposition") ?? "";
      const match = dispo.match(/filename="?([^";]+)"?/i);
      const filename = match?.[1] ?? `relacion-acreencias.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      flash("ok", `Relación descargada como ${format.toUpperCase()}`);
    } catch {
      flash("error", "No se pudo descargar el documento");
    } finally {
      setDownloading(null);
    }
  }

  async function descargarVotacion(format: "docx" | "pdf", propuestaId?: string) {
    setDownloading(`vot-${format}`);
    try {
      const url = `/api/expediente/${caseId}/votacion/export?format=${format}${propuestaId ? `&propuesta_id=${propuestaId}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) {
        const msg = await res.json().catch(() => ({ error: "Error al generar el acta" }));
        flash("error", msg.error ?? "Error al generar el acta");
        return;
      }
      const blob = await res.blob();
      const dispo = res.headers.get("Content-Disposition") ?? "";
      const match = dispo.match(/filename="?([^";]+)"?/i);
      const filename = match?.[1] ?? `acta-votacion.${format}`;
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objUrl);
      flash("ok", `Acta de votación descargada como ${format.toUpperCase()}`);
    } catch {
      flash("error", "No se pudo descargar el acta");
    } finally {
      setDownloading(null);
    }
  }

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
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        flash("error", body?.error || `Error al crear (${res.status})`);
        return;
      }
      const data = await res.json();
      setAcreencias((prev) => [...prev, data]);
    } finally { setSaving(null); }
  }

  async function importarConvocados() {
    const existingPartyIds = new Set(acreencias.map((a) => a.party_id).filter(Boolean));
    const pendientes = partesConvocados.filter((p) => !existingPartyIds.has(p.id));
    if (pendientes.length === 0) { flash("ok", "No hay convocados pendientes por importar"); return; }
    setSaving("import");
    try {
      const nuevas: SgccAcreencia[] = [];
      for (const p of pendientes) {
        const res = await fetch(`/api/expediente/${caseId}/acreencias`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            acreedor_nombre: p.nombre || "",
            acreedor_documento: p.documento || null,
            party_id: p.id,
          }),
        });
        if (res.ok) nuevas.push(await res.json());
      }
      setAcreencias((prev) => [...prev, ...nuevas]);
      flash("ok", `${nuevas.length} acreedor(es) importado(s)`);
    } finally { setSaving(null); }
  }

  async function updateAcreencia(acreenciaId: string, campos: Record<string, any>) {
    // Update optimista: pintar cambio inmediatamente en la fila editada
    setAcreencias((prev) => prev.map((a) => (a.id === acreenciaId ? { ...a, ...campos } : a)));
    setSaving(acreenciaId);
    try {
      const res = await fetch(`/api/expediente/${caseId}/acreencias`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acreencia_id: acreenciaId, ...campos }),
      });
      if (!res.ok) { flash("error", "Error al guardar"); return; }
      const data: SgccAcreencia[] = await res.json();
      // Merge por id preservando el orden visual actual — evita saltos de fila
      // y evita que una respuesta tardía pise cambios locales más recientes de otra fila.
      const byId = new Map(data.map((a) => [a.id, a]));
      setAcreencias((prev) => {
        const merged = prev.map((a) => byId.get(a.id) ?? a);
        for (const a of data) if (!prev.some((p) => p.id === a.id)) merged.push(a);
        return merged;
      });
    } finally { setSaving(null); }
  }

  async function capitalizarSeguros(acreenciaId: string) {
    const a = acreencias.find((x) => x.id === acreenciaId);
    if (!a) return;
    // Tomar el valor mayor reportado de seguros para capitalizar
    const segurosCon = Number(a.con_seguros) || 0;
    const segurosAcr = Number(a.acr_seguros) || 0;
    const segurosSol = Number(a.sol_seguros) || 0;
    const seguros = Math.max(segurosCon, segurosAcr, segurosSol);
    if (seguros <= 0) { flash("error", "No hay seguros reportados para capitalizar"); return; }
    if (!confirm(`¿Capitalizar $${seguros.toLocaleString("es-CO")} de seguros al capital? Se sumará al capital en las tres columnas (Solicitud/Acreedor/Conciliado) y seguros quedará en 0.`)) return;
    const nuevaNota = [a.notas, `Seguros capitalizados al capital: $${seguros.toLocaleString("es-CO")}`].filter(Boolean).join(" · ");
    // Capitalizar en las 3 columnas para que una conciliación posterior traiga el valor correcto
    await updateAcreencia(acreenciaId, {
      sol_capital: (Number(a.sol_capital) || 0) + segurosSol,
      sol_seguros: 0,
      acr_capital: (Number(a.acr_capital) || 0) + segurosAcr,
      acr_seguros: 0,
      con_capital: (Number(a.con_capital) || 0) + segurosCon,
      con_seguros: 0,
      notas: nuevaNota,
    });
    setSeccion("definitiva");
    flash("ok", "Seguros capitalizados al capital — mira la Relación definitiva");
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

  /* ─── Drag & Drop ────────────────────────────────────────────────── */

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = acreencias.findIndex((a) => a.id === active.id);
    const newIndex = acreencias.findIndex((a) => a.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const nuevoOrden = arrayMove(acreencias, oldIndex, newIndex);
    const ordenIds = nuevoOrden.map((a) => a.id);
    // Optimista: reordenar ya en pantalla
    setAcreencias(nuevoOrden);

    setSaving("reorder");
    try {
      const res = await fetch(`/api/expediente/${caseId}/acreencias/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: ordenIds }),
      });
      if (!res.ok) {
        flash("error", "No se pudo guardar el nuevo orden");
        // Revertir si falla
        setAcreencias(acreencias);
        return;
      }
      const data: SgccAcreencia[] = await res.json();
      // El server reordena correctamente; tomamos su versión autoritativa
      setAcreencias(data);
    } finally {
      setSaving(null);
    }
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

  // Vota en bloque por TODAS las acreencias de un acreedor (un acreedor = un voto en insolvencia,
  // con peso = suma de los % de sus créditos). Hace un POST por acreencia para reusar el
  // endpoint individual; el último response trae el resultado consolidado actualizado.
  async function registrarVotoAcreedor(propuestaId: string, acreenciaIds: string[], voto: VotoInsolvencia) {
    if (acreenciaIds.length === 0) return;
    setSaving(`voto-${acreenciaIds[0]}`);
    try {
      let ultimoResultado: any = null;
      for (const acreenciaId of acreenciaIds) {
        const res = await fetch(`/api/expediente/${caseId}/votacion`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ propuesta_id: propuestaId, acreencia_id: acreenciaId, voto }),
        });
        if (!res.ok) {
          flash("error", "No se pudo registrar el voto en uno de los créditos del acreedor");
          return;
        }
        ultimoResultado = await res.json();
      }
      setVotos((prev) => {
        const next = { ...prev };
        for (const id of acreenciaIds) next[id] = voto;
        return next;
      });
      if (ultimoResultado) setVotacionResult(ultimoResultado);
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

  /* ─── Agrupación por acreedor para la Relación Definitiva ─────────────
     Un mismo acreedor puede tener varias acreencias (créditos). El derecho
     de voto en insolvencia es por acreedor, no por crédito — se consolidan. */
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Mapa party_id → documento del party convocado (lo usamos como fallback cuando una
  // acreencia importada no tiene `acreedor_documento` propio).
  const documentoPorParty = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of partesConvocados) {
      if (p.id && p.documento) m.set(p.id, p.documento);
    }
    return m;
  }, [partesConvocados]);

  const gruposAcreedores = useMemo(() => {
    const map = new Map<string, {
      key: string;
      acreedor_nombre: string;
      acreedor_documento: string | null;
      acreencias: SgccAcreencia[];
    }>();
    for (const a of acreencias) {
      // Priorizar documento normalizado (NIT/CC sin puntos/guiones/espacios, mayúsculas)
      // para que el mismo acreedor se agrupe aunque una acreencia venga de un convocado
      // (party_id) y otra fuera creada manualmente. Si la acreencia no tiene documento
      // pero tiene party_id, usar el documento del party como fallback.
      const docDirecto = normalizarDocumento(a.acreedor_documento);
      const docDelParty = a.party_id ? normalizarDocumento(documentoPorParty.get(a.party_id) ?? null) : "";
      const docEfectivo = docDirecto || docDelParty;
      const nombreNorm = a.acreedor_nombre?.trim().toUpperCase() || "";
      const key = docEfectivo || a.party_id || nombreNorm || `sin-${a.id}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          acreedor_nombre: a.acreedor_nombre,
          acreedor_documento: a.acreedor_documento ?? documentoPorParty.get(a.party_id ?? "") ?? null,
          acreencias: [],
        });
      }
      map.get(key)!.acreencias.push(a);
    }
    return Array.from(map.values());
  }, [acreencias, documentoPorParty]);

  // Sugerencias únicas de acreedores ya capturados en este caso (para autocompletar y prevenir typos)
  const sugerenciasAcreedores = useMemo(() => {
    const seen = new Map<string, { nombre: string; documento: string }>();
    for (const a of acreencias) {
      const doc = normalizarDocumento(a.acreedor_documento);
      if (!doc) continue;
      if (!seen.has(doc)) {
        seen.set(doc, {
          nombre: a.acreedor_nombre?.trim() ?? "",
          documento: a.acreedor_documento?.trim() ?? "",
        });
      }
    }
    return Array.from(seen.values());
  }, [acreencias]);

  const toggleGrupo = useCallback((key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

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
          {/* Listas de autocompletado: al escribir nombre o documento, sugiere acreedores ya capturados. */}
          <datalist id={`acreedores-nombres-${caseId}`}>
            {sugerenciasAcreedores.map((s) => (
              <option key={`n-${s.documento}`} value={s.nombre}>{s.documento}</option>
            ))}
          </datalist>
          <datalist id={`acreedores-documentos-${caseId}`}>
            {sugerenciasAcreedores.map((s) => (
              <option key={`d-${s.documento}`} value={s.documento}>{s.nombre}</option>
            ))}
          </datalist>
          <div className="overflow-x-auto">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="w-8"></th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 min-w-[180px]">Acreedor</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-600 min-w-[90px]">Tipo</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-600 min-w-[100px]">Documento</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-600 min-w-[140px]">Identificación crédito</th>
                  <th className="px-2 py-2 text-center font-semibold text-gray-600">Clase</th>
                  <th className="px-2 py-2 text-center font-semibold text-gray-600">Días mora</th>
                  {conceptos.map((c) => (
                    <th key={c.key} colSpan={2} className="px-2 py-2 text-center font-semibold text-gray-600 border-l border-gray-200">
                      {c.label}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-left font-semibold text-gray-600 border-l border-gray-200 min-w-[180px]">Observaciones</th>
                  <th className="px-2 py-2 text-center font-semibold text-gray-600 border-l border-gray-200">Acciones</th>
                </tr>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th colSpan={7}></th>
                  {conceptos.map((c) => (
                    <Fragment key={c.key}>
                      <th className="px-2 py-1 text-center text-[10px] text-blue-600 font-medium border-l border-gray-200">Solicitud</th>
                      <th className="px-2 py-1 text-center text-[10px] text-purple-600 font-medium">Acreedor</th>
                    </Fragment>
                  ))}
                  <th className="border-l border-gray-200"></th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                <SortableContext items={acreencias.map((a) => a.id)} strategy={verticalListSortingStrategy}>
                {acreencias.map((a) => (
                  <SortableAcreenciaRow
                    key={a.id}
                    a={a}
                    saving={saving}
                    updateAcreencia={updateAcreencia}
                    capitalizarSeguros={capitalizarSeguros}
                    deleteAcreencia={deleteAcreencia}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        list={`acreedores-nombres-${caseId}`}
                        defaultValue={a.acreedor_nombre}
                        placeholder="Nombre del acreedor"
                        onBlur={(e) => {
                          const valor = e.target.value;
                          if (valor !== a.acreedor_nombre) {
                            // Si el usuario eligió un nombre ya existente, autocompletar también el documento
                            const match = sugerenciasAcreedores.find((s) => s.nombre === valor);
                            if (match && !a.acreedor_documento) {
                              updateAcreencia(a.id, { acreedor_nombre: valor, acreedor_documento: match.documento });
                            } else {
                              updateAcreencia(a.id, { acreedor_nombre: valor });
                            }
                          }
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
                        list={`acreedores-documentos-${caseId}`}
                        defaultValue={a.acreedor_documento ?? ""}
                        onBlur={(e) => {
                          const valor = e.target.value;
                          if (valor === (a.acreedor_documento ?? "")) return;
                          // Si existe otro acreedor con documento parecido (mismo normalizado) avisar typo
                          const valorNorm = normalizarDocumento(valor);
                          if (valorNorm) {
                            const coincidencia = sugerenciasAcreedores.find(
                              (s) => normalizarDocumento(s.documento) === valorNorm && s.documento !== valor,
                            );
                            if (coincidencia) {
                              // Normalizar automáticamente para consolidar con el existente
                              updateAcreencia(a.id, {
                                acreedor_documento: coincidencia.documento,
                                acreedor_nombre: a.acreedor_nombre || coincidencia.nombre,
                              });
                              flash("ok", `Documento consolidado con "${coincidencia.nombre}" (${coincidencia.documento})`);
                              return;
                            }
                          }
                          // Si el valor escrito coincide exactamente con un acreedor existente, copiar también el nombre
                          const match = sugerenciasAcreedores.find((s) => s.documento === valor);
                          if (match && !a.acreedor_nombre) {
                            updateAcreencia(a.id, { acreedor_documento: valor, acreedor_nombre: match.nombre });
                          } else {
                            updateAcreencia(a.id, { acreedor_documento: valor });
                          }
                        }}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#1B4F9B] outline-none"
                        placeholder={a.acreedor_tipo === "juridica" ? "NIT" : "CC/CE"}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        defaultValue={a.identificacion_credito ?? ""}
                        onBlur={(e) => {
                          if (e.target.value !== (a.identificacion_credito ?? "")) updateAcreencia(a.id, { identificacion_credito: e.target.value });
                        }}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#1B4F9B] outline-none"
                        placeholder="Ej: Tarjeta Visa 1234"
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
                    {conceptos.map((c) => {
                      const solValue = Number((a as any)[`sol_${c.key}`]) || 0;
                      const acrValue = Number((a as any)[`acr_${c.key}`]) || 0;
                      const conValue = Number((a as any)[`con_${c.key}`]) || 0;
                      const solConciliado = conValue > 0 && conValue === solValue;
                      const acrConciliado = conValue > 0 && conValue === acrValue && !solConciliado;
                      return (
                        <Fragment key={c.key}>
                          <td className={`px-1 py-2 border-l border-gray-100 ${solConciliado ? "bg-green-50" : ""}`}>
                            <div className="space-y-1">
                              <MoneyInput
                                value={solValue}
                                onSave={(v) => updateAcreencia(a.id, { [`sol_${c.key}`]: v })}
                              />
                              <button
                                type="button"
                                onClick={() => updateAcreencia(a.id, { [`con_${c.key}`]: solValue })}
                                className={`w-full text-[9px] font-medium rounded px-1 py-0.5 border transition-colors ${
                                  solConciliado
                                    ? "bg-green-600 text-white border-green-600"
                                    : "bg-white text-gray-500 border-gray-200 hover:border-green-500 hover:text-green-600"
                                }`}
                                title="Marcar este valor como conciliado"
                              >
                                {solConciliado ? "✓ Conciliado" : "Conciliar"}
                              </button>
                            </div>
                          </td>
                          <td className={`px-1 py-2 ${acrConciliado ? "bg-green-50" : ""}`}>
                            <div className="space-y-1">
                              <MoneyInput
                                value={acrValue}
                                onSave={(v) => updateAcreencia(a.id, { [`acr_${c.key}`]: v })}
                              />
                              <button
                                type="button"
                                onClick={() => updateAcreencia(a.id, { [`con_${c.key}`]: acrValue })}
                                className={`w-full text-[9px] font-medium rounded px-1 py-0.5 border transition-colors ${
                                  acrConciliado
                                    ? "bg-green-600 text-white border-green-600"
                                    : "bg-white text-gray-500 border-gray-200 hover:border-green-500 hover:text-green-600"
                                }`}
                                title="Marcar este valor como conciliado"
                              >
                                {acrConciliado ? "✓ Conciliado" : "Conciliar"}
                              </button>
                            </div>
                          </td>
                        </Fragment>
                      );
                    })}
                    <td className="px-2 py-2 border-l border-gray-100 align-top">
                      <textarea
                        defaultValue={a.notas ?? ""}
                        onBlur={(e) => {
                          if (e.target.value !== (a.notas ?? "")) updateAcreencia(a.id, { notas: e.target.value });
                        }}
                        rows={2}
                        placeholder="Observaciones..."
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#1B4F9B] outline-none resize-none"
                      />
                    </td>
                    <td className="px-2 py-2 border-l border-gray-100">
                      <div className="flex flex-col items-center gap-1">
                        {(Number(a.con_seguros) > 0 || Number(a.acr_seguros) > 0 || Number(a.sol_seguros) > 0) && (
                          <button
                            type="button"
                            onClick={() => capitalizarSeguros(a.id)}
                            disabled={saving === a.id}
                            className="text-[9px] font-medium bg-amber-50 text-amber-700 border border-amber-300 rounded px-1.5 py-0.5 hover:bg-amber-100 disabled:opacity-50 leading-tight"
                            title="Capitalizar seguros al capital"
                          >
                            Capitalizar<br />seguros
                          </button>
                        )}
                        <button
                          onClick={() => deleteAcreencia(a.id)}
                          disabled={saving === a.id}
                          className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
                        >
                          {saving === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                  </SortableAcreenciaRow>
                ))}
                </SortableContext>
              </tbody>
              {acreencias.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-[#0D2340] font-bold text-xs">
                    <td colSpan={7} className="px-3 py-2 text-right text-gray-900">TOTALES</td>
                    {conceptos.map((c) => {
                      const totalSol = acreencias.reduce((s, a) => s + (Number((a as any)[`sol_${c.key}`]) || 0), 0);
                      const totalAcr = acreencias.reduce((s, a) => s + (Number((a as any)[`acr_${c.key}`]) || 0), 0);
                      return (
                        <Fragment key={c.key}>
                          <td className="px-1 py-2 text-right text-blue-700 border-l border-gray-200">{fmt(totalSol)}</td>
                          <td className="px-1 py-2 text-right text-purple-700">{fmt(totalAcr)}</td>
                        </Fragment>
                      );
                    })}
                    <td className="border-l border-gray-200"></td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
            </DndContext>
          </div>
          <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-4">
            <button
              onClick={addAcreencia}
              disabled={saving === "add"}
              className="flex items-center gap-1.5 text-sm text-[#1B4F9B] font-medium hover:underline disabled:opacity-50"
            >
              {saving === "add" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Agregar acreedor
            </button>
            {partesConvocados.length > 0 && (
              <button
                onClick={importarConvocados}
                disabled={saving === "import"}
                className="flex items-center gap-1.5 text-sm text-gray-600 font-medium hover:text-[#0D2340] hover:underline disabled:opacity-50"
              >
                {saving === "import" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
                Importar convocados del expediente ({partesConvocados.length})
              </button>
            )}
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
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/60">
            <div className="text-xs text-gray-600">
              Descarga la relación como tabla con los mismos márgenes del acta (carta · 2,54 cm) para incrustarla en el escrito.
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => descargarRelacion("docx")}
                disabled={downloading !== null || acreencias.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#0D2340] bg-[#0D2340] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#1B4F9B] disabled:cursor-not-allowed disabled:opacity-50"
                title="Descargar relación definitiva en Word (.docx)"
              >
                {downloading === "docx" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileDown className="w-3.5 h-3.5" />
                )}
                Word
              </button>
              <button
                type="button"
                onClick={() => descargarRelacion("pdf")}
                disabled={downloading !== null || acreencias.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#0D2340] shadow-sm transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                title="Descargar relación definitiva en PDF"
              >
                {downloading === "pdf" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileDown className="w-3.5 h-3.5" />
                )}
                PDF
              </button>
            </div>
          </div>
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
                {gruposAcreedores.map((grupo) => {
                  const multiple = grupo.acreencias.length > 1;
                  const expanded = expandedGroups.has(grupo.key);

                  // Filas simples (1 sola acreencia): comportamiento original editable
                  if (!multiple) {
                    const a = grupo.acreencias[0];
                    const totalRow = Number(a.con_capital) + Number(a.con_intereses_corrientes) + Number(a.con_intereses_moratorios) + Number(a.con_seguros) + Number(a.con_otros);
                    return (
                      <tr key={grupo.key} className={`hover:bg-gray-50/50 ${a.es_pequeno_acreedor ? "bg-amber-50/30" : ""}`}>
                        <td className="px-3 py-2 font-medium text-gray-900">
                          <div>{a.acreedor_nombre}{a.acreedor_documento && <span className="text-gray-400 ml-1">({a.acreedor_documento})</span>}</div>
                          {a.identificacion_credito && <div className="text-[10px] text-gray-500 mt-0.5">{a.identificacion_credito}</div>}
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
                  }

                  // Grupo con varias acreencias: fila padre consolidada + hijas expandibles
                  const totalesGrupo: Record<string, number> = {};
                  for (const c of conceptos) {
                    totalesGrupo[c.key] = grupo.acreencias.reduce(
                      (s, a) => s + (Number((a as any)[`con_${c.key}`]) || 0),
                      0,
                    );
                  }
                  const totalGrupo = Object.values(totalesGrupo).reduce((s, v) => s + v, 0);
                  const pctGrupo = grupo.acreencias.reduce((s, a) => s + Number(a.porcentaje_voto || 0), 0);
                  const todosPequenos = grupo.acreencias.every((a) => a.es_pequeno_acreedor);

                  return (
                    <Fragment key={grupo.key}>
                      <tr
                        className="bg-blue-50/40 border-t-2 border-blue-200 cursor-pointer hover:bg-blue-100/40"
                        onClick={() => toggleGrupo(grupo.key)}
                      >
                        <td className="px-3 py-2.5 font-bold text-gray-900">
                          <div className="flex items-center gap-2">
                            {expanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-[#1B4F9B]" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-[#1B4F9B]" />
                            )}
                            <div>
                              <div>
                                {grupo.acreedor_nombre}
                                {grupo.acreedor_documento && (
                                  <span className="text-gray-500 ml-1 font-normal">({grupo.acreedor_documento})</span>
                                )}
                              </div>
                              <div className="text-[10px] text-[#1B4F9B] font-semibold mt-0.5">
                                {grupo.acreencias.length} acreencias consolidadas
                              </div>
                            </div>
                          </div>
                        </td>
                        {conceptos.map((c) => (
                          <td key={c.key} className="px-2 py-2.5 text-right font-bold text-gray-900">
                            {fmt(totalesGrupo[c.key])}
                          </td>
                        ))}
                        <td className="px-2 py-2.5 text-right font-bold text-[#0D2340]">
                          {fmt(totalGrupo)}
                        </td>
                        <td></td>
                        <td className="px-2 py-2.5 text-center">
                          <span className="font-bold text-[#1B4F9B]">{pct(pctGrupo)}</span>
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          {todosPequenos ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">Sí</span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                      {expanded && grupo.acreencias.map((a) => {
                        const totalRow = Number(a.con_capital) + Number(a.con_intereses_corrientes) + Number(a.con_intereses_moratorios) + Number(a.con_seguros) + Number(a.con_otros);
                        return (
                          <tr key={a.id} className={`bg-gray-50/40 hover:bg-gray-100/40 ${a.es_pequeno_acreedor ? "bg-amber-50/30" : ""}`}>
                            <td className="px-3 py-2 text-gray-700">
                              <div className="flex items-start gap-2 pl-5">
                                <span className="text-gray-400 text-sm">↳</span>
                                <div>
                                  {a.identificacion_credito ? (
                                    <div className="text-xs font-medium text-gray-700">{a.identificacion_credito}</div>
                                  ) : (
                                    <div className="text-[11px] italic text-gray-400">Sin identificación</div>
                                  )}
                                </div>
                              </div>
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
                              <span className="text-[#1B4F9B] text-xs">{pct(a.porcentaje_voto)}</span>
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
                    </Fragment>
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
            (() => {
              const tituloVacio = !propForm.titulo.trim();
              const descripcionVacia = !propForm.descripcion.trim();
              const puedeCrear = !tituloVacio && !descripcionVacia && !saving;
              return (
                <div className="bg-white rounded-xl border border-[#1B4F9B]/30 p-5">
                  <h4 className="text-sm font-semibold text-[#0D2340] mb-3">Nueva propuesta de pago</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        Título <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        aria-invalid={tituloVacio}
                        value={propForm.titulo}
                        onChange={(e) => setPropForm({ ...propForm, titulo: e.target.value })}
                        placeholder="Título de la propuesta"
                        className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1B4F9B]/30 focus:border-[#1B4F9B] outline-none ${
                          tituloVacio ? "border-red-300 bg-red-50/30" : "border-gray-300"
                        }`}
                      />
                      {tituloVacio && <p className="text-[11px] text-red-600 mt-1">El título es obligatorio.</p>}
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        Descripción <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        required
                        aria-invalid={descripcionVacia}
                        value={propForm.descripcion}
                        onChange={(e) => setPropForm({ ...propForm, descripcion: e.target.value })}
                        rows={5}
                        placeholder="Describa la propuesta completa de pago..."
                        className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1B4F9B]/30 focus:border-[#1B4F9B] outline-none resize-y ${
                          descripcionVacia ? "border-red-300 bg-red-50/30" : "border-gray-300"
                        }`}
                      />
                      {descripcionVacia && (
                        <p className="text-[11px] text-red-600 mt-1">
                          La descripción es obligatoria — explica las cláusulas y términos de la propuesta.
                        </p>
                      )}
                    </div>
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
                    <div className="flex gap-2 justify-end items-center">
                      {!puedeCrear && !saving && (
                        <span className="text-[11px] text-gray-500 mr-auto">
                          Completa los campos marcados con <span className="text-red-500">*</span> para continuar.
                        </span>
                      )}
                      <button onClick={() => setShowPropForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
                      <button
                        onClick={crearPropuesta}
                        disabled={!puedeCrear}
                        title={puedeCrear ? undefined : "Completa título y descripción"}
                        className="px-4 py-2 bg-[#0D2340] text-white rounded-lg text-sm font-medium hover:bg-[#0D2340]/90 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {saving === "prop" ? "Creando..." : "Crear propuesta"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()
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
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-blue-800">Votando: {propEnVotacion.titulo}</p>
                  <p className="text-xs text-blue-600 mt-1">
                    Modo: <strong>{propEnVotacion.modo_votacion === "link" ? "Por link (OTP)" : propEnVotacion.modo_votacion === "dual" ? "Dual (link + manual)" : "Manual"}</strong>
                    {" — "}Regla: &gt;50% votos positivos + mín. 2 acreedores a favor
                  </p>
                </div>
                <div className="flex flex-shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => descargarVotacion("docx", propEnVotacion.id)}
                    disabled={downloading !== null}
                    title="Descargar acta de votación en Word"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#0D2340] bg-[#0D2340] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#1B4F9B] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {downloading === "vot-docx" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                    Word
                  </button>
                  <button
                    type="button"
                    onClick={() => descargarVotacion("pdf", propEnVotacion.id)}
                    disabled={downloading !== null}
                    title="Descargar acta de votación en PDF"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#0D2340] shadow-sm transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {downloading === "vot-pdf" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                    PDF
                  </button>
                </div>
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
                    {gruposAcreedores.map((grupo) => {
                      // Suma de capital, % de voto, y voto consolidado del grupo.
                      const capitalGrupo = grupo.acreencias.reduce((s, a) => s + (Number(a.con_capital) || 0), 0);
                      const pctGrupo = grupo.acreencias.reduce((s, a) => s + (Number(a.porcentaje_voto) || 0), 0);
                      const todosPequeños = grupo.acreencias.every((a) => a.es_pequeno_acreedor);
                      const acreenciaIds = grupo.acreencias.map((a) => a.id);
                      const votosGrupo = acreenciaIds.map((id) => votos[id]).filter(Boolean) as VotoInsolvencia[];
                      const votoConsolidado: VotoInsolvencia | null =
                        votosGrupo.length === acreenciaIds.length && votosGrupo.every((v) => v === votosGrupo[0])
                          ? votosGrupo[0]
                          : null;
                      const filaSaving = acreenciaIds.some((id) => saving === `voto-${id}`);
                      const documento = grupo.acreedor_documento;
                      return (
                        <tr key={grupo.key} className={`hover:bg-gray-50/50 ${todosPequeños ? "bg-amber-50/20" : ""}`}>
                          <td className="px-4 py-3 font-medium text-gray-900">
                            <div>{grupo.acreedor_nombre}</div>
                            {documento && <div className="text-[11px] text-gray-500 font-normal">{documento}</div>}
                            {grupo.acreencias.length > 1 && (
                              <div className="text-[10px] text-[#1B4F9B] font-medium mt-0.5">
                                {grupo.acreencias.length} acreencias consolidadas
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right text-gray-700">{fmt(capitalGrupo)}</td>
                          <td className="px-3 py-3 text-center font-bold text-[#1B4F9B]">{pct(pctGrupo)}</td>
                          <td className="px-3 py-3 text-center">
                            {todosPequeños && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">Sí</span>}
                          </td>
                          <td className="px-4 py-3">
                            {propEnVotacion.modo_votacion === "link" && !votoConsolidado ? (
                              <span className="text-xs text-gray-400 italic">Pendiente por link</span>
                            ) : votoConsolidado ? (
                              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                                votoConsolidado === "positivo" ? "bg-green-100 text-green-700" :
                                votoConsolidado === "negativo" ? "bg-red-100 text-red-700" :
                                "bg-gray-100 text-gray-600"
                              }`}>
                                {votoConsolidado === "positivo" ? "A favor" : votoConsolidado === "negativo" ? "En contra" : "Abstiene"}
                              </span>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                {(["positivo", "negativo", "abstiene"] as VotoInsolvencia[]).map((v) => (
                                  <button
                                    key={v}
                                    onClick={() => registrarVotoAcreedor(propEnVotacion.id, acreenciaIds, v)}
                                    disabled={filaSaving}
                                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50"
                                  >
                                    {v === "positivo" ? "A favor" : v === "negativo" ? "En contra" : "Abstiene"}
                                  </button>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
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

function SortableAcreenciaRow({
  a,
  saving,
  children,
}: {
  a: SgccAcreencia;
  saving: string | null;
  updateAcreencia: (id: string, campos: Record<string, any>) => void;
  capitalizarSeguros: (id: string) => void;
  deleteAcreencia: (id: string) => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: a.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    backgroundColor: isDragging ? "#eff6ff" : undefined,
  };
  return (
    <tr ref={setNodeRef} style={style} className="hover:bg-gray-50/50">
      <td className="w-8 px-1 py-2 text-center align-middle">
        <button
          type="button"
          {...attributes}
          {...listeners}
          disabled={saving === "reorder"}
          className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-[#1B4F9B] disabled:opacity-50 touch-none"
          title="Arrastrar para reordenar"
          aria-label="Arrastrar para reordenar acreedor"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      </td>
      {children}
    </tr>
  );
}

function parseMoneyCOP(str: string): number {
  if (!str) return 0;
  const cleaned = str.replace(/[^\d,]/g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

function MoneyInput({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(String(value || ""));

  if (editing) {
    return (
      <input
        type="text"
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const num = parseMoneyCOP(text);
          setEditing(false);
          if (num !== value) onSave(num);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") { setEditing(false); setText(String(value || "")); }
        }}
        autoFocus
        className="w-28 border border-[#1B4F9B] rounded px-1.5 py-0.5 text-xs text-right focus:ring-1 focus:ring-[#1B4F9B] outline-none"
      />
    );
  }

  return (
    <button
      onClick={() => { setText(value ? String(value) : ""); setEditing(true); }}
      className="w-28 text-right text-xs text-gray-700 hover:bg-blue-50 rounded px-1.5 py-0.5 transition-colors"
    >
      {value ? fmt(value) : "—"}
    </button>
  );
}
