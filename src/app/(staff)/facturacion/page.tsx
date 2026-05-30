import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId, isAdmin } from "@/lib/server-utils";
import { getPlan, formatearCOP } from "@/lib/planes-suscripcion";
import { CancelarSuscripcionBtn } from "./CancelarSuscripcionBtn";

export const dynamic = "force-dynamic";

export default async function FacturacionPage({
  searchParams,
}: {
  searchParams?: Promise<{ vencido?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  // Solo admin del centro puede ver / gestionar facturación
  if (!isAdmin(session)) redirect("/dashboard");

  const centerId = resolveCenterId(session);
  if (!centerId) redirect("/dashboard");

  const sp = (await searchParams) ?? {};
  const llegoPorVencimiento = sp.vencido === "1";

  // Fecha vencimiento del banner
  let fechaVencimiento: Date | null = null;
  if (llegoPorVencimiento) {
    const { data: centro } = await supabaseAdmin
      .from("sgcc_centers")
      .select("plan_expires_at")
      .eq("id", centerId)
      .maybeSingle();
    if (centro?.plan_expires_at) fechaVencimiento = new Date(centro.plan_expires_at);
  }

  // Suscripción activa (o la más reciente en EN_ESPERA / PAUSADA)
  const { data: suscripcion } = await supabaseAdmin
    .from("sgcc_suscripciones")
    .select("*")
    .eq("center_id", centerId)
    .in("estado", ["ACTIVA", "EN_ESPERA", "PAUSADA"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Historial transacciones
  const { data: transacciones } = await supabaseAdmin
    .from("sgcc_transacciones_pago")
    .select("id, reference, monto_cop, estado, metodo_pago, tipo, pagada_en, created_at, detalle_error")
    .eq("center_id", centerId)
    .order("created_at", { ascending: false })
    .limit(20);

  const plan = suscripcion ? getPlan(suscripcion.plan_key) : null;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {llegoPorVencimiento && (
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-5 flex items-start gap-4">
          <span className="text-3xl shrink-0">⚠️</span>
          <div className="flex-1">
            <div className="font-black text-red-800 text-base mb-1">
              El plan del centro está vencido
            </div>
            <div className="text-sm text-red-700 mb-3">
              {fechaVencimiento
                ? `Venció el ${fechaVencimiento.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" })}.`
                : "La suscripción ya no está activa."}{" "}
              Reactívalo ahora para volver a operar.
            </div>
            {!suscripcion && (
              <Link
                href="/precios"
                className="inline-block bg-red-700 hover:bg-red-800 text-white font-bold text-sm py-2.5 px-5 rounded-lg transition-colors"
              >
                Ver planes y reactivar
              </Link>
            )}
          </div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-black text-[#0D2340]">Facturación</h1>
        <p className="text-sm text-[#7A8FA6]">
          Administra la suscripción del centro y revisa el historial de pagos.
        </p>
      </div>

      {/* Suscripción activa */}
      <section className="bg-white rounded-2xl border border-[#DDE4ED] p-6">
        <h2 className="text-lg font-black text-[#0D2340] mb-4">Suscripción activa</h2>
        {!suscripcion && (
          <div className="text-center py-8">
            <p className="text-[#7A8FA6] mb-4">No tienes una suscripción activa.</p>
            <Link
              href="/precios"
              className="inline-block bg-[#B8860B] text-white font-bold text-sm py-3 px-6 rounded-lg"
            >
              Ver planes
            </Link>
          </div>
        )}
        {suscripcion && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3 text-sm">
              <Row label="Plan" value={plan?.nombre ?? suscripcion.plan_key} />
              <Row
                label="Periodo"
                value={suscripcion.periodo === "MENSUAL" ? "Mensual" : "Anual"}
              />
              <Row label="Precio" value={`${formatearCOP(suscripcion.precio_cop)} COP`} />
              <Row label="Estado" value={<EstadoBadge estado={suscripcion.estado} />} />
              {suscripcion.proximo_cobro && (
                <Row
                  label="Próximo cobro"
                  value={new Date(suscripcion.proximo_cobro).toLocaleDateString("es-CO", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                />
              )}
            </div>
            <div className="space-y-3 text-sm">
              {suscripcion.wompi_card_last4 && (
                <Row
                  label="Método de pago"
                  value={`${suscripcion.wompi_card_brand ?? "Tarjeta"} •••• ${suscripcion.wompi_card_last4}`}
                />
              )}
              {!suscripcion.wompi_card_last4 && suscripcion.wompi_payment_method_type && (
                <Row label="Método de pago" value={suscripcion.wompi_payment_method_type} />
              )}
              <Row label="Email de facturación" value={suscripcion.wompi_customer_email ?? "—"} />
              {suscripcion.fallos_consecutivos > 0 && (
                <Row
                  label="Cobros fallidos consecutivos"
                  value={
                    <span className="text-red-600 font-bold">
                      {suscripcion.fallos_consecutivos}
                    </span>
                  }
                />
              )}

              {suscripcion.estado === "ACTIVA" && (
                <div className="pt-4 flex gap-3">
                  <Link
                    href="/precios"
                    className="inline-block text-sm font-bold text-[#0D2340] border border-[#DDE4ED] bg-white hover:bg-[#F4F6F9] py-2 px-4 rounded-lg"
                  >
                    Cambiar plan
                  </Link>
                  <CancelarSuscripcionBtn suscripcionId={suscripcion.id} />
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Historial */}
      <section className="bg-white rounded-2xl border border-[#DDE4ED] p-6">
        <h2 className="text-lg font-black text-[#0D2340] mb-4">Historial de pagos</h2>
        {(!transacciones || transacciones.length === 0) && (
          <p className="text-[#7A8FA6] text-sm">Aún no tienes pagos registrados.</p>
        )}
        {transacciones && transacciones.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-[#DDE4ED]">
                  <th className="py-2 px-3 font-bold text-[#3D5068]">Fecha</th>
                  <th className="py-2 px-3 font-bold text-[#3D5068]">Tipo</th>
                  <th className="py-2 px-3 font-bold text-[#3D5068]">Método</th>
                  <th className="py-2 px-3 font-bold text-[#3D5068]">Monto</th>
                  <th className="py-2 px-3 font-bold text-[#3D5068]">Estado</th>
                </tr>
              </thead>
              <tbody>
                {transacciones.map((tx) => (
                  <tr key={tx.id} className="border-b border-[#F4F6F9]">
                    <td className="py-2 px-3 text-[#3D5068]">
                      {new Date(tx.pagada_en ?? tx.created_at).toLocaleDateString("es-CO")}
                    </td>
                    <td className="py-2 px-3 text-[#3D5068]">{formatTipo(tx.tipo)}</td>
                    <td className="py-2 px-3 text-[#3D5068]">{tx.metodo_pago ?? "—"}</td>
                    <td className="py-2 px-3 font-bold text-[#0D2340]">
                      {formatearCOP(tx.monto_cop)}
                    </td>
                    <td className="py-2 px-3">
                      <EstadoTxBadge estado={tx.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[#7A8FA6]">{label}</span>
      <span className="text-[#0D2340] font-semibold text-right">{value}</span>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const colores: Record<string, string> = {
    ACTIVA: "bg-green-100 text-green-700",
    EN_ESPERA: "bg-yellow-100 text-yellow-700",
    PAUSADA: "bg-gray-100 text-gray-700",
    CANCELADA: "bg-gray-100 text-gray-700",
    VENCIDA: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${colores[estado] ?? "bg-gray-100"}`}
    >
      {estado}
    </span>
  );
}

function EstadoTxBadge({ estado }: { estado: string }) {
  const colores: Record<string, string> = {
    APROBADA: "bg-green-100 text-green-700",
    PENDIENTE: "bg-yellow-100 text-yellow-700",
    RECHAZADA: "bg-red-100 text-red-700",
    ERROR: "bg-red-100 text-red-700",
    VOIDED: "bg-gray-100 text-gray-700",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${colores[estado] ?? "bg-gray-100"}`}
    >
      {estado}
    </span>
  );
}

function formatTipo(tipo: string): string {
  const map: Record<string, string> = {
    INICIAL: "Pago inicial",
    RENOVACION: "Renovación",
    REINTENTO: "Reintento",
    UPGRADE: "Upgrade",
    DOWNGRADE: "Downgrade",
  };
  return map[tipo] ?? tipo;
}
