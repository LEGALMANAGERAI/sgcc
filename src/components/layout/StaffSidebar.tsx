"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  LayoutDashboard,
  FolderOpen,
  Calendar,
  Users,
  UserCog,
  DoorOpen,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  Briefcase,
  Mail,
  Eye,
  PenTool,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { SgccLogo } from "@/components/ui/SgccLogo";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, badgeKey: null },
  { label: "Casos", href: "/casos", icon: FolderOpen, badgeKey: null },
  { label: "Agenda", href: "/agenda", icon: Calendar, badgeKey: null },
  { label: "Apoderados", href: "/apoderados", icon: Briefcase, badgeKey: null },
  { label: "Correspondencia", href: "/correspondencia", icon: Mail, badgeKey: null },
  { label: "Vigilancia Judicial", href: "/vigilancia", icon: Eye, badgeKey: "vigilancia" as const },
  { label: "Firmas", href: "/firmas", icon: PenTool, badgeKey: null },
  { label: "Partes", href: "/partes", icon: Users, badgeKey: null },
  { label: "Conciliadores", href: "/conciliadores", icon: UserCog, badgeKey: null },
  { label: "Salas", href: "/salas", icon: DoorOpen, badgeKey: null },
  { label: "Plantillas", href: "/plantillas", icon: FileText, badgeKey: null },
  { label: "Reportes", href: "/reportes", icon: BarChart3, badgeKey: null },
];

const bottomItems = [
  { label: "Configuración", href: "/configuracion", icon: Settings },
];

interface Badges {
  vigilancia?: number;
}

interface Props {
  centerName: string;
  vigilanciaNoLeidas?: number;
}

export function StaffSidebar({ centerName, vigilanciaNoLeidas = 0 }: Props) {
  const pathname = usePathname();

  const badges: Badges = { vigilancia: vigilanciaNoLeidas };

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <aside className="fixed inset-y-0 left-0 w-60 bg-[#0D2340] flex flex-col z-30">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-white/10">
        <SgccLogo size="sm" showText={false} darkBg />
        <p className="text-white/50 text-xs truncate mt-1.5">{centerName}</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const badgeCount = item.badgeKey ? badges[item.badgeKey] ?? 0 : 0;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={clsx(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                    isActive(item.href)
                      ? "bg-[#1B4F9B] text-white font-medium"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {badgeCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                      {badgeCount > 99 ? "99+" : badgeCount}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-white/10 space-y-0.5">
        {bottomItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
              isActive(item.href)
                ? "bg-[#1B4F9B] text-white font-medium"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            )}
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            {item.label}
          </Link>
        ))}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
