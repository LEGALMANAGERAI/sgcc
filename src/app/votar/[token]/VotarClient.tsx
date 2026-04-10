"use client";

import { useState, useRef } from "react";
import {
  FileText,
  Send,
  KeyRound,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  MinusCircle,
} from "lucide-react";

interface Props {
  token: string;
  initialData: {
    acreedor: {
      acreedor_nombre: string;
      acreedor_documento: string | null;
      con_capital: number;
      porcentaje_voto: number;
      clase_credito: string;
      es_pequeno_acreedor: boolean;
    };
    propuesta: {
      titulo: string;
      descripcion: string;
      plazo_meses: number | null;
      tasa_interes: string | null;
      periodo_gracia_meses: number;
      radicado: string;
    };
  };
}

type Paso = 1 | 2 | 3 | 4;

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

export function VotarClient({ token, initialData }: Props) {
  const { acreedor, propuesta } = initialData;
  const [paso, setPaso] = useState<Paso>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // OTP
  const [otpDestino, setOtpDestino] = useState("");
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [intentosRestantes, setIntentosRestantes] = useState(3);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Voto
  const [votoSeleccionado, setVotoSeleccionado] = useState<string | null>(null);
  const [observaciones, setObservaciones] = useState("");
  const [resultado, setResultado] = useState<{ ok: boolean; mensaje: string } | null>(null);

  /* ─── OTP ─────────────────────────────────────────────────────────── */

  async function solicitarOtp() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/votar/${token}/otp`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al enviar código"); return; }
      setOtpDestino(data.destino ?? "su correo");
      setPaso(2);
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  }

  async function verificarYVotar() {
    const codigo = otpDigits.join("");
    if (codigo.length !== 6) { setError("Ingrese los 6 dígitos"); return; }
    if (!votoSeleccionado) { setError("Seleccione su voto"); return; }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/votar/${token}/votar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voto: votoSeleccionado,
          codigo_otp: codigo,
          observaciones: observaciones.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error al votar");
        if (data.intentos_restantes !== undefined) setIntentosRestantes(data.intentos_restantes);
        return;
      }
      setResultado({ ok: true, mensaje: data.mensaje });
      setPaso(4);
    } catch { setError("Error de conexión"); }
    finally { setLoading(false); }
  }

  /* ─── OTP handlers ────────────────────────────────────────────────── */

  const handleOtpChange = (i: number, v: string) => {
    if (!/^\d?$/.test(v)) return;
    const d = [...otpDigits]; d[i] = v; setOtpDigits(d);
    if (v && i < 5) otpRefs.current[i + 1]?.focus();
  };

  const handleOtpKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpDigits[i] && i > 0) otpRefs.current[i - 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const p = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const d = [...otpDigits];
    for (let i = 0; i < 6; i++) d[i] = p[i] ?? "";
    setOtpDigits(d);
  };

  /* ─── Render ──────────────────────────────────────────────────────── */

  return (
    <div>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4 flex items-center gap-2">
          <XCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* ── PASO 1: Ver propuesta + seleccionar voto ───────────────────── */}
      {paso === 1 && (
        <div className="space-y-6">
          {/* Info del acreedor */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500 mb-1">Acreedor</p>
            <h2 className="text-xl font-bold text-[#0D2340]">{acreedor.acreedor_nombre}</h2>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
              {acreedor.acreedor_documento && <span>Doc: {acreedor.acreedor_documento}</span>}
              <span>Capital conciliado: <strong>{fmt(acreedor.con_capital)}</strong></span>
              <span>Derecho de voto: <strong>{(acreedor.porcentaje_voto * 100).toFixed(2)}%</strong></span>
            </div>
          </div>

          {/* Propuesta */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-5 h-5 text-[#1B4F9B]" />
              <h3 className="font-semibold text-[#0D2340]">{propuesta.titulo}</h3>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap mb-4">{propuesta.descripcion}</p>
            <div className="flex flex-wrap gap-4 text-xs text-gray-500 border-t border-gray-100 pt-3">
              <span>Caso: {propuesta.radicado}</span>
              {propuesta.plazo_meses && <span>Plazo: {propuesta.plazo_meses} meses</span>}
              {propuesta.tasa_interes && <span>Tasa: {propuesta.tasa_interes}</span>}
              {propuesta.periodo_gracia_meses > 0 && <span>Gracia: {propuesta.periodo_gracia_meses} meses</span>}
            </div>
          </div>

          {/* Selección de voto */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-[#0D2340] mb-4">Su voto</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { value: "positivo", label: "A favor", icon: ThumbsUp, color: "border-green-400 bg-green-50 text-green-800", active: "border-green-600 bg-green-100 ring-2 ring-green-400" },
                { value: "negativo", label: "En contra", icon: ThumbsDown, color: "border-red-300 bg-red-50 text-red-800", active: "border-red-600 bg-red-100 ring-2 ring-red-400" },
                { value: "abstiene", label: "Abstenerme", icon: MinusCircle, color: "border-gray-300 bg-gray-50 text-gray-700", active: "border-gray-600 bg-gray-100 ring-2 ring-gray-400" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setVotoSeleccionado(opt.value)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    votoSeleccionado === opt.value ? opt.active : opt.color + " hover:shadow-md"
                  }`}
                >
                  <opt.icon className="w-8 h-8" />
                  <span className="font-semibold text-sm">{opt.label}</span>
                </button>
              ))}
            </div>

            <div className="mt-4">
              <label className="block text-xs text-gray-600 mb-1">Observaciones (opcional)</label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={2}
                placeholder="Agregue observaciones si lo desea..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1B4F9B]/30 outline-none resize-none"
              />
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={solicitarOtp}
                disabled={loading || !votoSeleccionado}
                className="bg-[#0D2340] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[#0D2340]/90 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Verificar identidad para votar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PASO 2: OTP ───────────────────────────────────────────────── */}
      {paso === 2 && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-8 h-8 text-[#1B4F9B]" />
          </div>
          <h2 className="text-lg font-bold text-[#0D2340] mb-2">Verificación de identidad</h2>
          <p className="text-sm text-gray-600 mb-6">
            Código enviado a <strong>{otpDestino}</strong>
          </p>

          <div className="flex items-center justify-center gap-3 mb-4" onPaste={handlePaste}>
            {otpDigits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { otpRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                onKeyDown={(e) => handleOtpKey(i, e)}
                className="w-12 h-14 text-center text-xl font-bold border-2 border-gray-300 rounded-lg focus:border-[#1B4F9B] focus:ring-2 focus:ring-[#1B4F9B]/30 outline-none"
              />
            ))}
          </div>

          {intentosRestantes < 3 && (
            <p className="text-xs text-red-500 mb-4">Intentos restantes: {intentosRestantes}</p>
          )}

          <div className="flex items-center justify-center gap-3 mb-4">
            <div className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              votoSeleccionado === "positivo" ? "bg-green-100 text-green-800" :
              votoSeleccionado === "negativo" ? "bg-red-100 text-red-800" :
              "bg-gray-100 text-gray-700"
            }`}>
              Voto: {votoSeleccionado === "positivo" ? "A favor" : votoSeleccionado === "negativo" ? "En contra" : "Abstención"}
            </div>
          </div>

          <button
            onClick={verificarYVotar}
            disabled={loading}
            className="bg-[#0D2340] text-white px-8 py-3 rounded-lg text-sm font-medium hover:bg-[#0D2340]/90 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Confirmar voto
          </button>

          <div className="mt-4">
            <button onClick={solicitarOtp} disabled={loading}
              className="text-sm text-[#1B4F9B] hover:underline inline-flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Reenviar código
            </button>
          </div>
        </div>
      )}

      {/* ── PASO 4: Resultado ─────────────────────────────────────────── */}
      {paso === 4 && resultado && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-green-800 mb-2">Voto registrado</h2>
          <p className="text-gray-600">{resultado.mensaje}</p>
          <p className="text-xs text-gray-400 mt-4">
            Puede cerrar esta ventana. Su voto ha sido registrado de forma segura.
          </p>
        </div>
      )}
    </div>
  );
}
