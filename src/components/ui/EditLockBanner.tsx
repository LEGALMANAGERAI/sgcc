"use client";

import type { LockHolder } from "@/hooks/useEditLock";

interface Props {
  lockHolder: LockHolder | null;
}

/**
 * Banner que muestra quién tiene el bloqueo de edición de un campo/sección.
 * Se oculta si no hay lock activo de otro usuario.
 */
export function EditLockBanner({ lockHolder }: Props) {
  if (!lockHolder) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
      </svg>
      <span>
        <strong>{lockHolder.nombre}</strong> está editando esta sección
      </span>
    </div>
  );
}
