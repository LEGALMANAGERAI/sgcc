import Link from "next/link";
import { auth } from "@/lib/auth";
import {
  getPlanCobrable,
  precioPorPeriodo,
  formatearCOP,
  type Periodo,
} from "@/lib/planes-suscripcion";
import { CheckoutButton } from "./CheckoutButton";

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ plan: string }>;
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { plan: planKey } = await params;
  const { periodo: periodoRaw } = await searchParams;
  const periodo: Periodo = periodoRaw === "ANUAL" ? "ANUAL" : "MENSUAL";

  const plan = getPlanCobrable(planKey, periodo);
  if (!plan) {
    return (
      <div className="bg-white rounded-2xl border border-[#DDE4ED] p-10 text-center">
        <h1 className="text-2xl font-black text-[#0D2340] mb-3">Plan no disponible</h1>
        <p className="text-[#7A8FA6] mb-6">
          El plan que intentas contratar no existe o requiere cotización con nuestro
          equipo comercial.
        </p>
        <Link
          href="/precios"
          className="inline-block bg-[#B8860B] text-white px-6 py-3 rounded-lg font-bold text-sm"
        >
          Ver planes disponibles
        </Link>
      </div>
    );
  }

  const session = await auth();
  const precio = precioPorPeriodo(plan, periodo);
  const ahorro = periodo === "ANUAL" ? plan.mensualCOP * 12 - plan.anualCOP : 0;

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Resumen del plan */}
      <div className="bg-white rounded-2xl border border-[#DDE4ED] p-8">
        <div className="text-xs font-bold text-[#B8860B] uppercase tracking-wider mb-2">
          Plan seleccionado
        </div>
        <h1 className="text-3xl font-black text-[#0D2340] mb-1">{plan.nombre}</h1>
        <p className="text-sm text-[#7A8FA6] mb-6">
          {plan.target === "PRIVADO"
            ? "Centro privado"
            : plan.target === "NOTARIAL"
            ? "Notarial / Multi-sede"
            : plan.target}
        </p>

        <div className="border-t border-[#DDE4ED] pt-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#3D5068]">Periodo</span>
            <span className="text-sm font-bold text-[#0D2340]">
              {periodo === "MENSUAL" ? "Mensual" : "Anual"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#3D5068]">Precio mensual</span>
            <span className="text-sm font-bold text-[#0D2340]">
              {formatearCOP(plan.mensualCOP)} COP
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#3D5068]">Precio anual</span>
            <span className="text-sm font-bold text-[#0D2340]">
              {formatearCOP(plan.anualCOP)} COP
            </span>
          </div>
          {ahorro > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#3D5068]">Ahorro anual</span>
              <span className="text-sm font-bold text-[#1A7A4A]">
                -{formatearCOP(ahorro)} COP
              </span>
            </div>
          )}
        </div>

        <div className="border-t border-[#DDE4ED] pt-6 mt-6 flex items-center justify-between">
          <span className="text-base font-bold text-[#0D2340]">Total a pagar hoy</span>
          <span className="text-2xl font-black text-[#0D2340]">
            {formatearCOP(precio)} COP
          </span>
        </div>
      </div>

      {/* Panel de pago */}
      {session ? (
        <div className="bg-white rounded-2xl border border-[#DDE4ED] p-8 flex flex-col">
          <h2 className="text-xl font-black text-[#0D2340] mb-2">Pagar con Wompi</h2>
          <p className="text-sm text-[#7A8FA6] mb-6">
            Serás redirigido a la plataforma segura de Wompi para completar tu pago
            con tarjeta débito, crédito, PSE, Nequi o Bancolombia Transfer.
          </p>
          <ul className="space-y-2 mb-8 text-sm text-[#3D5068]">
            <li className="flex items-center gap-2">
              <span className="text-[#1A7A4A] font-bold">✓</span>
              Pago 100% seguro certificado por Bancolombia
            </li>
            <li className="flex items-center gap-2">
              <span className="text-[#1A7A4A] font-bold">✓</span>
              Activación inmediata al confirmar el pago
            </li>
            <li className="flex items-center gap-2">
              <span className="text-[#1A7A4A] font-bold">✓</span>
              Cancela cuando quieras, sin permanencia
            </li>
          </ul>
          <div className="mt-auto">
            <CheckoutButton planKey={plan.key} periodo={periodo} />
            <p className="text-xs text-[#7A8FA6] mt-3 text-center">
              Al continuar aceptas nuestros{" "}
              <Link href="/terminos" className="underline">
                términos y condiciones
              </Link>
              .
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#DDE4ED] p-8 flex flex-col">
          <h2 className="text-xl font-black text-[#0D2340] mb-3">Inicia sesión para comprar</h2>
          <p className="text-sm text-[#7A8FA6] mb-6">
            Para contratar un plan necesitas tener un centro registrado. Inicia sesión
            como administrador o crea tu cuenta para continuar.
          </p>
          <ul className="space-y-2 mb-8 text-sm text-[#3D5068]">
            <li className="flex items-center gap-2">
              <span className="text-[#B8860B] font-bold">→</span>
              ¿Ya tienes centro? Inicia sesión con tu cuenta admin.
            </li>
            <li className="flex items-center gap-2">
              <span className="text-[#B8860B] font-bold">→</span>
              ¿Aún no tienes centro? Regístralo en pocos pasos.
            </li>
          </ul>
          <div className="mt-auto flex flex-col gap-3">
            <Link
              href={`/login?next=${encodeURIComponent(`/checkout/${plan.key}?periodo=${periodo}`)}`}
              className="w-full text-center bg-[#0D2340] hover:bg-[#1a3a5c] text-white font-bold text-sm py-4 rounded-lg transition-colors"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/registro"
              className="w-full text-center border border-[#DDE4ED] text-[#0D2340] hover:bg-[#F4F6F9] font-bold text-sm py-3 rounded-lg transition-colors"
            >
              Registrar mi centro
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
