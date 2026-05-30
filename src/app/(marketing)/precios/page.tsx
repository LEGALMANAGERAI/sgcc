"use client";

import { useState } from "react";
import Link from "next/link";
import { PricingCarousel } from "@/components/landing/PricingCarousel";
import { ChevronDown, ChevronUp, Sparkles, PenTool, Brain, Eye } from "lucide-react";

const EXCEDENTES = [
  { nombre: "Caso de conciliación adicional", precio: "$15.000 COP" },
  { nombre: "Caso de insolvencia adicional", precio: "$60.000 COP" },
  { nombre: "Persona adicional en el centro", precio: "$45.000 COP / mes" },
];

const ADDONS = [
  {
    icon: PenTool,
    nombre: "Firma electrónica",
    desc: "Vía Legal Manager. OTP por email/SMS, foto de identidad, QR de verificación pública.",
    precio: "$8.000 COP / firma",
  },
  {
    icon: Brain,
    nombre: "Norma Leal (IA jurídica)",
    desc: "Asistente IA con base de normativa colombiana actualizada, integrado al expediente.",
    precio: "$190.000 COP / mes",
  },
  {
    icon: Eye,
    nombre: "Vigilancia Rama Judicial",
    desc: "Monitoreo automático de actuaciones para casos vinculados a procesos judiciales.",
    precio: "$290.000 COP / mes",
  },
];

const FAQS = [
  {
    q: "¿Cómo funciona la prueba gratuita?",
    a: "Todos los planes pagos incluyen 15 días de prueba sin tarjeta. Acceso completo al plan elegido, sin restricciones funcionales. Si no continúas, tu cuenta queda en pausa y conservas el acceso a tus datos por 30 días.",
  },
  {
    q: "¿Puedo cambiar de plan?",
    a: "Sí, en cualquier momento. Si subes de plan, la diferencia se prorratea. Si bajas, el cambio aplica al siguiente ciclo de facturación. Los datos y configuración se conservan.",
  },
  {
    q: "¿Qué pasa si me excedo del cupo de casos o personas?",
    a: "No bloqueamos el centro. Aplicamos la tarifa por excedente (ver tabla). Te avisamos al 80%, 100% y 120% del cupo para que decidas si subir de plan o pagar excedentes ese mes.",
  },
  {
    q: "¿Quién aplica al plan Académico gratis?",
    a: "Consultorios jurídicos universitarios habilitados por el Ministerio de Justicia. Validamos con su resolución de habilitación. Pensado para formación de estudiantes en conciliación.",
  },
  {
    q: "¿SIGECC cumple con SICAAC y Ley 2445?",
    a: "Sí. Generamos reportes y exportaciones compatibles con SICAAC, y todo el módulo de insolvencia está construido bajo Ley 2445/2025 + Decreto 1136/2025 (audiencias virtuales, habilitación tecnológica, propuestas de pago, votación de acreedores).",
  },
  {
    q: "¿Mis datos están seguros?",
    a: "Hospedaje en Supabase (Brasil, SOC 2 Type II), cifrado en tránsito (TLS 1.2/1.3) y en reposo (AES-256), aislamiento multi-tenant en cada consulta, backups diarios. Cumplimos Ley 1581/2012 sobre protección de datos personales.",
  },
];

