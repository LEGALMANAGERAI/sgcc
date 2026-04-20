"use client";
import { Check } from "lucide-react";

export interface StepDef {
  num: number;
  label: string;
  done: boolean;
}

export function StepSidebar({
  steps,
  current,
  onJump,
}: {
  steps: StepDef[];
  current: number;
  onJump: (n: number) => void;
}) {
  return (
    <aside className="w-64 shrink-0 border-r border-gray-200 bg-white p-4">
      <ol className="space-y-1">
        {steps.map((s) => {
          const active = s.num === current;
          return (
            <li key={s.num}>
              <button
                type="button"
                onClick={() => onJump(s.num)}
                className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-[#0D2340] text-white"
                    : s.done
                    ? "text-gray-700 hover:bg-gray-100"
                    : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${
                    active
                      ? "bg-white text-[#0D2340]"
                      : s.done
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {s.done ? <Check className="w-3.5 h-3.5" /> : s.num}
                </span>
                {s.label}
              </button>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
