"use client";

import { useState } from "react";
import {
  CheckSquare,
  Square,
  AlertTriangle,
  FileText,
  Loader2,
  StickyNote,
} from "lucide-react";

/* ─── Props ─────────────────────────────────────────────────────────────── */

interface TabChecklistAdmisionProps {
  caseId: string;
  checklist: any | null;
  responses: any[];
}

/* ─── Component ─────────────────────────────────────────────────────────── */

export function TabChecklistAdmision({
  caseId,
  checklist,
  responses,
}: TabChecklistAdmisionProps) {
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

  if (!checklist) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
        <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-3" />
        <p className="text-sm text-gray-500">
          No hay checklist de admisión configurada para este tipo de trámite.
        </p>
        <p className="text-xs text-gray-400 mt-1">
          El administrador del centro debe crear la checklist desde la
          configuración.
        </p>
      </div>
    );
  }

  const items: { nombre: string; requerido: boolean; descripcion: string }[] =
    checklist.items ?? [];
  const requiredItems = items.filter((i) => i.requerido);
  const completedRequired = requiredItems.filter(
    (_, idx) => {
      const realIdx = items.indexOf(requiredItems[idx]);
      return localResponses[realIdx]?.completado;
    }
  ).length;

  // Contar completados requeridos correctamente
  let completedReqCount = 0;
  for (let i = 0; i < items.length; i++) {
    if (items[i].requerido && localResponses[i]?.completado) {
      completedReqCount++;
    }
  }

  const totalRequired = requiredItems.length;
  const progressPct =
    totalRequired > 0 ? Math.round((completedReqCount / totalRequired) * 100) : 100;
  const allRequiredDone = completedReqCount === totalRequired;

  // Toggle completado
  async function handleToggle(itemIndex: number) {
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

  // Guardar notas
  async function handleSaveNotes(itemIndex: number) {
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
        [itemIndex]: data.response ?? {
          ...prev[itemIndex],
          notas: noteText,
        },
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
      {/* ── Barra de progreso ────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-[#0D2340] text-base">
            {checklist.nombre}
          </h3>
          <span className="text-sm font-medium text-gray-700">
            {completedReqCount}/{totalRequired} requeridos
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all duration-500 ${
              allRequiredDone ? "bg-green-500" : "bg-[#B8860B]"
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {!allRequiredDone && totalRequired > 0 && (
          <div className="mt-3 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <p className="text-xs text-amber-700">
              Faltan {totalRequired - completedReqCount} documento
              {totalRequired - completedReqCount !== 1 ? "s" : ""} requerido
              {totalRequired - completedReqCount !== 1 ? "s" : ""} para
              completar la admisión.
            </p>
          </div>
        )}

        {allRequiredDone && totalRequired > 0 && (
          <p className="mt-2 text-xs text-green-600 font-medium">
            Todos los documentos requeridos han sido verificados.
          </p>
        )}
      </div>

      {/* ── Tabla de items ───────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider w-10">
                  Estado
                </th>
                <th className="px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Documento requerido
                </th>
                <th className="px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider w-20 text-center">
                  Req.
                </th>
                <th className="px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Verificado por
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
              {items.map((item, idx) => {
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
                    {/* Checkbox */}
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

                    {/* Nombre del item */}
                    <td className="px-3 py-3">
                      <p
                        className={`font-medium ${
                          isCompleted ? "text-gray-400 line-through" : "text-gray-900"
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

                    {/* Requerido */}
                    <td className="px-3 py-3 text-center">
                      {item.requerido ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          Sí
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">No</span>
                      )}
                    </td>

                    {/* Verificado por */}
                    <td className="px-3 py-3 text-gray-600 text-xs">
                      {response?.verificado_por_staff ?? "—"}
                    </td>

                    {/* Fecha */}
                    <td className="px-3 py-3 text-gray-600 text-xs">
                      {response?.completed_at
                        ? new Date(response.completed_at).toLocaleDateString(
                            "es-CO",
                            { day: "numeric", month: "short" }
                          )
                        : "—"}
                    </td>

                    {/* Notas */}
                    <td className="px-3 py-3">
                      {editingNotes === idx ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            className="text-xs border border-gray-200 rounded px-2 py-1 w-40 focus:outline-none focus:ring-1 focus:ring-[#B8860B]"
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
                            className="text-xs text-[#B8860B] hover:underline"
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
              {items.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-8 text-center text-gray-400"
                  >
                    La checklist no tiene items configurados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
