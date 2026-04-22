/**
 * Button — primitiva SGCC.
 *
 * Variants:
 *   primary     — ink bg / paper text / flow-deep hover (default)
 *   secondary   — transparent bg / ink border
 *   ghost       — solo texto, underline en hover
 *   destructive — terracotta bg / paper text
 *
 * Sizes: sm (32px), md (40px, default), lg (48px)
 */

import { clsx } from "clsx";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
}

const base =
  "inline-flex items-center justify-center gap-2 font-medium tracking-[-0.01em] " +
  "transition-colors duration-150 ease-out rounded-[12px] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " +
  "focus-visible:ring-[color:var(--color-flow)] focus-visible:ring-offset-[color:var(--color-paper)] " +
  "disabled:opacity-50 disabled:pointer-events-none";

const sizeClass: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-6 text-sm",
  lg: "h-12 px-7 text-[15px]",
};

const variantClass: Record<Variant, string> = {
  primary:
    "bg-[color:var(--color-ink)] text-[color:var(--color-paper)] " +
    "hover:bg-[color:var(--color-flow-deep)]",
  secondary:
    "bg-transparent text-[color:var(--color-ink)] " +
    "border-[1.5px] border-[color:var(--color-ink)] " +
    "hover:bg-[color:var(--color-ink)] hover:text-[color:var(--color-paper)]",
  ghost:
    "bg-transparent text-[color:var(--color-ink)] " +
    "hover:underline underline-offset-4 decoration-[color:var(--color-flow)] decoration-2",
  destructive:
    "bg-[color:var(--color-terracotta)] text-[color:var(--color-paper)] " +
    "hover:opacity-90",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading,
    iconLeft,
    iconRight,
    fullWidth,
    className,
    disabled,
    children,
    type = "button",
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={clsx(
        base,
        sizeClass[size],
        variantClass[variant],
        fullWidth && "w-full",
        className
      )}
      {...rest}
    >
      {loading ? (
        <Spinner />
      ) : (
        <>
          {iconLeft}
          {children}
          {iconRight}
        </>
      )}
    </button>
  );
});

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="30 60"
      />
    </svg>
  );
}