export default function PreciosPage() {
  const [anual, setAnual] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <main className="bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-20">
        {/* Header */}
        <div className="text-center mb-10">
          <p className="text-xs font-semibold text-[#B8860B] uppercase tracking-widest mb-3">
            Pricing
          </p>
          <h1 className="text-4xl sm:text-5xl font-black text-[#0D2340] mb-4">
            Planes y tarifas
          </h1>
          <p className="text-base sm:text-lg text-[#64748B] max-w-2xl mx-auto">
            Desde consultorios jurídicos universitarios hasta cámaras de comercio. Empieza gratis
            con el plan Académico o prueba 15 días sin tarjeta cualquier plan pago.
          </p>
        </div>

        {/* Toggle mensual/anual */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <span className={`text-sm font-bold ${!anual ? "text-[#0D2340]" : "text-[#7A8FA6]"}`}>
            Mensual
          </span>
          <button
            onClick={() => setAnual(!anual)}
            className={`relative w-14 h-7 rounded-full transition-colors ${
              anual ? "bg-[#B8860B]" : "bg-[#DDE4ED]"
            }`}
            role="switch"
            aria-checked={anual}
          >
            <div
              className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                anual ? "translate-x-7" : "translate-x-0.5"
              }`}
            />
          </button>
          <span className={`text-sm font-bold ${anual ? "text-[#0D2340]" : "text-[#7A8FA6]"}`}>
            Anual <span className="text-[#B8860B] text-xs font-bold">-20%</span>
          </span>
        </div>

        {/* Trial banner */}
        <div className="bg-[#0D2340] rounded-2xl p-6 mb-4 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Sparkles className="w-5 h-5 text-[#B8860B]" />
            <h2 className="text-xl font-black text-white">Prueba gratuita — 15 días</h2>
          </div>
          <p className="text-sm text-white/60 mb-3 max-w-xl mx-auto">
            Sin tarjeta de crédito. Accede a todos los módulos del plan elegido y decide al final si
            te quedas. Tus datos se conservan 30 días si pausas.
          </p>
          <Link
            href="/registro"
            className="inline-block text-sm font-bold text-[#0D2340] bg-[#B8860B] px-8 py-3 rounded-lg hover:bg-[#D4A017] transition-colors"
          >
            Empezar prueba
          </Link>
        </div>

        {/* Carrusel de planes */}
        <div className="mb-16">
          <PricingCarousel anual={anual} />
        </div>

        {/* Tarifas adicionales */}
        <div className="bg-white rounded-2xl border border-[#DDE4ED] p-8 mb-10">
          <h2 className="text-xl font-black text-[#0D2340] mb-2">Tarifas por excedente</h2>
          <p className="text-sm text-[#7A8FA6] mb-6">
            Cuando superes el cupo de tu plan, se aplican estas tarifas por unidad adicional. No
            bloqueamos el centro — tú decides si pagar el excedente o subir de plan.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {EXCEDENTES.map((e) => (
              <div
                key={e.nombre}
                className="flex items-center justify-between bg-[#F8FAFC] rounded-lg p-4 border border-[#E2E8F0]"
              >
                <span className="text-sm text-[#3D5068] font-medium">{e.nombre}</span>
                <span className="text-sm font-black text-[#0D2340] whitespace-nowrap">
                  {e.precio}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Add-ons */}
        <div className="bg-white rounded-2xl border border-[#DDE4ED] p-8 mb-10">
          <h2 className="text-xl font-black text-[#0D2340] mb-2">Complementos opcionales</h2>
          <p className="text-sm text-[#7A8FA6] mb-6">
            Módulos extra disponibles para cualquier plan pago. Se suman al cargo mensual.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {ADDONS.map((a) => {
              const Icon = a.icon;
              return (
                <div
                  key={a.nombre}
                  className="bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] p-5 hover:border-[#B8860B]/40 hover:shadow-md transition-all"
                >
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#0D2340] to-[#1B4F9B] flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5 text-[#B8860B]" />
                  </div>
                  <h3 className="text-sm font-black text-[#0D2340] mb-1">{a.nombre}</h3>
                  <p className="text-xs text-[#64748B] leading-relaxed mb-3">{a.desc}</p>
                  <p className="text-sm font-black text-[#B8860B]">{a.precio}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* FAQs */}
        <div className="bg-white rounded-2xl border border-[#DDE4ED] p-8 mb-10">
          <h2 className="text-xl font-black text-[#0D2340] mb-2">Preguntas frecuentes</h2>
          <p className="text-sm text-[#7A8FA6] mb-6">
            ¿No encuentras tu respuesta? Escríbenos a{" "}
            <a
              href="mailto:soporte@sigecc.co"
              className="text-[#B8860B] font-semibold hover:underline"
            >
              soporte@sigecc.co
            </a>
            .
          </p>
          <div className="space-y-2">
            {FAQS.map((faq, i) => {
              const isOpen = openFaq === i;
              return (
                <div
                  key={faq.q}
                  className="border border-[#E2E8F0] rounded-xl overflow-hidden"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    className="w-full flex items-center justify-between gap-4 px-5 py-4 bg-white hover:bg-[#F8FAFC] transition-colors text-left"
                  >
                    <span className="text-sm font-bold text-[#0D2340]">{faq.q}</span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-[#B8860B] flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#64748B] flex-shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-5 py-4 bg-[#F8FAFC] border-t border-[#E2E8F0]">
                      <p className="text-sm text-[#475569] leading-relaxed">{faq.a}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA Final */}
        <div className="text-center bg-gradient-to-r from-[#0D2340] to-[#1B4F9B] rounded-2xl p-10">
          <h2 className="text-2xl font-black text-white mb-3">¿Listo para empezar?</h2>
          <p className="text-white/70 mb-6">15 días gratis. Sin tarjeta de crédito. Cancela cuando quieras.</p>
          <Link
            href="/registro"
            className="inline-block text-sm font-bold text-[#0D2340] bg-[#B8860B] px-8 py-3 rounded-lg hover:bg-[#D4A017] transition-colors"
          >
            Empezar prueba gratuita
          </Link>
        </div>
      </div>
    </main>
  );
}
