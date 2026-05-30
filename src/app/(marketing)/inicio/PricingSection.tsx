"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";

interface PlanInfo {
  key: string;
  nombre: string;
  target: string;
  precioMensual: number;
  precioAnual: number;
  ctaLabel: string;
  href: string;
  highlight?: boolean;
  features: string[];
  contactar?: boolean;
}

const PLANES: PlanInfo[] = [
  {
    key: "academico",
    nombre: "Académico",
    target: "Consultorios jurídicos universitarios",
    precioMensual: 0,
    precioAnual: 0,
    ctaLabel: "Empezar gratis",
    href: "/registro",
    features: [
      "50 casos / año",
      "5 personas en el centro",
      "Conciliación + acuerdos de apoyo",
      "Plantillas y actas listas",
      "Portal de partes",
      "Soporte por correo",
    ],
  },
  {
    key: "esencial",
    nombre: "Privado Esencial",
    target: "Centro privado pequeño / notarial chico",
    precioMensual: 490000,
    precioAnual: 392000,
    ctaLabel: "Empezar prueba",
    href: "/registro",
    features: [
      "100 casos / año",
      "5 personas (conciliadores + staff)",
      "Conciliación + insolvencia (Ley 2445)",
      "Audiencias virtuales (Dec. 1136/2025)",
      "Portal de partes + widget embebible",
      "SICAAC + radicado configurable",
      "Soporte 8x5",
    ],
  },
  {
    key: "profesional",
    nombre: "Privado Profesional",
    target: "Centro privado mediano",
    precioMensual: 1090000,
    precioAnual: 872000,
    ctaLabel: "Empezar prueba",
    href: "/registro",
    highlight: true,
    features: [
      "400 casos / año",
      "15 personas",
      "Todo Esencial +",
      "Reglamento interno digital",
      "Firma electrónica integrada",
      "Plantillas avanzadas + cláusulas",
      "Sugerencia automática de audiencias",
      "Soporte prioritario",
    ],
  },
  {
    key: "notarial",
    nombre: "Notarial / Multi-sede",
    target: "Notarías + redes multi-sede",
    precioMensual: 1990000,
    precioAnual: 1592000,
    ctaLabel: "Empezar prueba",
    href: "/registro",
    features: [
      "800 casos / año",
      "25 personas",
      "Multi-sede con dashboard consolidado",
      "Roles avanzados (multi-centro)",
      "Reportes ejecutivos",
      "Integración SICAAC + Rama Judicial",
      "Onboarding asistido",
    ],
  },
  {
    key: "enterprise",
    nombre: "Enterprise",
    target: "Cámaras y redes de centros",
    precioMensual: 3500000,
    precioAnual: 3500000,
    ctaLabel: "Contactar",
    href: "mailto:ventas@sigecc.co?subject=Cotización%20Enterprise",
    contactar: true,
    features: [
      "Casos ilimitados",
      "Personas ilimitadas",
      "SLA dedicado 99.9%",
      "Onboarding y capacitación in-house",
      "Integraciones a medida",
      "Account manager asignado",
      "Despliegue regional dedicado",
    ],
  },
];

function formatCOP(valor: number): string {
  if (valor === 0) return "Gratis";
  return "$" + valor.toLocaleString("es-CO");
}

