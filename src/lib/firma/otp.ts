import { supabaseAdmin } from "@/lib/supabase";
import { randomInt } from "crypto";

export function generarCodigoOtp(): string {
  return String(randomInt(100000, 999999));
}

export async function crearYEnviarOtp(
  firmanteId: string,
  canal: string,
  email: string
): Promise<{ destino: string; canal: string }> {
  // Invalidar OTPs anteriores
  await supabaseAdmin
    .from("sgcc_firma_otp")
    .update({ usado: true })
    .eq("firmante_id", firmanteId)
    .eq("usado", false);

  const codigo = generarCodigoOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutos

  await supabaseAdmin.from("sgcc_firma_otp").insert({
    firmante_id: firmanteId,
    codigo,
    canal,
    expires_at: expiresAt.toISOString(),
    usado: false,
    intentos: 0,
  });

  // Enviar por email (Resend)
  if (canal === "email" && email) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY || "");
      await resend.emails.send({
        from: "SGCC <notificaciones@sgcc.app>",
        to: email,
        subject: "Código de verificación — SGCC",
        html: `
          <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:20px;">
            <div style="background:#0D2340;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
              <h2 style="color:white;margin:0;">SGCC — Firma Electrónica</h2>
            </div>
            <div style="background:#f9f9f9;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e0e0e0;text-align:center;">
              <p style="color:#333;margin-bottom:16px;">Tu código de verificación es:</p>
              <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#0D2340;margin:16px 0;">${codigo}</p>
              <p style="color:#888;font-size:12px;">Este código expira en 5 minutos.</p>
            </div>
          </div>
        `,
      });
    } catch (e) {
      console.error("Error enviando OTP por email:", e);
    }
  }

  const destino =
    canal === "email"
      ? email.replace(/(.{2})(.*)(@.*)/, "$1***$3")
      : "email";

  return { destino, canal };
}

export async function verificarOtp(
  firmanteId: string,
  codigo: string
): Promise<{ ok: boolean; error?: string; intentosRestantes?: number }> {
  const { data: otp } = await supabaseAdmin
    .from("sgcc_firma_otp")
    .select("*")
    .eq("firmante_id", firmanteId)
    .eq("usado", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!otp)
    return { ok: false, error: "No hay código OTP activo. Solicita uno nuevo." };

  if (new Date(otp.expires_at) < new Date()) {
    await supabaseAdmin
      .from("sgcc_firma_otp")
      .update({ usado: true })
      .eq("id", otp.id);
    return { ok: false, error: "El código ha expirado. Solicita uno nuevo." };
  }

  if (otp.intentos >= 3) {
    await supabaseAdmin
      .from("sgcc_firma_otp")
      .update({ usado: true })
      .eq("id", otp.id);
    return {
      ok: false,
      error: "Demasiados intentos. Solicita un nuevo código.",
    };
  }

  if (otp.codigo !== codigo) {
    await supabaseAdmin
      .from("sgcc_firma_otp")
      .update({ intentos: otp.intentos + 1 })
      .eq("id", otp.id);
    return {
      ok: false,
      error: "Código incorrecto.",
      intentosRestantes: 2 - otp.intentos,
    };
  }

  await supabaseAdmin
    .from("sgcc_firma_otp")
    .update({ usado: true })
    .eq("id", otp.id);
  return { ok: true };
}
