import Link from "next/link";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getTransaction } from "@/lib/wompi";

/**
 * Página de retorno post-checkout de Wompi. Pública (el usuario puede haber
 * perdido la sesión durante el flujo). Muestra el estado de la transacción
 * consultando Wompi directamente y complementa con nuestra DB por si el
 * webhook ya llegó.
 *
 * Wompi redirige con ?id=<transaction_id>&env=test
 */
export default async function PagoRetornoPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;

  if (!id) {
    return <ErrorCard mensaje="No se recibió el identificador de la transacción." />;
  }

  const session = await auth();

  let status: string | null = null;
  let reference: string | null = null;
  let montoCOP: number | null = null;
  let statusMessage: string | null = null;
  let customerEmail: string | null = null;

  try {
    const { data } = await getTransaction(id);
    status = data.status;
    reference = data.reference;
    montoCOP = Math.round(data.amount_in_cents / 100);
    statusMessage = data.status_message ?? null;
    customerEmail = data.customer_email ?? null;
  } catch (e) {
    console.error("[pago/retorno] error consultando Wompi", e);
  }

  // Complementamos con nuestra DB
  if (reference) {
    const { data: tx } = await supabaseAdmin
      .from("sgcc_transacciones_pago")
      .select("estado, monto_cop, suscripcion_id")
      .eq("reference", reference)
      .maybeSingle();
    if (tx?.estado === "APROBADA") status = "APPROVED";
    if (tx?.suscripcion_id && !customerEmail) {
      const { data: sus } = await supabaseAdmin
        .from("sgcc_suscripciones")
        .select("wompi_customer_email")
        .eq("id", tx.suscripcion_id)
        .maybeSingle();
      customerEmail = sus?.wompi_customer_email ?? null;
    }
  }

  const aprobada = status === "APPROVED";
  const rechazada = status === "DECLINED" || status === "ERROR" || status === "VOIDED";
  const pendiente = !aprobada && !rechazada;

  const loginUrl =
    !session && customerEmail
      ? `/login?email=${encodeURIComponent(customerEmail)}`
      : "/login";
  const destinoAprobado = session ? "/dashboard" : loginUrl;

  return (
    <div className="min-h-screen bg-[#F4F6F9] flex items-center justify-center px-6 py-10">
      <div className="bg-white rounded-2xl border border-[#DDE4ED] p-10 max-w-lg w-full text-center">
        {aprobada && (
          <>
            <div className="w-16 h-16 bg-[#1A7A4A]/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-[#1A7A4A] text-3xl">✓</span>
            </div>
            <h1 className="text-2xl font-black text-[#0D2340] mb-3">¡Pago aprobado!</h1>
            <p className="text-[#7A8FA6] mb-6">
              {session
                ? "El plan de tu centro fue activado. Ya puedes operar sin restricciones."
                : "El pago quedó registrado. Inicia sesión para entrar al centro."}
            </p>
          </>
        )}
        {rechazada && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-red-600 text-3xl">✕</span>
            </div>
            <h1 className="text-2xl font-black text-[#0D2340] mb-3">Pago rechazado</h1>
            <p className="text-[#7A8FA6] mb-6">
              {statusMessage ??
                "No pudimos procesar tu pago. Intenta de nuevo o usa otro medio."}
            </p>
          </>
        )}
        {pendiente && (
          <>
            <div className="w-16 h-16 bg-[#B8860B]/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-[#B8860B] text-3xl">⏳</span>
            </div>
            <h1 className="text-2xl font-black text-[#0D2340] mb-3">Pago en proceso</h1>
            <p className="text-[#7A8FA6] mb-6">
              Estamos esperando la confirmación de Wompi. Te avisaremos por
              correo apenas se complete.
            </p>
          </>
        )}

        {montoCOP && (
          <div className="bg-[#F4F6F9] rounded-lg p-4 mb-6 text-sm text-[#3D5068]">
            Monto: <strong>${montoCOP.toLocaleString("es-CO")} COP</strong>
            {reference && (
              <>
                <br />
                Referencia: <code className="text-xs">{reference}</code>
              </>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3">
          {aprobada ? (
            <Link
              href={destinoAprobado}
              className="inline-block bg-[#0D2340] hover:bg-[#1a3a5c] text-white font-bold text-sm py-3 px-6 rounded-lg transition-colors"
            >
              {session ? "Ir al panel" : "Iniciar sesión"}
            </Link>
          ) : (
            <Link
              href={session ? "/dashboard" : "/login"}
              className="inline-block bg-[#0D2340] hover:bg-[#1a3a5c] text-white font-bold text-sm py-3 px-6 rounded-lg transition-colors"
            >
              {session ? "Ir al panel" : "Iniciar sesión"}
            </Link>
          )}
          {rechazada && (
            <Link
              href="/precios"
              className="text-sm text-[#7A8FA6] hover:text-[#0D2340] transition-colors"
            >
              Volver a intentar
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function ErrorCard({ mensaje }: { mensaje: string }) {
  return (
    <div className="min-h-screen bg-[#F4F6F9] flex items-center justify-center px-6">
      <div className="bg-white rounded-2xl border border-[#DDE4ED] p-10 max-w-lg w-full text-center">
        <h1 className="text-2xl font-black text-[#0D2340] mb-3">Algo salió mal</h1>
        <p className="text-[#7A8FA6] mb-6">{mensaje}</p>
        <Link
          href="/precios"
          className="inline-block bg-[#B8860B] text-white font-bold text-sm py-3 px-6 rounded-lg"
        >
          Volver a precios
        </Link>
      </div>
    </div>
  );
}
