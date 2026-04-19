"use client";
import type { SaveState } from "@/hooks/useDraftAutoSave";

export function AutoSaveIndicator({
  state,
  lastSavedAt,
}: {
  state: SaveState;
  lastSavedAt: Date | null;
}) {
  if (state === "saving") {
    return <span className="text-xs text-gray-500">Guardando…</span>;
  }
  if (state === "error") {
    return (
      <span className="text-xs text-red-600">
        Error guardando · reintentando
      </span>
    );
  }
  if (state === "saved" && lastSavedAt) {
    return (
      <span className="text-xs text-green-700">
        Guardado{" "}
        {lastSavedAt.toLocaleTimeString("es-CO", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    );
  }
  return <span className="text-xs text-gray-400">Borrador</span>;
}
