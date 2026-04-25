"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
  LifeBuoy,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { SgccLogo } from "@/components/ui/SgccLogo";

/**
 * StaffSidebar — shell del producto.
 *
 * - Background paper claro #FDFCFA, width 240px
 * - Logo: símbolo SGCC compacto
 * - Nav: Space Grotesk 13px, padding 8px 10px, radius md
 * - Active: ink bg + paper text + dot flow a la izquierda
 * - Badges: mono 10px, pill paper-warm
 * - Secciones: "Principal", "Módulos", "Sistema"
 */

type NavBadgeKey = "vigilancia";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badgeKey?: NavBadgeKey;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    title: "Principal",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Expedientes", href: "/casos", icon: FolderOpen },
      { label: "Agenda", href: "/agenda", icon: Calendar },
    ],
  },
  {
    title: "Módulos",
    items: [
      { label: "Apoderados", href: "/apoderados", icon: Briefcase },
      { label: "Correspondencia", href: "/correspondencia", icon: Mail },
      {
        label: "Vigilancia Judicial",
        href: "/vigilancia",
        icon: Eye,
        badgeKey: "vigilancia",
      },
      { label: "Firmas", href: "/firmas", icon: PenTool },
      { label: "Partes", href: "/partes", icon: Users },
      { label: "Conciliadores", href: "/conciliadores", icon: UserCog },
      { label: "Salas", href: "/salas", icon: DoorOpen },
      { label: "Plantillas", href: "/plantillas", icon: FileText },
      { label: "Tickets", href: "/tickets", icon: LifeBuoy },
      { label: "Reportes", href: "/reportes", icon: BarChart3 },
    ],
  },
  {
    title: "Sistema",
    items: [{ label: "Configuración", href: "/configuracion", icon: Settings }],
  },
];

interface Badges {
  vigilancia?: number;
}

interface Props {
  centerName: string;
  vigilanciaNoLeidas?: number;
}

const STORAGE_KEY = "sgcc-sidebar";

export function StaffSidebar({ centerName, vigilanciaNoLeidas = 0 }: Props) {
  const pathname = usePathname();
  const badges: Badges = { vigilancia: vigilanciaNoLeidas };

  // Estado de visibilidad persistido en localStorage.
  // Aplicamos el data-attribute al <body> para que el <main> (en el server layout)
  // pueda responder con CSS — no podemos mover el estado al padre porque es server.
  const [hidden, setHidden] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    const initiallyHidden = stored === "hidden";
    setHidden(initiallyHidden);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.body.dataset.sidebar = hidden ? "hidden" : "visible";
    localStorage.setItem(STORAGE_KEY, hidden ? "hidden" : "visible");
  }, [hidden, mounted]);

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <>
      {/* Botón flotante para reabrir cuando el sidebar está oculto */}
      {mounted && hidden && (
        <button
          type="button"
          onClick={() => setHidden(false)}
          className="fixed top-4 left-4 z-40 p-2 rounded-lg bg-white border border-[color:var(--color-rule)] shadow-sm hover:bg-[color:var(--color-paper-warm)] transition-colors"
          title="Mostrar menú lateral"
          aria-label="Mostrar menú lateral"
        >
          <PanelLeftOpen className="w-4 h-4 text-[color:var(--color-ink)]" />
        </button>
      )}

      <aside
        className={clsx(
          "fixed inset-y-0 left-0 w-60 flex flex-col z-30 border-r border-[color:var(--color-rule)]",
          "transition-transform duration-200 ease-out",
          mounted && hidden ? "-translate-x-full" : "translate-x-0",
        )}
        style={{ background: "#FDFCFA" }}
        aria-hidden={mounted && hidden}
      >
      {/* Logo + toggle */}
      <div className="px-4 py-5 border-b border-[color:var(--color-rule)] flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <SgccLogo size="sm" showDescriptor={false} />
          <p
            className="text-[11px] uppercase tracking-[0.12em] truncate mt-2 font-medium"
            style={{ color: "rgba(10,22,40,0.6)" }}
          >
            {centerName}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setHidden(true)}
          className="p-1.5 rounded-md hover:bg-[color:var(--color-paper-warm)] transition-colors flex-shrink-0"
          title="Ocultar menú lateral"
          aria-label="Ocultar menú lateral"
        >
          <PanelLeftClose className="w-4 h-4 text-[color:var(--color-ink)] opacity-60" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {sections.map((section) => (
          <div key={section.title} className="mb-5 last:mb-0">
            <p className="px-[10px] mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[color:var(--color-ink)] opacity-50">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const badgeCount = item.badgeKey ? badges[item.badgeKey] ?? 0 : 0;
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={clsx(
                        "relative flex items-center gap-2.5 rounded-[8px]",
                        "py-2 pl-[10px] pr-[10px] text-[13px] transition-colors",
                        active
                          ? "bg-[color:var(--color-ink)] text-[color:var(--color-paper)] font-medium"
                          : "text-[color:var(--color-ink)] opacity-80 hover:opacity-100 hover:bg-[color:var(--color-paper-warm)]"
                      )}
                    >
                      {active && (
                        <span
                          aria-hidden
                          className="absolute left-[-6px] top-1/2 -translate-y-1/2 h-4 w-1 rounded-full bg-[color:var(--color-flow)]"
                        />
                      )}
                      <item.icon className="w-4 h-4 flex-shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {badgeCount > 0 && (
                        <span
                          className={clsx(
                            "inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-full",
                            "font-mono text-[10px] font-medium",
                            active
                              ? "bg-white/15 text-[color:var(--color-paper)]"
                              : "bg-[color:var(--color-paper-warm)] text-[color:var(--color-ink-soft)]"
                          )}
                          style={{ fontFamily: "var(--font-mono), ui-monospace, monospace" }}
                        >
                          {badgeCount > 99 ? "99+" : badgeCount}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Bottom — logout */}
      <div className="px-3 py-4 border-t border-[color:var(--color-rule)]">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className={clsx(
            "w-full flex items-center gap-2.5 rounded-[8px]",
            "py-2 pl-[10px] pr-[10px] text-[13px]",
            "text-[color:var(--color-ink)] opacity-70 hover:opacity-100",
            "hover:bg-[color:var(--color-paper-warm)] transition-colors"
          )}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          Cerrar sesión
        </button>
      </div>
    </aside>
    </>
  );
}
