import Link from "next/link";
import type { EstadoPlanCentro } from "@/lib/estado-plan";
import { DIAS_GRACE_VENCIDO } from "@/lib/estado-plan";
import { getEstadoPlanCentro } from "@/lib/estado-plan";
import { auth } from "@/lib/auth";

/**
 * Banner de estado del plan del centro. Server component que resuelve estado
 * y delega el render a BannerPlanView (puede usarse como Server Component
 * directamente). Si está 'ok' no renderiza nada.
 *
 * NOTA: aún no está montado en ningún layout. El cableado se hará en una
 * iteración posterior cuando los planes estén live en producción.
 */
export default async function BannerPlan() {
  const session = await auth();
  if (!session) return null;
  const estado = await getEstadoPlanCentro(session);
  return <BannerPlanView estado={estado} />;
}

/**
 * Versión "tonta" que solo recibe el estado ya resuelto. Útil si el layout
 * ya tiene la sesión y prefiere pasar el estado por props.
 */
export function BannerPlanView({ estado }: { estado: EstadoPlanCentro }) {
  if (estado.estado === "ok") return null;

  const msg = construirMensaje(estado);
  if (!msg) return null;

  const clase =
    msg.tono === "rojo"
      ? "bg-red-50 border-red-300 text-red-900"
      : "bg-yellow-50 border-yellow-300 text-yellow-900";

  const ctaClase =
    msg.tono === "rojo"
      ? "bg-red-700 hover:bg-red-800 text-white"
      : "bg-yellow-700 hover:bg-yellow-800 text-white";

  return (
    <div className={`border-b px-4 py-3 ${clase}`}>
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-start gap-2 text-sm">
          <span aria-hidden className="text-base leading-none">
            {msg.tono === "rojo" ? "⚠️" : "ℹ️"}
          </span>
          <div>
            <strong className="font-bold">{msg.titulo}</strong>
            {msg.subtitulo && <span className="ml-1">{msg.subtitulo}</span>}
          </div>
        </div>
        {msg.cta && (
          <Link
            href={msg.cta.href}
            className={`inline-block rounded-md text-xs font-bold px-4 py-2 shrink-0 ${ctaClase}`}
          >
            {msg.cta.label}
          </Link>
        )}
      </div>
    </div>
  );
}

interface Mensaje {
  tono: "amarillo" | "rojo";
  titulo: string;
  subtitulo?: string;
  cta?: { label: string; href: string };
}

function construirMensaje(e: EstadoPlanCentro): Mensaje | null {
  const diasPos = e.diasRestantes ?? 0;
  const diasVencido = diasPos < 0 ? Math.abs(diasPos) : 0;
  const diasParaReadOnly = DIAS_GRACE_VENCIDO - diasVencido;

  if (e.estado === "sin_plan") {
    return {
      tono: "amarillo",
      titulo: "El centro aún no tiene un plan activo.",
      subtitulo: "Activa uno para desbloquear todas las funcionalidades.",
      cta: { label: "Ver planes", href: "/precios" },
    };
  }
  if (e.estado === "por_vencer") {
    return {
      tono: "amarillo",
      titulo: `El plan del centro vence en ${diasPos} día${diasPos === 1 ? "" : "s"}.`,
      subtitulo: "Renueva para evitar que se interrumpa el servicio.",
      cta: { label: "Renovar ahora", href: "/facturacion" },
    };
  }
  if (e.estado === "grace") {
    return {
      tono: "rojo",
      titulo: `El plan del centro venció hace ${diasVencido} día${diasVencido === 1 ? "" : "s"}.`,
      subtitulo: `Renueva antes de ${diasParaReadOnly} día${diasParaReadOnly === 1 ? "" : "s"} o entrarás en modo solo lectura.`,
      cta: { label: "Renovar ahora", href: "/facturacion" },
    };
  }
  if (e.estado === "vencido") {
    return {
      tono: "rojo",
      titulo: "El plan del centro está vencido — modo solo lectura.",
      subtitulo: "Renueva para volver a operar con normalidad.",
      cta: { label: "Renovar ahora", href: "/facturacion" },
    };
  }
  return null;
}
