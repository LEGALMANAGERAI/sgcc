"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Check, X } from "lucide-react";

interface StaffOption {
  id: string;
  nombre: string;
}

interface Props {
  caseId: string;
  campo: "conciliador_id" | "secretario_id";
  label: string;
  valorActualId: string | null;
  valorActualNombre: string | null;
  opciones: StaffOption[];
}

/**
 * Mini-editor inline para asignar conciliador o secretario al expediente.
 * Solo se renderiza cuando el rol staff es admin o secretario (decisión del padre).
 */
export function AsignarConciliador({
  caseId,
  campo,
  label,
  valorActualId,
  valorActualNombre,
  opciones,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [seleccion, setSeleccion] = useState<string | null>(valorActualId);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setError(null);
    try {
      const res = await fetch(`/api/casos/${caseId}/asignacion`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [campo]: seleccion ?? null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? "Error al guardar");
        return;
      }
      setEditing(false);
      startTransition(() => router.refresh());
    } catch {
      setError("Error de conexión");
    }
  }

  function cancelar() {
    setSeleccion(valorActualId);
    setEditing(false);
    setError(null);
  }

  return (
    <div>
      <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
      {editing ? (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <select
              value={seleccion ?? ""}
              onChange={(e) => setSeleccion(e.target.value || null)}
              className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#1B4F9B]"
              disabled={pending}
            >
              <option value="">Sin asignar</option>
              {opciones.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={guardar}
              disabled={pending}
              className="p-1.5 rounded-md bg-[#0D2340] text-white hover:bg-[#1B4F9B] disabled:opacity-50"
              title="Guardar"
            >
              {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={cancelar}
              disabled={pending}
              className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-50"
              title="Cancelar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {error && <p className="text-[11px] text-red-600">{error}</p>}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <p className="text-sm text-gray-900 font-medium flex-1">
            {valorActualNombre ?? <span className="text-gray-400 font-normal">Sin asignar</span>}
          </p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="p-1 rounded text-gray-400 hover:text-[#1B4F9B] hover:bg-[#1B4F9B]/10 transition-colors"
            title={`Cambiar ${label.toLowerCase()}`}
          >
            <Pencil className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
