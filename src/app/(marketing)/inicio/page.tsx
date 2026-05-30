import Link from "next/link";
import {
  Shield,
  ArrowRight,
  Star,
  Check,
  FolderOpen,
  Calendar,
  Gavel,
  Users,
  FileText,
  Bell,
  PenTool,
  MessageSquare,
  Hash,
  Briefcase,
  BookOpen,
  ClipboardList,
  Building2,
} from "lucide-react";
import { PricingSection } from "./PricingSection";

const MODULOS = [
  { nombre: "Casos / expedientes", icon: FolderOpen, desc: "Conciliación, insolvencia y acuerdos de apoyo en un solo lugar." },
  { nombre: "Audiencias", icon: Gavel, desc: "Programación, recordatorios y actas con plantillas listas." },
  { nombre: "Agenda", icon: Calendar, desc: "Vista por conciliador con sugerencia automática de cupos." },
  { nombre: "Insolvencia (Ley 2445)", icon: Building2, desc: "Acreencias, propuestas, votación y acuerdos PNNC." },
  { nombre: "Apoderados y poderes", icon: Briefcase, desc: "Carga, firma y verificación de poderes con signed URLs." },
  { nombre: "Portal de partes", icon: Users, desc: "Acceso seguro al expediente para convocantes y convocados." },
  { nombre: "SICAAC", icon: ClipboardList, desc: "Registro paralelo de expedientes para reportes oficiales." },
  { nombre: "Plantillas y actas", icon: FileText, desc: "Biblioteca de actas con generación PDF/Word y márgenes oficiales." },
  { nombre: "Reglamento interno", icon: BookOpen, desc: "Documento del centro versionado y disponible para staff." },
  { nombre: "Firma electrónica", icon: PenTool, desc: "Integración con Legal Manager para firma con validez legal." },
  { nombre: "Tickets", icon: MessageSquare, desc: "Soporte interno entre partes y staff con adjuntos." },
  { nombre: "Radicado configurable", icon: Hash, desc: "Numeración por centro con consecutivos sin colisión." },
];

const TESTIMONIOS = [
  {
    quote:
      "SIGECC nos permitió cumplir Ley 2445 desde el primer día. La votación de acreedores y el portal de partes son justo lo que el centro necesitaba.",
    nombre: "Dra. María López",
    cargo: "Directora, Centro de Conciliación Equilibra",
    iniciales: "ML",
  },
  {
    quote:
      "Programamos audiencias virtuales en minutos y el acta queda generada en automático. Antes tomaba media hora por audiencia.",
    nombre: "Dr. Carlos Ramírez",
    cargo: "Secretario General, Cámara de Comercio Regional",
    iniciales: "CR",
  },
  {
    quote:
      "El portal de partes redujo a la mitad las llamadas al centro. Las personas ya consultan su caso solas y nosotros nos enfocamos en conciliar.",
    nombre: "Dra. Ana Rodríguez",
    cargo: "Coordinadora, Centro Notarial San Andrés",
    iniciales: "AR",
  },
];

const NORMAS = [
  "Ley 2220/2022",
  "Ley 2445/2025",
  "Decreto 1136/2025",
  "Habilitación SICAAC",
];

