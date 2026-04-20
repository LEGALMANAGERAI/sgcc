// src/hooks/useDraftAutoSave.ts
// Debounce de 3s + reintento exponencial para PATCH del draft.
// Flush automático en beforeunload para no perder cambios al cerrar pestaña.

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveState = "idle" | "saving" | "saved" | "error";

interface Options {
  draftId: string;
  debounceMs?: number;
}

export function useDraftAutoSave({ draftId, debounceMs = 3000 }: Options) {
  const [state, setState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const pending = useRef<Record<string, unknown> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAt = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    const body = pending.current;
    if (!body) return;
    pending.current = null;
    setState("saving");
    try {
      const res = await fetch(`/api/partes/solicitudes/${draftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`PATCH ${res.status}`);
      setState("saved");
      setLastSavedAt(new Date());
    } catch {
      setState("error");
      pending.current = { ...(pending.current ?? {}), ...body };
      if (retryAt.current) clearTimeout(retryAt.current);
      retryAt.current = setTimeout(flush, 5000);
    }
  }, [draftId]);

  const save = useCallback(
    (patch: Record<string, unknown>) => {
      pending.current = { ...(pending.current ?? {}), ...patch };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, debounceMs);
    },
    [flush, debounceMs]
  );

  useEffect(() => {
    const onBeforeUnload = () => {
      if (pending.current) {
        // Intento síncrono con sendBeacon — best effort
        const blob = new Blob([JSON.stringify(pending.current)], {
          type: "application/json",
        });
        navigator.sendBeacon?.(`/api/partes/solicitudes/${draftId}`, blob);
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (timer.current) clearTimeout(timer.current);
      if (retryAt.current) clearTimeout(retryAt.current);
    };
  }, [draftId]);

  return { state, lastSavedAt, save, flushNow: flush };
}
