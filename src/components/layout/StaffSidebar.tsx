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
  Scale,
  Briefcase,
  Mail,
  Eye,
  PenTool,
} from "lucide-react";
import { signOut } from "next-auth/react";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Casos", href: "/casos", icon: FolderOpen },
  { label: "Agenda", href: "/agenda", icon: Calendar },
  { label: "Apoderados", href: "/apoderados", icon: Briefcase },
  { label: "Correspondencia", href: "/correspondencia", icon: Mail },
  { label: "Vigilancia Judicial", href: "/vigilancia", icon: Eye },
  { label: "Firmas", href: "/firmas", icon: PenTool },
  { label: "Partes", href: "/partes", icon: Users },
  { label: "Conciliadores", href: "/conciliadores", icon: UserCog },
  { label: "Salas", href: "/salas", icon: DoorOpen },
  { label: "Plantillas", href: "/plantillas", icon: FileText },
  { label: "Reportes", href: "/reportes", icon: BarChart3 },
];

const bottomItems = [
  { label: "Configuración", href: "/configuracion", icon: Settings },
];

interface Props {
  centerName: string;
}

export function StaffSidebar({ centerName }: Props) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <aside className="fixed inset-y-0 left-0 w-60 bg-[#0D2340] flex flex-col z-30">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Scale className="w-6 h-6 text-[#B8860B]" />
          <div>
            <p className="text-white font-bold text-sm leading-tight">SGCC</p>
            <p className="text-white/50 text-xs truncate max-w-[140px]">{centerName}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-0.5">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  isActive(item.href)
                    ? "bg-[#B8860B] text-white font-medium"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                )}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </Link>
            </li>
          ))}
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
                ? "bg-[#B8860B] text-white font-medium"
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
