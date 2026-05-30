"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { ScrollAnimations } from "./scroll-animate";
import { WhatsAppFloat } from "./whatsapp-float";

/**
 * Layout público de SIGECC (rutas /inicio, /precios, /modulos).
 * Estructura visual clonada de Legal Manager: navbar glass + footer 4 columnas.
 * Paleta navy #0D2340 + azul #1B4F9B.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Cerrar menú mobile al cambiar de ruta
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const navLinks = [
    { href: "/inicio#plataforma", label: "Plataforma" },
    { href: "/precios", label: "Precios" },
    { href: "/modulos", label: "Módulos" },
    { href: "/inicio#testimonios", label: "Testimonios" },
  ];

  return (
    <div className="min-h-screen bg-white font-[family-name:var(--font-display)]">
      <ScrollAnimations />

      {/* Navbar */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled ? "glass-solid shadow-lg shadow-black/5" : "glass"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Wordmark SIGECC: navy con punto azul */}
            <Link href="/" className="flex flex-col items-start flex-shrink-0">
              <span className="text-[10px] font-bold tracking-[0.25em] text-white/60 uppercase leading-none mb-0.5">
                Sistema de Gestión
              </span>
              <span className="text-xl font-black text-white tracking-tight">
                SIGECC<span className="text-[#1B4F9B]">.</span>
              </span>
            </Link>

            {/* Desktop nav — centered */}
            <nav
              className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2"
              aria-label="Navegación principal"
            >
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 text-white/60 hover:text-white hover:bg-white/5"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Desktop actions */}
            <div className="hidden md:flex items-center gap-4">
              <Link
                href="/login"
                className="text-sm text-white/70 hover:text-white transition-colors duration-300 font-medium"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/registro"
                className="text-sm font-bold text-[#0D2340] bg-[#1B4F9B] px-5 py-2.5 rounded-full hover:bg-[#13407F] transition-all duration-300 shadow-lg shadow-[#1B4F9B]/20"
              >
                Empezar gratis
              </Link>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden text-white/70 hover:text-white p-2 rounded-lg transition-colors"
              aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile fullscreen overlay */}
        {menuOpen && (
          <div className="md:hidden fixed inset-0 top-16 bg-[#0D2340]/98 backdrop-blur-xl z-50">
            <div className="flex flex-col items-center justify-center h-full gap-6 -mt-16">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="text-2xl font-bold text-white/80 hover:text-white transition-colors"
                >
                  {link.label}
                </Link>
              ))}
              <div className="border-t border-white/10 w-32 my-2" />
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="text-lg text-white/60 hover:text-white transition-colors"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/registro"
                onClick={() => setMenuOpen(false)}
                className="text-lg font-bold text-[#0D2340] bg-[#1B4F9B] px-8 py-3 rounded-full hover:bg-[#13407F] transition-all"
              >
                Empezar gratis
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Spacer fixed navbar */}
      <div className="h-16" />

      <main>{children}</main>

      <WhatsAppFloat />

      {/* Footer */}
      <footer className="bg-[#0D2340] border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            {/* Brand */}
            <div className="md:col-span-1">
              <Link href="/" className="flex flex-col items-start">
                <span className="text-[10px] font-bold tracking-[0.25em] text-white/60 uppercase leading-none mb-0.5">
                  Sistema de Gestión
                </span>
                <span className="text-xl font-black text-white tracking-tight">
                  SIGECC<span className="text-[#1B4F9B]">.</span>
                </span>
              </Link>
              <p className="text-sm text-white/40 mt-3 leading-relaxed">
                El SaaS de centros de conciliación en Colombia.
              </p>
            </div>

            {/* Producto */}
            <div>
              <h4 className="text-xs font-bold text-white/60 uppercase tracking-wider mb-4">
                Producto
              </h4>
              <div className="space-y-2.5">
                <Link
                  href="/modulos"
                  className="block text-sm text-white/40 hover:text-white/70 transition-colors"
                >
                  Módulos
                </Link>
                <Link
                  href="/precios"
                  className="block text-sm text-white/40 hover:text-white/70 transition-colors"
                >
                  Precios
                </Link>
                <Link
                  href="/registro"
                  className="block text-sm text-white/40 hover:text-white/70 transition-colors"
                >
                  Plan Académico (gratis)
                </Link>
              </div>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-xs font-bold text-white/60 uppercase tracking-wider mb-4">
                Legal
              </h4>
              <div className="space-y-2.5">
                <Link
                  href="/terminos"
                  className="block text-sm text-white/40 hover:text-white/70 transition-colors"
                >
                  Términos y condiciones
                </Link>
                <Link
                  href="/sla"
                  className="block text-sm text-white/40 hover:text-white/70 transition-colors"
                >
                  Acuerdo de nivel de servicio
                </Link>
                <Link
                  href="/cookies"
                  className="block text-sm text-white/40 hover:text-white/70 transition-colors"
                >
                  Política de cookies
                </Link>
              </div>
            </div>

            {/* Cuenta */}
            <div>
              <h4 className="text-xs font-bold text-white/60 uppercase tracking-wider mb-4">
                Cuenta
              </h4>
              <div className="space-y-2.5">
                <Link
                  href="/login"
                  className="block text-sm text-white/40 hover:text-white/70 transition-colors"
                >
                  Iniciar sesión
                </Link>
                <Link
                  href="/registro"
                  className="block text-sm text-white/40 hover:text-white/70 transition-colors"
                >
                  Empezar gratis
                </Link>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-white/30">
              &copy; {new Date().getFullYear()} SIGECC. Todos los derechos reservados. Colombia.
            </p>
            <p className="text-xs text-white/20">
              Cumple Ley 2220/2022 · Ley 2445/2025 · Decreto 1136/2025
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
