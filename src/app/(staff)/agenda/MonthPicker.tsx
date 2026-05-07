"use client";

import { useRouter } from "next/navigation";

interface Props {
  /** Mes actual en formato YYYY-MM */
  value: string;
}

/**
 * Selector rápido de mes para la vista mensual.
 * Usa el input nativo type="month" — el navegador provee su propio picker.
 */
export function MonthPicker({ value }: Props) {
  const router = useRouter();
  return (
    <input
      type="month"
      value={value}
      onChange={(e) => {
        const v = e.target.value;
        if (/^\d{4}-\d{2}$/.test(v)) {
          router.push(`/agenda?view=month&month=${v}`);
        }
      }}
      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:border-[#0D2340] transition-colors cursor-pointer"
      aria-label="Seleccionar mes"
    />
  );
}
