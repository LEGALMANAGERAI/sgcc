"use client";

import { useState } from "react";
import { partyDisplayName } from "@/types";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Plus,
  History,
  Loader2,
  CheckSquare,
  Square,
  StickyNote,
  X,
  Upload,
} from "lucide-react";

/* ─── Props ─────────────────────────────────────────────────────────────── */

interface TabChecklistPoderesProps {
  caseId: string;
  parties: any[];
  attorneys: any[];
  checklist: any | null;
  responses: any[];
}

/* ─── Constantes ────────────────────────────────────────────────────────── */

const MOTIVO_OPTIONS = [
  { value: "inicial", label: "Designación inicial" },
  { value: "renuncia", label: "Renuncia" },
  { value: "revocatoria", label: "Revocatoria" },
  { value: "sustitucion", label: "Sustitución" },
] as const;

const TIPO_DOC_OPTIONS = [
  { value: "CC", label: "CC" },
  { value: "CE", label: "CE" },
  { value: "Pasaporte", label: "Pasaporte" },
  { value: "PPT", label: "PPT" },
  { value: "otro", label: "Otro" },
] as const;

/* ─── Component ─────────────────────────────────────────────────────────── */

export function TabChecklistPoderes({
  caseId,
  parties,
  attorneys,
  checklist,
  responses,
}: TabChecklistPoderesProps) {
  const [showForm, setShowForm] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    party_id: "",
    nombre: "",
    tipo_doc: "CC",
    numero_doc: "",
    tarjeta_profesional: "",
    email: "",
    telefono: "",
    motivo_cambio: "inicial" as string,
    vigencia_desde: "",
    vigencia_hasta: "",
  });
  const [poderFile, setPoderFile] = useState<File | null>(null);

  // Checklist state
  const [localResponses, setLocalResponses] = useState<Record<number, any>>(
    () => {
      const map: Record<number, any> = {};
      for (const r of responses) {
        map[r.item_index] = r;
      }
      return map;
    }
  );
  const [saving, setSaving] = useState<number | null>(null);
  const [editingNotes, setEditingNotes] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");

  // Agrupar apoderados por party_id
  const attorneysByParty = new Map<string, any[]>();
  for (const ca of attorneys) {
    const arr = attorneysByParty.get(ca.party_id) ?? [];
    arr.push(ca);
    attorneysByParty.set(ca.party_id, arr);
  }

  // Apoderados activos por parte
  const activeAttorneyByParty = new Map<string, any>();
  for (const ca of attorneys) {
    if (ca.activo && ca.attorney) {
      activeAttorneyByParty.set(ca.party_id, ca);
    }
  }

  // 30 días atrás para detectar cambios recientes
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  // Submit nuevo apoderado
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.party_id || !formData.nombre || !formData.numero_doc) return;

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("data", JSON.stringify({
        party_id: formData.party_id,
        attorney: {
          nombre: formData.nombre,
          tipo_doc: formData.tipo_doc,
          numero_doc: formData.numero_doc,
          tarjeta_profesional: formData.tarjeta_profesional || null,
          email: formData.email || null,
          telefono: formData.telefono || null,
        },
        motivo_cambio: formData.motivo_cambio,
        poder_vigente_desde: formData.vigencia_desde || null,
        poder_vigente_hasta: formData.vigencia_hasta || null,
      }));
      if (poderFile) fd.append("poderFile", poderFile);

      const res = await fetch(`/api/expediente/${caseId}/apoderados`, {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Error al registrar apoderado");
        return;
      }

      setShowForm(false);
      setFormData({
        party_id: "",
        nombre: "",
        tipo_doc: "CC",
        numero_doc: "",
        tarjeta_profesional: "",
        email: "",
        telefono: "",
        motivo_cambio: "inicial",
        vigencia_desde: "",
        vigencia_hasta: "",
      });
      setPoderFile(null);
      window.location.reload();
    } catch {
      alert("Error de conexión");
    } finally {
      setSubmitting(false);
    }
  }

  // Toggle checklist item
  async function handleToggle(itemIndex: number) {
    if (!checklist) return;
    setSaving(itemIndex);
    const current = localResponses[itemIndex];
    const newCompleted = !current?.completado;

    try {
      const res = await fetch(`/api/expediente/${caseId}/checklist`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checklist_id: checklist.id,
          item_index: itemIndex,
          completado: newCompleted,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Error al actualizar");
        return;
      }

      const data = await res.json();
      setLocalResponses((prev) => ({
        ...prev,
        [itemIndex]: data.response ?? {
          ...prev[itemIndex],
          completado: newCompleted,
          completed_at: newCompleted ? new Date().toISOString() : null,
        },
      }));
    } catch {
      alert("Error de conexión");
    } finally {
      setSaving(null);
    }
  }

  // Guardar notas checklist
  async function handleSaveNotes(itemIndex: number) {
    if (!checklist) return;
    setSaving(itemIndex);
    try {
      const res = await fetch(`/api/expediente/${caseId}/checklist`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checklist_id: checklist.id,
          item_index: itemIndex,
          notas: noteText,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Error al guardar notas");
        return;
      }

      const data = await res.json();
      setLocalResponses((prev) => ({
        ...prev,
        [itemIndex]: data.response ?? { ...prev[itemIndex], notas: noteText },
      }));
      setEditingNotes(null);
      setNoteText("");
    } catch {
      alert("Error de conexión");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* ═══ Sección 1: Apoderados actuales por parte ════════════════ */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-[#0D2340] text-base flex items-center gap-2">
            <Shield className="w-4.5 h-4.5 text-[#1B4F9B]" />
            Apoderados por parte
          </h3>
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-1.5 bg-[#0D2340] text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-[#0d2340dd] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Registrar nuevo apoderado
          </button>
        </div>

        {/* Tabla apoderados */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Parte
                </th>
                <th className="px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Apoderado actual
                </th>
                <th className="px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  T.P.
                </th>
                <th className="px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider text-center">
                  Verificado
                </th>
                <th className="px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider text-center">
                  Poder vigente
                </th>
                <th className="px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider text-center">
                  Cambio reciente
                </th>
                <th className="px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider text-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {parties.map((cp: any) => {
                const party = cp.party;
                if (!party) return null;
                const activeCa = activeAttorneyByParty.get(cp.party_id);
                const attorney = activeCa?.attorney;
                const isRecent =
                  activeCa &&
                  (activeCa.created_at > thirtyDaysAgo ||
                    (activeCa.motivo_cambio && activeCa.motivo_cambio !== "inicial"));
                const historyItems = attorneysByParty.get(cp.party_id) ?? [];
                const isExpanded = expandedHistory === cp.party_id;

                const poderVigente =
                  activeCa?.poder_vigente_hasta
                    ? new Date(activeCa.poder_vigente_hasta) > new Date()
                    : activeCa?.poder_url
                      ? true
                      : false;

                return (
                  <tr
                    key={cp.id}
                    className={`hover:bg-gray-50/50 transition-colors ${
                      isRecent ? "bg-yellow-50/40" : ""
                    }`}
                  >
                    <td className="px-5 py-3">
                      <div>
                        <p className="font-medium text-gray-900">
                          {partyDisplayName(party)}
                        </p>
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                            cp.rol === "convocante"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-orange-100 text-orange-700"
                          }`}
                        >
                          {cp.rol === "convocante" ? "Convocante" : "Convocado"}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {attorney ? (
                        <span className="font-medium text-gray-900">
                          {attorney.nombre}
                        </span>
                      ) : (
                        <span className="text-gray-400">Sin apoderado</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-gray-600 text-xs">
                      {attorney?.tarjeta_profesional ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {attorney ? (
                        attorney.verificado ? (
                          <ShieldCheck className="w-4 h-4 text-green-500 mx-auto" />
                        ) : (
                          <ShieldAlert className="w-4 h-4 text-amber-500 mx-auto" />
                        )
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {activeCa ? (
                        poderVigente ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            Vigente
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            Vencido
                          </span>
                        )
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {isRecent ? (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Sí
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">No</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {historyItems.length > 0 && (
                        <button
                          onClick={() =>
                            setExpandedHistory(isExpanded ? null : cp.party_id)
                          }
                          className="inline-flex items-center gap-1 text-xs text-[#1B4F9B] hover:underline"
                        >
                          <History className="w-3 h-3" />
                          Historial
                          {isExpanded ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Historial expandido */}
        {expandedHistory && (
          <div className="px-6 pb-4">
            <div className="bg-gray-50 rounded-lg p-4 mt-2">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Historial de apoderados
              </h4>
              <div className="space-y-2">
                {(attorneysByParty.get(expandedHistory) ?? []).map((ca: any) => (
                  <div
                    key={ca.id}
                    className={`flex items-center justify-between p-2.5 rounded-lg text-xs ${
                      ca.activo ? "bg-white border border-green-200" : "bg-white border border-gray-100"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400">
                        {new Date(ca.created_at).toLocaleDateString("es-CO", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <span className="font-medium text-gray-900">
                        {ca.attorney?.nombre ?? "—"}
                      </span>
                      {ca.motivo_cambio && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">
                          {ca.motivo_cambio}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {ca.activo ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                          Inactivo
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ═══ Formulario nuevo apoderado ══════════════════════════════ */}
      {showForm && (
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[#0D2340] text-base">
              Registrar nuevo apoderado
            </h3>
            <button
              onClick={() => setShowForm(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Parte */}
              <div>
                <label className="block text-xs text-gray-500 font-medium mb-1">
                  Parte *
                </label>
                <select
                  required
                  value={formData.party_id}
                  onChange={(e) =>
                    setFormData({ ...formData, party_id: e.target.value })
                  }
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1B4F9B]/30 focus:border-[#1B4F9B]"
                >
                  <option value="">Seleccionar parte...</option>
                  {parties.map((cp: any) => (
                    <option key={cp.party_id} value={cp.party_id}>
                      {cp.party ? partyDisplayName(cp.party) : cp.party_id} (
                      {cp.rol})
                    </option>
                  ))}
                </select>
              </div>

              {/* Nombre abogado */}
              <div>
                <label className="block text-xs text-gray-500 font-medium mb-1">
                  Nombre del abogado *
                </label>
                <input
                  type="text"
                  required
                  value={formData.nombre}
                  onChange={(e) =>
                    setFormData({ ...formData, nombre: e.target.value })
                  }
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1B4F9B]/30 focus:border-[#1B4F9B]"
                  placeholder="Nombre completo"
                />
              </div>

              {/* Tipo doc + Número */}
              <div className="flex gap-2">
                <div className="w-24">
                  <label className="block text-xs text-gray-500 font-medium mb-1">
                    Tipo doc
                  </label>
                  <select
                    value={formData.tipo_doc}
                    onChange={(e) =>
                      setFormData({ ...formData, tipo_doc: e.target.value })
                    }
                    className="w-full text-sm border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-[#1B4F9B]/30 focus:border-[#1B4F9B]"
                  >
                    {TIPO_DOC_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 font-medium mb-1">
                    Número doc *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.numero_doc}
                    onChange={(e) =>
                      setFormData({ ...formData, numero_doc: e.target.value })
                    }
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1B4F9B]/30 focus:border-[#1B4F9B]"
                  />
                </div>
              </div>

              {/* Tarjeta profesional */}
              <div>
                <label className="block text-xs text-gray-500 font-medium mb-1">
                  Tarjeta profesional
                </label>
                <input
                  type="text"
                  value={formData.tarjeta_profesional}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      tarjeta_profesional: e.target.value,
                    })
                  }
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1B4F9B]/30 focus:border-[#1B4F9B]"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs text-gray-500 font-medium mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1B4F9B]/30 focus:border-[#1B4F9B]"
                />
              </div>

              {/* Teléfono */}
              <div>
                <label className="block text-xs text-gray-500 font-medium mb-1">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={formData.telefono}
                  onChange={(e) =>
                    setFormData({ ...formData, telefono: e.target.value })
                  }
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1B4F9B]/30 focus:border-[#1B4F9B]"
                />
              </div>

              {/* Motivo cambio */}
              <div>
                <label className="block text-xs text-gray-500 font-medium mb-1">
                  Motivo del cambio
                </label>
                <select
                  value={formData.motivo_cambio}
                  onChange={(e) =>
                    setFormData({ ...formData, motivo_cambio: e.target.value })
                  }
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1B4F9B]/30 focus:border-[#1B4F9B]"
                >
                  {MOTIVO_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Poder (archivo) */}
              <div>
                <label className="block text-xs text-gray-500 font-medium mb-1">
                  Archivo de poder
                </label>
                <input
                  type="file"
                  onChange={(e) => setPoderFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 file:mr-3 file:rounded-md file:border-0 file:bg-[#0D2340] file:text-white file:text-xs file:px-3 file:py-1 file:cursor-pointer"
                />
              </div>

              {/* Vigencia desde */}
              <div>
                <label className="block text-xs text-gray-500 font-medium mb-1">
                  Vigencia desde
                </label>
                <input
                  type="date"
                  value={formData.vigencia_desde}
                  onChange={(e) =>
                    setFormData({ ...formData, vigencia_desde: e.target.value })
                  }
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1B4F9B]/30 focus:border-[#1B4F9B]"
                />
              </div>

              {/* Vigencia hasta */}
              <div>
                <label className="block text-xs text-gray-500 font-medium mb-1">
                  Vigencia hasta
                </label>
                <input
                  type="date"
                  value={formData.vigencia_hasta}
                  onChange={(e) =>
                    setFormData({ ...formData, vigencia_hasta: e.target.value })
                  }
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1B4F9B]/30 focus:border-[#1B4F9B]"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 bg-[#1B4F9B] text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-[#a07509] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Registrar
                  </>
                )}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ═══ Sección 2: Checklist de poderes ═════════════════════════ */}
      {checklist ? (
        <section className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-[#0D2340] text-base">
              {checklist.nombre}
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left">
                  <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider w-10">
                    Estado
                  </th>
                  <th className="px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                    Requisito
                  </th>
                  <th className="px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider w-20 text-center">
                    Req.
                  </th>
                  <th className="px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                    Notas
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(checklist.items ?? []).map((item: any, idx: number) => {
                  const response = localResponses[idx];
                  const isCompleted = response?.completado ?? false;
                  const isSaving = saving === idx;

                  return (
                    <tr
                      key={idx}
                      className={`hover:bg-gray-50/50 transition-colors ${
                        !isCompleted && item.requerido ? "bg-amber-50/30" : ""
                      }`}
                    >
                      <td className="px-5 py-3">
                        <button
                          onClick={() => handleToggle(idx)}
                          disabled={isSaving}
                          className="flex items-center justify-center disabled:opacity-50"
                        >
                          {isSaving ? (
                            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                          ) : isCompleted ? (
                            <CheckSquare className="w-5 h-5 text-green-500" />
                          ) : (
                            <Square className="w-5 h-5 text-gray-300 hover:text-gray-500" />
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <p
                          className={`font-medium ${
                            isCompleted
                              ? "text-gray-400 line-through"
                              : "text-gray-900"
                          }`}
                        >
                          {item.nombre}
                        </p>
                        {item.descripcion && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {item.descripcion}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {item.requerido ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            Sí
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">No</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-gray-600 text-xs">
                        {response?.completed_at
                          ? new Date(
                              response.completed_at
                            ).toLocaleDateString("es-CO", {
                              day: "numeric",
                              month: "short",
                            })
                          : "—"}
                      </td>
                      <td className="px-3 py-3">
                        {editingNotes === idx ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={noteText}
                              onChange={(e) => setNoteText(e.target.value)}
                              className="text-xs border border-gray-200 rounded px-2 py-1 w-40 focus:outline-none focus:ring-1 focus:ring-[#1B4F9B]"
                              placeholder="Agregar nota..."
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveNotes(idx);
                                if (e.key === "Escape") {
                                  setEditingNotes(null);
                                  setNoteText("");
                                }
                              }}
                            />
                            <button
                              onClick={() => handleSaveNotes(idx)}
                              disabled={isSaving}
                              className="text-xs text-[#1B4F9B] hover:underline"
                            >
                              {isSaving ? "..." : "OK"}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingNotes(idx);
                              setNoteText(response?.notas ?? "");
                            }}
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
                          >
                            <StickyNote className="w-3 h-3" />
                            {response?.notas
                              ? response.notas.length > 30
                                ? response.notas.slice(0, 30) + "..."
                                : response.notas
                              : "Agregar nota"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <p className="text-sm text-gray-400">
            No hay checklist de poderes configurada para este tipo de trámite.
          </p>
        </div>
      )}
    </div>
  );
}
