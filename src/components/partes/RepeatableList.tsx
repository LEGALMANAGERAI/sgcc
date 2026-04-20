"use client";
import { Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

interface Props<T> {
  items: T[];
  onChange: (items: T[]) => void;
  renderItem: (item: T, idx: number, onChange: (patch: Partial<T>) => void) => ReactNode;
  makeEmpty: () => T;
  addLabel?: string;
  minItems?: number;
}

export function RepeatableList<T>({
  items,
  onChange,
  renderItem,
  makeEmpty,
  addLabel = "Agregar",
  minItems = 0,
}: Props<T>) {
  const add = () => onChange([...items, makeEmpty()]);
  const remove = (i: number) => onChange(items.filter((_, k) => k !== i));
  const patch = (i: number) => (p: Partial<T>) =>
    onChange(items.map((it, k) => (k === i ? { ...it, ...p } : it)));

  return (
    <div className="space-y-4">
      {items.map((it, i) => (
        <div
          key={i}
          className="relative rounded-xl border border-gray-200 bg-gray-50 p-4"
        >
          {items.length > minItems && (
            <button
              type="button"
              onClick={() => remove(i)}
              className="absolute top-3 right-3 text-red-600 hover:bg-red-50 rounded p-1"
              aria-label="Eliminar"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {renderItem(it, i, patch(i))}
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-600 hover:border-[#0D2340] hover:text-[#0D2340]"
      >
        <Plus className="w-4 h-4" /> {addLabel}
      </button>
    </div>
  );
}
