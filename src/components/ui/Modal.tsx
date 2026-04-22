"use client";

/**
 * Modal — primitiva SGCC.
 *
 * - Overlay rgba(10,22,40,0.4) + backdrop-blur 4px
 * - Dialog max-width 560px, radius 2xl, #FFF bg, shadow-xl
 * - Header: h3 + close button a la derecha
 * - Footer: botones alineados a la derecha, secondary a la izquierda de primary
 *
 * Uso:
 *   <Modal open={open} onClose={close} title="Crear expediente">
 *     <ModalBody>…</ModalBody>
 *     <ModalFooter>
 *       <Button variant="secondary" onClick={close}>Cancelar</Button>
 *       <Button onClick={save}>Guardar</Button>
 *     </ModalFooter>
 *   </Modal>
 */

import { clsx } from "clsx";
import { X } from "lucide-react";
import {
  useEffect,
  useRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
  /** Si es false, clicks en el overlay no cierran (útil para flows de confirmación). */
  closeOnOverlayClick?: boolean;
  /** className extra para el contenedor del dialog (no del overlay). */
  className?: string;
}

const sizeClass = {
  sm: "max-w-[420px]",
  md: "max-w-[560px]",
  lg: "max-w-[720px]",
};

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
  closeOnOverlayClick = true,
  className,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open || typeof window === "undefined") return null;

  return createPortal(
    <div
      role="presentation"
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{
        background: "rgba(10, 22, 40, 0.4)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
      onMouseDown={(e) => {
        if (!closeOnOverlayClick) return;
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        className={clsx(
          "w-full rounded-[24px] bg-white text-[color:var(--color-ink)]",
          sizeClass[size],
          className
        )}
        style={{ boxShadow: "var(--shadow-xl)" }}
      >
        {title && (
          <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-[color:var(--color-rule)]">
            <h3 className="text-lg font-semibold tracking-[-0.01em] leading-tight">
              {title}
            </h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="rounded-md p-1 text-[color:var(--color-ink)] opacity-60 hover:opacity-100 transition-opacity"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body
  );
}

export function ModalBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("px-6 py-5 text-sm leading-[1.55]", className)} {...rest} />;
}

export function ModalFooter({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "px-6 pb-5 pt-3 flex items-center justify-end gap-2",
        "border-t border-[color:var(--color-rule)]",
        className
      )}
      {...rest}
    />
  );
}
