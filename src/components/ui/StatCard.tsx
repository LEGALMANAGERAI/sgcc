import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";

/**
 * StatCard — KPI card alineado con "Card emphasis" del brief (§4.3).
 *
 * Mantengo la API pública (prop `color`) pero mapeo los nombres legacy
 * (navy/gold/green/red/blue/purple) a la paleta SGCC para no romper
 * llamadores existentes.
 */

interface Props {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: "navy" | "gold" | "green" | "red" | "blue" | "purple";
  trend?: string;
}

type Tone = { bg: string; text: string; icon: string; iconBg: string };

const tones: Record<NonNullable<Props["color"]>, Tone> = {
  // Emphasis (ink) — default KPI principal
  navy: {
    bg: "bg-[color:var(--color-ink)]",
    text: "text-[color:var(--color-paper)]",
    icon: "text-[color:var(--color-flow)]",
    iconBg: "bg-white/10",
  },
  // Amber — warnings / plazos próximos
  gold: {
    bg: "bg-[rgba(245,158,11,0.08)]",
    text: "text-[color:var(--color-ink)]",
    icon: "text-[color:var(--color-amber)]",
    iconBg: "bg-[rgba(245,158,11,0.18)]",
  },
  // Flow — success / KPIs positivos
  green: {
    bg: "bg-[rgba(20,184,166,0.08)]",
    text: "text-[color:var(--color-ink)]",
    icon: "text-[color:var(--color-flow-deep)]",
    iconBg: "bg-[rgba(20,184,166,0.18)]",
  },
  // Terracotta — danger / vencidos
  red: {
    bg: "bg-[rgba(198,88,64,0.08)]",
    text: "text-[color:var(--color-ink)]",
    icon: "text-[color:var(--color-terracotta)]",
    iconBg: "bg-[rgba(198,88,64,0.18)]",
  },
  // Ink-soft — info secundario
  blue: {
    bg: "bg-[rgba(27,49,82,0.06)]",
    text: "text-[color:var(--color-ink)]",
    icon: "text-[color:var(--color-ink-soft)]",
    iconBg: "bg-[rgba(27,49,82,0.12)]",
  },
  // Activo intermedio (reutiliza flow-deep)
  purple: {
    bg: "bg-[rgba(20,184,166,0.06)]",
    text: "text-[color:var(--color-ink)]",
    icon: "text-[color:var(--color-flow-deep)]",
    iconBg: "bg-[rgba(20,184,166,0.14)]",
  },
};

export function StatCard({ label, value, icon: Icon, color = "navy", trend }: Props) {
  const c = tones[color];
  return (
    <div className={clsx("rounded-[16px] p-5", c.bg)} style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="flex items-start justify-between">
        <div>
          <p className={clsx("text-sm font-medium opacity-70", c.text)}>{label}</p>
          <p className={clsx("text-3xl font-bold mt-1 tracking-[-0.02em]", c.text)}>
            {value}
          </p>
          {trend && <p className={clsx("text-xs mt-1 opacity-60", c.text)}>{trend}</p>}
        </div>
        <div className={clsx("p-2 rounded-[10px]", c.iconBg)}>
          <Icon className={clsx("w-6 h-6", c.icon)} />
        </div>
      </div>
    </div>
  );
}
