import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";

interface Props {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: "navy" | "gold" | "green" | "red" | "blue" | "purple";
  trend?: string;
}

const colors = {
  navy: { bg: "bg-[#0D2340]", text: "text-white", icon: "text-white/80" },
  gold: { bg: "bg-orange-50", text: "text-orange-900", icon: "text-orange-600" },
  green: { bg: "bg-green-50", text: "text-green-900", icon: "text-green-600" },
  red: { bg: "bg-red-50", text: "text-red-900", icon: "text-red-600" },
  blue: { bg: "bg-blue-50", text: "text-blue-900", icon: "text-blue-600" },
  purple: { bg: "bg-purple-50", text: "text-purple-900", icon: "text-purple-600" },
};

export function StatCard({ label, value, icon: Icon, color = "navy", trend }: Props) {
  const c = colors[color];
  return (
    <div className={clsx("rounded-xl p-5 shadow-sm", c.bg)}>
      <div className="flex items-start justify-between">
        <div>
          <p className={clsx("text-sm font-medium", c.text, "opacity-70")}>{label}</p>
          <p className={clsx("text-3xl font-bold mt-1", c.text)}>{value}</p>
          {trend && <p className={clsx("text-xs mt-1", c.text, "opacity-60")}>{trend}</p>}
        </div>
        <div className={clsx("p-2 rounded-lg bg-white/10")}>
          <Icon className={clsx("w-6 h-6", c.icon)} />
        </div>
      </div>
    </div>
  );
}
