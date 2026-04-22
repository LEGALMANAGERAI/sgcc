/**
 * Input — primitiva SGCC.
 *
 * - Border 1.5px rule; focus border flow
 * - Radius md (8px), padding 12px 16px
 * - Label uppercase letter-spacing 0.15em encima del input
 * - Helper text 11px opacidad 0.6
 * - Error: border + helper en terracotta
 */

import { clsx } from "clsx";
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helper?: ReactNode;
  error?: ReactNode;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

const base =
  "w-full rounded-[8px] bg-white px-4 py-3 text-sm text-[color:var(--color-ink)] " +
  "placeholder:opacity-50 placeholder:text-[color:var(--color-ink)] " +
  "border-[1.5px] transition-colors duration-150 ease-out " +
  "focus:outline-none disabled:opacity-50 disabled:pointer-events-none";

const borderOk = "border-[color:var(--color-rule)] focus:border-[color:var(--color-flow)]";
const borderErr = "border-[color:var(--color-terracotta)] focus:border-[color:var(--color-terracotta)]";

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, helper, error, leadingIcon, trailingIcon, className, id, ...rest },
  ref
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = error || helper ? `${inputId}-desc` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-[11px] font-medium uppercase tracking-[0.15em] text-[color:var(--color-ink)] opacity-80"
        >
          {label}
        </label>
      )}

      <div className="relative">
        {leadingIcon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-ink)] opacity-60">
            {leadingIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy}
          className={clsx(
            base,
            error ? borderErr : borderOk,
            leadingIcon && "pl-10",
            trailingIcon && "pr-10",
            className
          )}
          {...rest}
        />
        {trailingIcon && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--color-ink)] opacity-60">
            {trailingIcon}
          </span>
        )}
      </div>

      {(error || helper) && (
        <p
          id={describedBy}
          className={clsx(
            "text-[11px] leading-snug",
            error
              ? "text-[color:var(--color-terracotta)]"
              : "text-[color:var(--color-ink)] opacity-60"
          )}
        >
          {error ?? helper}
        </p>
      )}
    </div>
  );
});