export function PricingSection() {
  const [anual, setAnual] = useState(false);

  return (
    <section id="precios" className="bg-white py-16 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 scroll-animate animate-fade-in-up">
          <p className="text-xs font-semibold text-[#B8860B] uppercase tracking-widest mb-3">
            Pricing
          </p>
          <h2 className="text-2xl sm:text-3xl lg:text-5xl font-black text-[#0D2340] tracking-tight">
            Planes para cada tamaño de centro
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#64748B] max-w-2xl mx-auto">
            Desde consultorios jurídicos universitarios hasta cámaras de comercio. Todos los planes
            incluyen cumplimiento Ley 2445 y Decreto 1136/2025.
          </p>
        </div>

        {/* Toggle mensual/anual */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <span
            className={`text-sm font-semibold transition-colors duration-300 ${
              !anual ? "text-[#0D2340]" : "text-[#94A3B8]"
            }`}
          >
            Mensual
          </span>
          <button
            onClick={() => setAnual(!anual)}
            className="relative w-14 h-7 bg-[#0D2340] rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8860B] focus-visible:ring-offset-2"
            role="switch"
            aria-checked={anual}
            aria-label="Cambiar entre precios mensuales y anuales"
          >
            <span
              className={`absolute top-0.5 w-6 h-6 bg-[#B8860B] rounded-full transition-all duration-300 shadow-md ${
                anual ? "left-7" : "left-0.5"
              }`}
            />
          </button>
          <span
            className={`text-sm font-semibold transition-colors duration-300 ${
              anual ? "text-[#0D2340]" : "text-[#94A3B8]"
            }`}
          >
            Anual
          </span>
          {anual && (
            <span className="text-xs font-bold text-[#B8860B] bg-[#B8860B]/10 px-3 py-1 rounded-full animate-fade-in">
              -20%
            </span>
          )}
        </div>

        {/* Grid de 5 cards (responsive) */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-5">
          {PLANES.map((plan) => {
            const isGratis = plan.precioMensual === 0;
            const isContactar = plan.contactar;
            const precio = anual ? plan.precioAnual : plan.precioMensual;
            const ahorroAnual = plan.precioMensual > 0 ? (plan.precioMensual - plan.precioAnual) * 12 : 0;

            return (
              <div
                key={plan.key}
                className={`relative flex flex-col rounded-2xl border p-6 transition-all duration-500 hover:shadow-xl ${
                  plan.highlight
                    ? "border-[#B8860B] shadow-xl shadow-[#B8860B]/10 ring-1 ring-[#B8860B]/20 xl:scale-105 bg-white z-10"
                    : "border-[#E2E8F0] hover:border-[#CBD5E1] bg-white"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="text-xs font-bold text-white bg-gradient-to-r from-[#B8860B] to-[#D4A017] px-5 py-1.5 rounded-full shadow-lg shadow-[#B8860B]/30 whitespace-nowrap">
                      Más popular
                    </span>
                  </div>
                )}

                <div className="mb-5">
                  <h3 className="text-base font-black text-[#0D2340]">{plan.nombre}</h3>
                  <p className="text-xs text-[#94A3B8] mt-1 min-h-[2rem]">{plan.target}</p>
                </div>

                <div className="mb-6">
                  {isGratis ? (
                    <div>
                      <span className="text-4xl font-black text-[#0D2340]">$0</span>
                      <span className="text-xs text-[#94A3B8] block mt-1">Sin costo</span>
                    </div>
                  ) : isContactar ? (
                    <div>
                      <span className="text-2xl font-black text-[#0D2340]">desde</span>
                      <div>
                        <span className="text-3xl font-black text-[#0D2340]">{formatCOP(precio)}</span>
                      </div>
                      <span className="text-xs text-[#94A3B8] block mt-1">/mes — custom</span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-3xl font-black text-[#0D2340]">{formatCOP(precio)}</span>
                      <span className="text-xs text-[#94A3B8] ml-1">COP/mes</span>
                      {anual && (
                        <p className="text-[11px] text-[#B8860B] mt-1 font-medium">
                          Ahorras {formatCOP(ahorroAnual)} al año
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <Link
                  href={plan.href}
                  className={`w-full flex items-center justify-center gap-2 text-sm font-bold py-3 rounded-xl transition-all duration-300 mb-6 ${
                    plan.highlight
                      ? "text-white bg-gradient-to-r from-[#B8860B] to-[#D4A017] hover:from-[#9A7209] hover:to-[#B8860B] shadow-lg shadow-[#B8860B]/20"
                      : "text-[#0D2340] border-2 border-[#E2E8F0] hover:border-[#B8860B] hover:text-[#B8860B]"
                  }`}
                >
                  {plan.ctaLabel}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>

                <ul className="space-y-3 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          plan.highlight ? "bg-[#B8860B]/10" : "bg-[#F1F5F9]"
                        }`}
                      >
                        <Check
                          className={`w-3 h-3 ${plan.highlight ? "text-[#B8860B]" : "text-[#64748B]"}`}
                        />
                      </div>
                      <span className="text-xs text-[#475569] leading-snug">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-[#94A3B8] mt-8">
          Todos los precios en COP, IVA no incluido. Prueba 15 días sin tarjeta para planes pagos.
        </p>
      </div>
    </section>
  );
}
