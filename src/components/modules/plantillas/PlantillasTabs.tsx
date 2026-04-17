"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Puzzle } from "lucide-react";

const TABS = [
  { href: "/plantillas", label: "Plantillas", icon: FileText },
  { href: "/plantillas/clausulas", label: "Cláusulas", icon: Puzzle },
];

export function PlantillasTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b border-gray-200 mb-6">
      {TABS.map((tab) => {
        const active =
          tab.href === "/plantillas"
            ? pathname === "/plantillas"
            : pathname.startsWith(tab.href);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              active
                ? "border-[#1B4F9B] text-[#1B4F9B]"
                : "border-transparent text-gray-500 hover:text-[#0D2340] hover:border-gray-300"
            }`}
          >
            <Icon className="w-4 h-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
