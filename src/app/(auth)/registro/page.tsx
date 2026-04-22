"use client";

import Link from "next/link";
import { Scale, Building2, Users, User } from "lucide-react";

const options = [
  {
    icon: Building2,
    title: "Centro de Conciliacion",
    emoji: "\ud83c\udfdb\ufe0f",
    description:
      "Registra tu centro de conciliacion para gestionar casos, audiencias y tramites",
    href: "/registro/centro",
    cta: "Registrar centro",
  },
  {
    icon: Users,
    title: "Staff del centro",
    emoji: "\ud83d\udc65",
    description:
      "Conciliadores, funcionarios y personal administrativo que se une a un centro existente",
    href: "/registro/staff",
    cta: "Registrar staff",
  },
  {
    icon: User,
    title: "Parte / Usuario",
    emoji: "\ud83d\udc64",
    description:
      "Crea tu cuenta como convocante, convocado o tercero para seguimiento de tus asuntos",
    href: "/registro/parte",
    cta: "Crear cuenta",
  },
];

export default function RegistroSelectorPage() {
  return (
    <div className="min-h-screen bg-[#0D2340] flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#0D2340] px-8 py-8 text-center">
          <div className="flex justify-center mb-3">
            <div className="bg-[#1B4F9B] p-3 rounded-full">
              <Scale className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-white text-2xl font-bold">SGCC</h1>
          <p className="text-white/60 text-sm mt-1">
            Selecciona el tipo de registro
          </p>
        </div>

        {/* Cards */}
        <div className="px-8 py-8 space-y-4">
          {options.map((opt) => (
            <Link
              key={opt.href}
              href={opt.href}
              className="group flex items-center gap-5 border border-gray-200 rounded-xl p-5 hover:border-[#1B4F9B] hover:shadow-lg transition-all"
            >
              <div className="flex-shrink-0 bg-[#0D2340]/5 group-hover:bg-[#1B4F9B]/10 p-4 rounded-xl transition-colors">
                <opt.icon className="w-7 h-7 text-[#0D2340] group-hover:text-[#1B4F9B] transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-[#0D2340] font-semibold text-base">
                  {opt.emoji} {opt.title}
                </h2>
                <p className="text-gray-500 text-sm mt-0.5">
                  {opt.description}
                </p>
              </div>
              <span className="flex-shrink-0 bg-[#0D2340] text-white text-xs font-medium px-4 py-2 rounded-lg group-hover:bg-[#1B4F9B] transition-colors">
                {opt.cta}
              </span>
            </Link>
          ))}
        </div>

        {/* Footer */}
        <div className="px-8 pb-8 text-center">
          <p className="text-xs text-gray-500">
            ¿Ya tienes cuenta?{" "}
            <Link
              href="/login"
              className="text-[#1B4F9B] hover:underline font-medium"
            >
              Ingresar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
