"use client";

/**
 * Toast — FlowCase primitiva (§4.9 del brand brief).
 *
 * - Posición: top-right, 24px del borde
 * - Width 360px, radius lg, shadow-lg
 * - Variants:
 *     default  → ink bg / paper text
 *     success  → flow-deep bg / paper text
 *     error    → terracotta bg / paper text
 * - Auto-dismiss 5s (hover pausa el timer)
 *
 * Uso:
 *   // en el árbol (ej. layout):
 *   <ToastProvider>{children}</ToastProvider>
 *
 *   // en un componente:
 *   const { toast } = useToast();
 *   toast({ title: "Expediente creado", variant: "success" });
 */

import { clsx } from "clsx";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type Variant = "default" | "success" | "error";

interface ToastInput {
  title: string;
  description?: string;
  variant?: Variant;
  /** Duración en ms; default 5000. Pasar 0 para persistente (requiere cerrar manualmente). */
  duration?: number;
}

interface ToastItem extends Required<Omit<ToastInput, "description">> {
  id: string;
  description?: string;
}

interface ToastContextValue {
  toast: (input: ToastInput) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return ctx;
}

const variantClass: Record<Variant, { bg: string; icon: typeof Info }> = {
  default: {
    bg: "bg-[color:var(--color-ink)] text-[color:var(--color-paper)]",
    icon: Info,
  },
  success: {
    bg: "bg-[color:var(--color-flow-deep)] text-[color:var(--color-paper)]",
    icon: CheckCircle2,
  },
  error: {
    bg: "bg-[color:var(--color-terracotta)] text-[color:var(--color-paper)]",
    icon: AlertTriangle,
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((input: ToastInput) => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `t-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const next: ToastItem = {
      id,
      title: input.title,
      description: input.description,
      variant: input.variant ?? "default",
      duration: input.duration ?? 5000,
    };
    setItems((prev) => [...prev, next]);
    return id;
  }, []);

  const ctx = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {mounted &&
        createPortal(
          <div
            role="region"
            aria-live="polite"
            aria-label="Notificaciones"
            className="fixed top-6 right-6 z-[1100] flex flex-col gap-3 pointer-events-none"
          >
            {items.map((t) => (
              <ToastCard key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const { bg, icon: Icon } = variantClass[item.variant];
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useCallback(() => {
    if (item.duration <= 0) return;
    timerRef.current = setTimeout(onDismiss, item.duration);
  }, [item.duration, onDismiss]);

  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => {
    start();
    return clear;
  }, [start, clear]);

  return (
    <div
      role="status"
      onMouseEnter={clear}
      onMouseLeave={start}
      className={clsx(
        "pointer-events-auto w-[360px] rounded-[12px] px-5 py-4 flex items-start gap-3",
        bg
      )}
      style={{ boxShadow: "var(--shadow-lg)" }}
    >
      <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight">{item.title}</p>
        {item.description && (
          <p className="text-[13px] leading-[1.5] opacity-85 mt-1">
            {item.description}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Cerrar notificación"
        className="opacity-70 hover:opacity-100 transition-opacity flex-shrink-0"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
