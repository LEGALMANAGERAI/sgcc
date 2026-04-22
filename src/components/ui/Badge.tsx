/**
 * Badge — primitiva SGCC.
 *
 * Estados semánticos de expediente: Radicado, Activo, Audiencia, Acuerdo, Archivado, Vencido.
 * Forma pill, monospace, uppercase, letter-spacing 0.12em, font-size 10px, padding 4px 10px.
 *
 * Para estados de dominio SGCC legacy (case/hearing/firma) usar StatusChip.
 */

import { clsx } from "clsx";
import type { HTMLAttributes, ReactNode } from "react";

export type BadgeVariant =
  | "radicado"
  | "activo"
  | "audiencia"
  | "acuerdo"
  | "archivado"
  | "vencido"
  | "neutral";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
  radicado:
    "bg-[rgba(27,49,82,0.1)] text-[color:var(--color-ink-soft)]",
  activo:
    "bg-[rgba(20,184,166,0.12)] text-[color:var(--color-flow-deep)]",
  audiencia:
    "bg-[rgba(245,158,11,0.12)] text-[#B45309]",
  acuerdo:
    "bg-[color:var(--color-ink)] text-[color:var(--color-flow)]",
  archivado:
    "bg-[color:var(--color-paper-warm)] text-[color:var(--color-ink-soft)]",
  vencido:
    "bg-[rgba(198,88,64,0.12)] text-[color:var(--color-terracotta)]",
  neutral:
    "bg-[color:var(--color-paper-deep)] text-[color:var(--color-ink-soft)]",
};

export function Badge({ variant = "neutral", className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center font-mono font-medium uppercase",
        "text-[10px] tracking-[0.12em] px-[10px] py-1 rounded-full",
        "whitespace-nowrap",
        variantStyles[variant],
        className
      )}
      style={{ fontFamily: "var(--font-mono), ui-monospace, monospace" }}
      {...rest}
    >
      {children}
    </span>
  );
}