export default function LandingPage() {
  return (
    <>
      {/* ===== HERO ===== */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden bg-gradient-to-br from-[#0D2340] via-[#0D2340] to-[#1B4F9B]">
        {/* Halos decorativos */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="absolute top-1/4 -left-32 w-96 h-96 bg-[#B8860B]/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 -right-32 w-[28rem] h-[28rem] bg-[#1B4F9B]/30 rounded-full blur-3xl" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#B8860B]/30 to-transparent" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24 grid lg:grid-cols-2 gap-12 items-center w-full">
          {/* Columna izquierda — copy + CTAs */}
          <div>
            <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#B8860B]/10 border border-[#B8860B]/30 text-[#D4A017] text-xs font-semibold rounded-full mb-6 backdrop-blur-sm">
              <Shield className="w-3.5 h-3.5" />
              Habilitación Ley 2445 lista
            </span>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.05] tracking-tight">
              El SaaS de{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#B8860B] to-[#D4A017]">
                centros de conciliación
              </span>{" "}
              en Colombia
            </h1>

            <p className="mt-6 text-base sm:text-lg text-white/70 leading-relaxed max-w-xl">
              Cumplimiento Ley 2445 y Decreto 1136/2025 listo desde el día uno. Audiencias virtuales,
              insolvencia PNNC, portal de partes con widget embebible y firma electrónica integrada.
              Sin instalación, sin servidores: SaaS puro en la nube.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-start gap-4">
              <Link
                href="/registro"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-sm font-bold text-[#0D2340] bg-gradient-to-r from-[#B8860B] to-[#D4A017] px-7 py-3.5 rounded-full hover:from-[#9A7209] hover:to-[#B8860B] transition-all duration-300 shadow-lg shadow-[#B8860B]/25"
              >
                Empezar gratis
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-white transition-colors duration-300 px-2 py-3"
              >
                Ver demo
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Mini stats */}
            <div className="mt-10 flex flex-wrap items-center gap-6 sm:gap-8 text-white/40">
              <div>
                <span className="block text-base font-black text-[#B8860B]">Cumple Ley 2445</span>
                <span className="text-xs">Insolvencia PNNC</span>
              </div>
              <div className="w-px h-8 bg-white/10 hidden sm:block" />
              <div>
                <span className="block text-base font-black text-white/80">Audiencias virtuales</span>
                <span className="text-xs">Decreto 1136/2025</span>
              </div>
              <div className="w-px h-8 bg-white/10 hidden sm:block" />
              <div>
                <span className="block text-base font-black text-white/80">Portal de partes</span>
                <span className="text-xs">incluido</span>
              </div>
            </div>
          </div>

          {/* Columna derecha — mockup dashboard SIGECC */}
          <div className="relative animate-fade-in-up" style={{ animationDelay: "200ms" }}>
            <div className="bg-white rounded-2xl shadow-2xl shadow-black/30 border border-white/10 overflow-hidden">
              {/* Window bar */}
              <div className="flex items-center gap-2 px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <div className="ml-4 flex-1 h-5 bg-[#E2E8F0] rounded max-w-[200px]" />
              </div>
              <div className="flex">
                {/* Sidebar */}
                <div className="hidden sm:flex flex-col w-36 bg-[#0D2340] flex-shrink-0">
                  <div className="px-3 pt-4 pb-3 border-b border-white/10">
                    <div className="text-[7px] font-bold tracking-[0.2em] text-white/40 uppercase mb-0.5">
                      Sistema de Gestión
                    </div>
                    <div className="text-xs font-black text-white tracking-tight">
                      SIGECC<span className="text-[#B8860B]">.</span>
                    </div>
                    <div className="w-5 h-0.5 bg-[#B8860B] rounded mt-1.5" />
                  </div>
                  <div className="px-1.5 py-2 flex-1 overflow-hidden">
                    <div className="text-[6px] font-bold tracking-widest text-white/30 uppercase px-2 mb-1">
                      Módulos
                    </div>
                    {[
                      { icon: "◈", label: "Dashboard", active: true },
                      { icon: "📁", label: "Casos" },
                      { icon: "📅", label: "Audiencias" },
                      { icon: "🗓", label: "Agenda" },
                      { icon: "⚖", label: "Insolvencia" },
                      { icon: "👥", label: "Apoderados" },
                      { icon: "🌐", label: "Portal partes" },
                      { icon: "📋", label: "SICAAC" },
                      { icon: "📄", label: "Plantillas" },
                      { icon: "✍", label: "Firma" },
                      { icon: "🎫", label: "Tickets" },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded text-[8px] mb-0.5 border-l-2 ${
                          item.active
                            ? "bg-white/10 text-white font-bold border-[#B8860B]"
                            : "text-white/50 border-transparent"
                        }`}
                      >
                        <span className="text-[9px] w-3 text-center">{item.icon}</span>
                        <span className="truncate">{item.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="px-2 py-2 border-t border-white/10">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-[#B8860B] flex items-center justify-center text-[7px] font-bold text-white flex-shrink-0">
                        E
                      </div>
                      <div className="min-w-0">
                        <div className="text-[8px] font-bold text-white truncate">Centro Equilibra</div>
                        <div className="text-[7px] text-white/40">Director</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dashboard content */}
                <div className="flex-1 p-3 sm:p-4 bg-[#F4F6F9]">
                  <div className="mb-3">
                    <div className="text-sm font-bold text-[#0D2340]">Panel del centro</div>
                    <div className="text-[10px] text-gray-400">Vista consolidada · hoy</div>
                  </div>

                  {/* KPIs */}
                  <div className="grid grid-cols-3 gap-1.5 mb-3">
                    {[
                      { label: "Casos activos", val: "84", color: "text-[#0D2340]", icon: "📁" },
                      { label: "Audiencias hoy", val: "6", color: "text-[#1B5FA8]", icon: "📅" },
                      { label: "Alertas", val: "3", color: "text-[#B8860B]", icon: "🔔" },
                      { label: "En audiencia", val: "2", color: "text-green-700", icon: "🎤" },
                      { label: "Cerrados mes", val: "27", color: "text-[#1B5FA8]", icon: "✓" },
                      { label: "Mi equipo", val: "12", color: "text-[#0D2340]", icon: "👥" },
                    ].map((kpi) => (
                      <div
                        key={kpi.label}
                        className="bg-white rounded-lg p-1.5 border border-[#DDE4ED] shadow-[0_1px_3px_rgba(13,35,64,0.06)] text-center"
                      >
                        <div className="text-[9px] mb-0.5">{kpi.icon}</div>
                        <p className={`text-sm font-black ${kpi.color}`}>{kpi.val}</p>
                        <p className="text-[7px] text-[#7A8FA6]">{kpi.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Audiencias del día */}
                  <div className="bg-white rounded-lg p-2 border border-[#DDE4ED] mb-3">
                    <p className="text-[8px] font-bold text-[#7A8FA6] uppercase tracking-widest mb-1.5">
                      Audiencias programadas hoy
                    </p>
                    <div className="space-y-1">
                      {[
                        { hora: "09:00", caso: "CCN-2026-00084", est: "Confirmada", c: "bg-green-100 text-green-700" },
                        { hora: "10:30", caso: "CCN-2026-00091", est: "Virtual", c: "bg-blue-100 text-blue-700" },
                        { hora: "14:00", caso: "INS-2026-00012", est: "Insolvencia", c: "bg-amber-100 text-amber-700" },
                      ].map((a, i) => (
                        <div key={i} className="grid grid-cols-4 gap-1 text-[7px] py-0.5 border-b border-[#F4F6F9]">
                          <span className="font-bold text-[#0D2340]">{a.hora}</span>
                          <span className="text-[#1A2332] col-span-2 truncate">{a.caso}</span>
                          <span className={`text-[6px] font-bold px-1 py-0.5 rounded ${a.c} text-center`}>
                            {a.est}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Alertas */}
                  <div className="bg-white rounded-lg p-2 border border-[#DDE4ED]">
                    <p className="text-[8px] font-bold text-[#7A8FA6] uppercase tracking-widest mb-1.5">
                      Alertas
                    </p>
                    {[
                      { text: "Caso INS-00012: vence acreencias en 3 días", t: "high" },
                      { text: "Poder pendiente de firma en caso CCN-00084", t: "mid" },
                      { text: "Reprogramación solicitada por convocado", t: "mid" },
                    ].map((alerta, i) => (
                      <div key={i} className="flex items-center gap-1.5 py-0.5">
                        <div
                          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            alerta.t === "high" ? "bg-red-500" : "bg-amber-500"
                          }`}
                        />
                        <span className="text-[7px] text-[#3D5068] truncate">{alerta.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Floating cards */}
            <div className="absolute -top-3 -right-3 sm:-top-4 sm:-right-6 bg-white rounded-xl shadow-xl shadow-black/10 border border-[#E2E8F0] px-4 py-3 animate-float z-10">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center">
                  <Check className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[#0D2340]">Acta firmada</p>
                  <p className="text-[9px] text-[#94A3B8]">Caso CCN-00084</p>
                </div>
              </div>
            </div>

            <div
              className="absolute -bottom-3 -left-3 sm:-bottom-4 sm:-left-6 bg-white rounded-xl shadow-xl shadow-black/10 border border-[#E2E8F0] px-4 py-3 animate-float z-10"
              style={{ animationDelay: "1.5s" }}
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                  <Gavel className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[#0D2340]">Audiencia virtual</p>
                  <p className="text-[9px] text-[#94A3B8]">Lista en 10 min</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#F8FAFC] to-transparent z-10" />
      </section>

      {/* ===== MÓDULOS / PLATAFORMA ===== */}
      <section id="plataforma" className="bg-[#F8FAFC] py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 scroll-animate animate-fade-in-up">
            <p className="text-xs font-semibold text-[#B8860B] uppercase tracking-widest mb-3">
              Plataforma
            </p>
            <h2 className="text-2xl sm:text-3xl lg:text-5xl font-black text-[#0D2340] tracking-tight">
              Todo lo que un centro necesita, en un solo lugar
            </h2>
            <p className="mt-4 text-base sm:text-lg text-[#64748B] max-w-2xl mx-auto">
              Doce módulos diseñados específicamente para centros de conciliación, notarías y
              consultorios jurídicos.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {MODULOS.map((m, i) => {
              const Icon = m.icon;
              return (
                <div
                  key={m.nombre}
                  className={`scroll-animate animate-fade-in-up bg-white rounded-2xl border border-[#E2E8F0] p-6 hover:border-[#B8860B]/40 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 delay-${(i % 5) * 100}`}
                >
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#0D2340] to-[#1B4F9B] flex items-center justify-center mb-4 shadow-md shadow-[#0D2340]/20">
                    <Icon className="w-5 h-5 text-[#B8860B]" />
                  </div>
                  <h3 className="text-sm font-black text-[#0D2340] mb-1">{m.nombre}</h3>
                  <p className="text-xs text-[#64748B] leading-relaxed">{m.desc}</p>
                </div>
              );
            })}
          </div>

          <div className="text-center mt-10">
            <Link
              href="/modulos"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#0D2340] hover:text-[#B8860B] transition-colors"
            >
              Ver todos los módulos en detalle
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ===== PLACEHOLDER TOUR INTERACTIVO ===== */}
      <section className="bg-white py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border-2 border-dashed border-[#E2E8F0] p-10 text-center bg-[#F8FAFC]">
            <p className="text-xs font-bold text-[#B8860B] uppercase tracking-widest mb-2">
              Próximamente
            </p>
            <h3 className="text-xl font-black text-[#0D2340] mb-2">
              Tour interactivo de la plataforma
            </h3>
            <p className="text-sm text-[#64748B] max-w-xl mx-auto">
              Estamos preparando un recorrido visual de cada módulo con capturas reales del producto.
              Mientras tanto, agenda una demo o explora los módulos en detalle.
            </p>
          </div>
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <PricingSection />

      {/* ===== TESTIMONIOS ===== */}
      <section id="testimonios" className="bg-[#F8FAFC] pt-16 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 scroll-animate animate-fade-in-up">
            <p className="text-xs font-semibold text-[#B8860B] uppercase tracking-widest mb-3">
              Testimonios
            </p>
            <h2 className="text-2xl sm:text-3xl lg:text-5xl font-black text-[#0D2340] tracking-tight">
              Lo que dicen los centros que ya usan SIGECC
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {TESTIMONIOS.map((t, index) => (
              <div
                key={t.nombre}
                className={`scroll-animate animate-fade-in-up relative bg-white border border-[#E2E8F0] rounded-2xl p-8 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 delay-${index * 100}`}
              >
                <span
                  className="absolute top-4 right-6 text-6xl font-serif text-[#E2E8F0] leading-none select-none"
                  aria-hidden="true"
                >
                  &ldquo;
                </span>

                <div className="flex gap-1 mb-5" aria-label="5 estrellas">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-[#B8860B] fill-[#B8860B]" />
                  ))}
                </div>

                <blockquote className="text-sm text-[#374151] leading-relaxed mb-8 relative z-10">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>

                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#0D2340] to-[#1B4F9B] flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-white">{t.iniciales}</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#0D2340]">{t.nombre}</p>
                    <p className="text-xs text-[#94A3B8]">{t.cargo}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-[11px] text-[#94A3B8] mt-8 italic">
            Testimonios representativos para fines ilustrativos. Pronto incluiremos casos reales de
            centros activos.
          </p>
        </div>
      </section>

      {/* ===== TRUST BAR — Normativa ===== */}
      <section className="bg-white py-12 border-t border-[#E2E8F0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-widest mb-6">
            Cumplimiento normativo del Estado colombiano
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            {NORMAS.map((n) => (
              <span
                key={n}
                className="text-xs font-bold text-[#0D2340] bg-white border border-[#B8860B]/40 px-4 py-2 rounded-full hover:bg-[#B8860B]/5 transition-colors"
              >
                {n}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA FINAL ===== */}
      <section className="bg-gradient-to-r from-[#0D2340] to-[#1B4F9B] py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight mb-3">
            ¿Listo para modernizar tu centro?
          </h2>
          <p className="text-white/70 text-base mb-8 max-w-2xl mx-auto">
            Empieza gratis con el plan Académico o prueba 15 días sin tarjeta cualquier plan pago.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">
            <Link
              href="/registro"
              className="inline-flex items-center justify-center gap-2 text-sm font-bold text-[#0D2340] bg-gradient-to-r from-[#B8860B] to-[#D4A017] px-7 py-3.5 rounded-full hover:from-[#9A7209] hover:to-[#B8860B] transition-all duration-300 shadow-lg shadow-[#B8860B]/25"
            >
              Empezar gratis
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/precios"
              className="inline-flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-white transition-colors"
            >
              Ver planes
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
