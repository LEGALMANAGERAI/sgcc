"use client";

import { useEffect, useState } from "react";

interface Props {
  iso: string | null | undefined;
  mode?: "date" | "datetime" | "time" | "dateLong";
  fallback?: string;
  className?: string;
}

const OPTS: Record<NonNullable<Props["mode"]>, Intl.DateTimeFormatOptions> = {
  date: {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Bogota",
  },
  dateLong: {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Bogota",
  },
  datetime: {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Bogota",
  },
  time: {
    timeStyle: "short",
    timeZone: "America/Bogota",
  },
};

/**
 * Renderiza fechas solo en cliente. Evita el hydration mismatch que ocurre
 * cuando el servidor (runtime Node sin ICU completo) y el navegador
 * formatean distinto con toLocaleString.
 *
 * En el primer render (SSR y primer render del cliente), muestra el fallback.
 * Tras el mount, muestra la fecha formateada.
 */
export function ClientDate({ iso, mode = "date", fallback = "—", className }: Props) {
  const [text, setText] = useState<string>(fallback);

  useEffect(() => {
    if (!iso) {
      setText(fallback);
      return;
    }
    try {
      setText(new Date(iso).toLocaleString("es-CO", OPTS[mode]));
    } catch {
      setText(iso);
    }
  }, [iso, mode, fallback]);

  return (
    <span className={className} suppressHydrationWarning>
      {text}
    </span>
  );
}
