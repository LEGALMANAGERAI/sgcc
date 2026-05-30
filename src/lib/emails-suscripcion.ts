import { Resend } from "resend";
import { formatearCOP, getPlan } from "./planes-suscripcion";

/**
 * Emails transaccionales de suscripción / cobros Wompi en SIGECC.
 *
 * Todos los helpers son "fire and forget": capturan errores para no bloquear
 * la lógica de negocio (webhook / cron). Si Resend falla, el email se pierde
 * pero el estado del cobro ya quedó actualizado en DB.
 */

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = "SIGECC <notificaciones@sgcc.app>";
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://sgcc-rouge.vercel.app";

interface DatosBase {
  to: string;
  nombre?: string | null;
  planKey: string;
}

function nombrePlan(planKey: string): string {
  return getPlan(planKey)?.nombre ?? planKey;
}

function contenedor(html: string): string {
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#fff;">
      <div style="font-size:24px;font-weight:900;color:#0D2340;margin-bottom:16px;">SI<span style="color:#B8860B;">GECC</span></div>
      ${html}
      <p style="color:#7A8FA6;font-size:11px;margin-top:32px;border-top:1px solid #eee;padding-top:12px;">
        SIGECC — Gestión de centros de conciliación, insolvencia y acuerdos de apoyo<br>
        Si tienes dudas, responde a este correo.
      </p>
    </div>
  `;
}

function boton(href: string, label: string, color = "#0D2340"): string {
  return `<a href="${href}" style="display:inline-block;background:${color};color:#fff;font-weight:700;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;">${label}</a>`;
}

async function enviarSeguro(params: {
  to: string;
  subject: string;
  html: string;
  contexto: string;
}): Promise<void> {
  try {
    await resend.emails.send({
      from: FROM,
      to: [params.to],
      subject: params.subject,
      html: params.html,
    });
  } catch (err) {
    console.error(`[emails-suscripcion/${params.contexto}] fallo Resend`, err);
  }
}

export async function enviarEmailCobroAprobado(
  params: DatosBase & { montoCOP: number; proximoCobro: Date }
): Promise<void> {
  const plan = nombrePlan(params.planKey);
  const fecha = params.proximoCobro.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const html = contenedor(`
    <h2 style="color:#0D2340;font-size:18px;margin-bottom:8px;">Pago confirmado ✓</h2>
    <p style="color:#3D5068;font-size:14px;line-height:1.6;margin-bottom:16px;">
      Hola${params.nombre ? ` <strong>${params.nombre}</strong>` : ""}, confirmamos el pago del plan <strong>${plan}</strong> de tu centro por <strong>${formatearCOP(params.montoCOP)} COP</strong>.
    </p>
    <p style="color:#3D5068;font-size:14px;line-height:1.6;margin-bottom:24px;">
      El próximo cobro está programado para el <strong>${fecha}</strong>.
    </p>
    ${boton(`${BASE_URL}/facturacion`, "Ver mi facturación")}
  `);
  await enviarSeguro({
    to: params.to,
    subject: `Pago confirmado — Plan ${plan}`,
    html,
    contexto: "cobro-aprobado",
  });
}

export async function enviarEmailCobroRechazado(
  params: DatosBase & { montoCOP: number; fallosConsecutivos: number; detalleError?: string | null }
): Promise<void> {
  const plan = nombrePlan(params.planKey);
  const ultimoAviso = params.fallosConsecutivos >= 2;
  const html = contenedor(`
    <h2 style="color:${ultimoAviso ? "#991B1B" : "#A16207"};font-size:18px;margin-bottom:8px;">
      ${ultimoAviso ? "Último aviso: no pudimos cobrar tu plan" : "No pudimos cobrar tu plan"}
    </h2>
    <p style="color:#3D5068;font-size:14px;line-height:1.6;margin-bottom:16px;">
      Hola${params.nombre ? ` <strong>${params.nombre}</strong>` : ""}, intentamos cobrar <strong>${formatearCOP(params.montoCOP)} COP</strong> por el plan <strong>${plan}</strong> de tu centro pero el pago fue rechazado${params.detalleError ? ` (${params.detalleError})` : ""}.
    </p>
    <p style="color:#3D5068;font-size:14px;line-height:1.6;margin-bottom:16px;">
      Llevamos <strong>${params.fallosConsecutivos}</strong> intento${params.fallosConsecutivos === 1 ? "" : "s"} fallido${params.fallosConsecutivos === 1 ? "" : "s"}.
      ${ultimoAviso ? "Si el próximo intento falla la suscripción quedará en modo solo lectura." : "Reintentaremos mañana automáticamente."}
    </p>
    <p style="color:#3D5068;font-size:14px;line-height:1.6;margin-bottom:24px;">
      Actualiza tu método de pago para evitar la interrupción del servicio.
    </p>
    ${boton(`${BASE_URL}/facturacion`, "Actualizar método de pago", "#991B1B")}
  `);
  await enviarSeguro({
    to: params.to,
    subject: ultimoAviso
      ? `Último aviso: pago rechazado — Plan ${plan}`
      : `Pago rechazado — Plan ${plan}`,
    html,
    contexto: "cobro-rechazado",
  });
}

export async function enviarEmailRenovacionManual(params: DatosBase): Promise<void> {
  const plan = nombrePlan(params.planKey);
  const html = contenedor(`
    <h2 style="color:#0D2340;font-size:18px;margin-bottom:8px;">Renueva tu plan manualmente</h2>
    <p style="color:#3D5068;font-size:14px;line-height:1.6;margin-bottom:16px;">
      Hola${params.nombre ? ` <strong>${params.nombre}</strong>` : ""}, el plan <strong>${plan}</strong> de tu centro está pagado con PSE/Nequi y no podemos renovarlo automáticamente.
    </p>
    <p style="color:#3D5068;font-size:14px;line-height:1.6;margin-bottom:24px;">
      Para continuar sin interrupciones, realiza el pago desde tu panel de facturación. Si pagas con tarjeta podremos renovar de forma automática el próximo mes.
    </p>
    ${boton(`${BASE_URL}/facturacion`, "Renovar ahora")}
  `);
  await enviarSeguro({
    to: params.to,
    subject: `Renueva tu plan ${plan} manualmente`,
    html,
    contexto: "renovacion-manual",
  });
}

export async function enviarEmailRecordatorio(
  params: DatosBase & { tipo: "7d_antes" | "dia_0" | "dia_7_vencido"; diasRestantes: number }
): Promise<void> {
  const plan = nombrePlan(params.planKey);
  let titulo: string;
  let cuerpo: string;
  let subject: string;
  let colorCta = "#0D2340";

  if (params.tipo === "7d_antes") {
    titulo = "Tu plan vence pronto";
    cuerpo = `El plan <strong>${plan}</strong> de tu centro vence en <strong>${params.diasRestantes} día${params.diasRestantes === 1 ? "" : "s"}</strong>. Si tienes tarjeta registrada lo renovaremos automáticamente el día de vencimiento — asegúrate de tener saldo disponible.`;
    subject = `Tu plan ${plan} vence en ${params.diasRestantes} día${params.diasRestantes === 1 ? "" : "s"}`;
  } else if (params.tipo === "dia_0") {
    titulo = "Tu plan vence hoy";
    cuerpo = `El plan <strong>${plan}</strong> de tu centro vence hoy. Si no se renueva automáticamente, tienes 7 días de gracia antes de entrar en modo solo lectura.`;
    subject = `Tu plan ${plan} vence hoy`;
    colorCta = "#A16207";
  } else {
    titulo = "Tu cuenta quedará en modo solo lectura";
    cuerpo = `El plan <strong>${plan}</strong> de tu centro venció hace 7 días y aún no se ha renovado. Desde hoy la cuenta está en <strong>modo solo lectura</strong> — pueden consultar pero no crear ni editar. Renueva para reactivar la operación.`;
    subject = `Acción requerida: reactiva tu plan ${plan}`;
    colorCta = "#991B1B";
  }

  const html = contenedor(`
    <h2 style="color:${colorCta};font-size:18px;margin-bottom:8px;">${titulo}</h2>
    <p style="color:#3D5068;font-size:14px;line-height:1.6;margin-bottom:24px;">
      Hola${params.nombre ? ` <strong>${params.nombre}</strong>` : ""}, ${cuerpo}
    </p>
    ${boton(`${BASE_URL}/facturacion`, params.tipo === "dia_7_vencido" ? "Reactivar mi plan" : "Ver mi facturación", colorCta)}
  `);
  await enviarSeguro({
    to: params.to,
    subject,
    html,
    contexto: `recordatorio-${params.tipo}`,
  });
}
