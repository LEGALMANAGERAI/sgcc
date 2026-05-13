"use client";

import { useRef, ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Envoltorio de las tablas grandes de acreencias.
 *
 * - Agrega botones de scroll horizontal (< / >) visibles encima de la tabla,
 *   para que el usuario no tenga que bajar al fondo del contenedor para
 *   encontrar la scrollbar.
 * - Habilita navegacion estilo Excel entre celdas editables con las flechas
 *   del teclado:
 *     ArrowLeft / ArrowRight  -> columna anterior / siguiente (cuando el
 *       cursor del input esta en el borde; no rompe la edicion de texto).
 *     ArrowUp / ArrowDown     -> fila anterior / siguiente (no aplica a
 *       <select> ni a inputs number para no chocar con su comportamiento
 *       natural).
 */

interface Props {
  children: ReactNode;
  className?: string;
}

const EDITABLE_SELECTOR =
  'input:not([type="hidden"]):not([type="checkbox"]):not([readonly]), select, textarea:not([readonly]), [data-keyboard-cell="true"]';

function findEditableInTd(td: Element | null): HTMLElement | null {
  if (!td) return null;
  return td.querySelector<HTMLElement>(EDITABLE_SELECTOR);
}

function focusEditable(el: HTMLElement) {
  el.focus();
  if (el instanceof HTMLInputElement && el.type !== "checkbox") {
    el.select();
  } else if (el.dataset.keyboardCell === "true" && el.tagName === "BUTTON") {
    // El boton actua como celda editable (ej. MoneyInput): un click abre
    // su modo edicion (renderiza el input real con autoFocus).
    (el as HTMLButtonElement).click();
  }
}

function moveHorizontal(el: HTMLElement, direction: "left" | "right") {
  const td = el.closest("td");
  if (!td) return;
  let next = direction === "left" ? td.previousElementSibling : td.nextElementSibling;
  while (next) {
    const editable = findEditableInTd(next);
    if (editable) {
      focusEditable(editable);
      return;
    }
    next = direction === "left" ? next.previousElementSibling : next.nextElementSibling;
  }
}

function moveVertical(el: HTMLElement, direction: "up" | "down") {
  const td = el.closest("td");
  const tr = td?.closest("tr");
  if (!td || !tr) return;
  const colIdx = Array.from(tr.children).indexOf(td);
  if (colIdx < 0) return;

  let nextTr: Element | null =
    direction === "up" ? tr.previousElementSibling : tr.nextElementSibling;

  while (nextTr) {
    const candidateTd = nextTr.children[colIdx];
    if (candidateTd && candidateTd.tagName === "TD") {
      const editable = findEditableInTd(candidateTd);
      if (editable) {
        focusEditable(editable);
        return;
      }
    }
    nextTr = direction === "up" ? nextTr.previousElementSibling : nextTr.nextElementSibling;
  }
}

export function AcreenciasTableShell({ children, className }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollBy(delta: number) {
    scrollRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (!target?.matches?.(EDITABLE_SELECTOR)) return;

    const isSelect = target.tagName === "SELECT";
    const isInput = target.tagName === "INPUT";
    const isTextarea = target.tagName === "TEXTAREA";
    const inputType = isInput ? (target as HTMLInputElement).type.toLowerCase() : null;

    if (e.key === "ArrowRight") {
      if ((isInput && inputType !== "number") || isTextarea) {
        const field = target as HTMLInputElement | HTMLTextAreaElement;
        const len = field.value.length;
        const allSelected = field.selectionStart === 0 && field.selectionEnd === len;
        const atEnd = field.selectionStart === len && field.selectionEnd === len;
        if (!atEnd && !allSelected) return;
      }
      e.preventDefault();
      moveHorizontal(target, "right");
    } else if (e.key === "ArrowLeft") {
      if ((isInput && inputType !== "number") || isTextarea) {
        const field = target as HTMLInputElement | HTMLTextAreaElement;
        const len = field.value.length;
        const allSelected = field.selectionStart === 0 && field.selectionEnd === len;
        const atStart = field.selectionStart === 0 && field.selectionEnd === 0;
        if (!atStart && !allSelected) return;
      }
      e.preventDefault();
      moveHorizontal(target, "left");
    } else if (e.key === "ArrowDown") {
      if (isSelect || inputType === "number" || isTextarea) return;
      e.preventDefault();
      moveVertical(target, "down");
    } else if (e.key === "ArrowUp") {
      if (isSelect || inputType === "number" || isTextarea) return;
      e.preventDefault();
      moveVertical(target, "up");
    }
  }

  return (
    <div className={className} onKeyDown={handleKeyDown}>
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-3 py-1.5 flex items-center justify-between gap-3">
        <p className="text-[11px] text-gray-500 hidden sm:block">
          Flechas del teclado para moverte entre celdas, Shift+rueda para scroll horizontal
        </p>
        <p className="text-[11px] text-gray-500 sm:hidden">
          Desplaza la tabla
        </p>
        <div className="inline-flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => scrollBy(-400)}
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[#0D2340] hover:bg-gray-100 transition-colors"
            aria-label="Desplazar tabla a la izquierda"
            title="Desplazar a la izquierda"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(400)}
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[#0D2340] hover:bg-gray-100 transition-colors"
            aria-label="Desplazar tabla a la derecha"
            title="Desplazar a la derecha"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div ref={scrollRef} className="overflow-x-auto">
        {children}
      </div>
    </div>
  );
}
