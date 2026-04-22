/**
 * Card — FlowCase primitiva (§4.3 del brand brief).
 *
 * Variants:
 *   default   — #FFF bg / 1px rule border / radius-xl / padding 24px
 *   emphasis  — ink bg / paper text (para KPIs, highlights). Usar acento flow para deltas positivos.
 *
 * Componentes auxiliares: CardHeader, CardTitle, CardDescription, CardContent, CardFooter.
 */

import { clsx } from "clsx";
import { forwardRef, type HTMLAttributes } from "react";

type Variant = "default" | "emphasis";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  padding?: "none" | "sm" | "md" | "lg";
}

const variantClass: Record<Variant, string> = {
  default:
    "bg-white border border-[color:var(--color-rule)] text-[color:var(--color-ink)]",
  emphasis: "bg-[color:var(--color-ink)] text-[color:var(--color-paper)] border-0",
};

const paddingClass: Record<NonNullable<CardProps["padding"]>, string> = {
  none: "p-0",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = "default", padding = "lg", className, children, ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      className={clsx("rounded-[16px]", variantClass[variant], paddingClass[padding], className)}
      {...rest}
    >
      {children}
    </div>
  );
});

export function CardHeader({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("flex flex-col gap-1", className)} {...rest} />;
}

export function CardTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={clsx(
        "text-lg font-semibold leading-tight tracking-[-0.01em]",
        className
      )}
      {...rest}
    />
  );
}

export function CardDescription({ className, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={clsx(
        "text-sm opacity-70 leading-[1.55]",
        className
      )}
      {...rest}
    />
  );
}

export function CardContent({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("mt-4", className)} {...rest} />;
}

export function CardFooter({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx("mt-5 flex items-center justify-end gap-2", className)}
      {...rest}
    />
  );
}
