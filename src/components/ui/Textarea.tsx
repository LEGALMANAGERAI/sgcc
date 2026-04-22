/**
 * Textarea — primitiva SGCC. Comparte tokens visuales con Input.
 */

import { clsx } from "clsx";
import { forwardRef, useId, type TextareaHTMLAttributes, type ReactNode } from "react";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helper?: ReactNode;
  error?: ReactNode;
}

const base =
  "w-full rounded-[8px] bg-white px-4 py-3 text-sm text-[color:var(--color-ink)] " +
  "placeholder:opacity-50 placeholder:text-[color:var(--color-ink)] " +
  "border-[1.5px] transition-colors duration-150 ease-out resize-y " +
  "focus:outline-none disabled:opacity-50 disabled:pointer-events-none";

const borderOk = "border-[color:var(--color-rule)] focus:border-[color:var(--color-flow)]";
const borderErr = "border-[color:var(--color-terracotta)] focus:border-[color:var(--color-terracotta)]";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, helper, error, className, id, rows = 4, ...rest },
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
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy}
        className={clsx(base, error ? borderErr : borderOk, className)}
        {...rest}
      />
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
