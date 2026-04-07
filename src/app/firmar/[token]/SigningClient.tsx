"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  FileText,
  Send,
  KeyRound,
  Camera,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Download,
} from "lucide-react";

/* ─── Tipos ──────────────────────────────────────────────────────────── */

interface FirmaData {
  documento: {
    nombre: string;
    descripcion: string | null;
    archivo_url: string;
  };
  firmante: {
    nombre: string;
    email: string;
  };
}

interface Props {
  token: string;
  initialData: FirmaData;
}

type Paso = 1 | 2 | 3 | 4 | 5;

const pasos = [
  { num: 1, label: "Revisar", icon: FileText },
  { num: 2, label: "Solicitar OTP", icon: Send },
  { num: 3, label: "Verificar", icon: KeyRound },
  { num: 4, label: "Foto", icon: Camera },
  { num: 5, label: "Resultado", icon: CheckCircle2 },
];

/* ─── Componente ─────────────────────────────────────────────────────── */

export function SigningClient({ token, initialData }: Props) {
  const [paso, setPaso] = useState<Paso>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // OTP
  const [otpDestino, setOtpDestino] = useState("");
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [intentosRestantes, setIntentosRestantes] = useState(5);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Foto
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [fotoBase64, setFotoBase64] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState("");

  // Resultado
  const [resultado, setResultado] = useState<{
    exito: boolean;
    fecha?: string;
    ip?: string;
    transaction_id?: string;
    pdf_url?: string;
    mensaje?: string;
  } | null>(null);

  // Rechazo
  const [showRechazo, setShowRechazo] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState("");

  /* ─── Cleanup c\u00e1mara ───────────────────────────────────────────────── */

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  /* ─── Acciones ─────────────────────────────────────────────────────── */

  const solicitarOtp = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/firmar/${token}/otp`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error al enviar c\u00f3digo");
        return;
      }
      setOtpDestino(data.destino_enmascarado ?? "tu correo");
      setPaso(3);
    } catch {
      setError("Error de conexi\u00f3n");
    } finally {
      setLoading(false);
    }
  };

  const verificarOtp = async () => {
    const codigo = otpDigits.join("");
    if (codigo.length !== 6) {
      setError("Ingresa los 6 d\u00edgitos del c\u00f3digo");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/firmar/${token}/verificar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "C\u00f3digo incorrecto");
        if (data.intentos_restantes !== undefined) {
          setIntentosRestantes(data.intentos_restantes);
        }
        return;
      }
      // Abrir c\u00e1mara e ir a paso 4
      await iniciarCamara();
      setPaso(4);
    } catch {
      setError("Error de conexi\u00f3n");
    } finally {
      setLoading(false);
    }
  };

  const iniciarCamara = async () => {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 300, height: 300, facingMode: "user" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setCameraError("No se pudo acceder a la c\u00e1mara. Verifica los permisos del navegador.");
    }
  };

  const capturarFoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, 300, 300);
    const base64 = canvas.toDataURL("image/jpeg", 0.8);
    setFotoBase64(base64);
    stopCamera();
  };

  const retomarFoto = async () => {
    setFotoBase64(null);
    await iniciarCamara();
  };

  const confirmarFirma = async () => {
    if (!fotoBase64) {
      setError("Debes capturar una foto antes de firmar");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/firmar/${token}/firmar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ foto: fotoBase64 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResultado({ exito: false, mensaje: data.error ?? "Error al firmar" });
      } else {
        setResultado({
          exito: true,
          fecha: data.fecha,
          ip: data.ip,
          transaction_id: data.transaction_id,
          pdf_url: data.pdf_url,
        });
      }
      setPaso(5);
    } catch {
      setResultado({ exito: false, mensaje: "Error de conexi\u00f3n" });
      setPaso(5);
    } finally {
      setLoading(false);
    }
  };

  const rechazarDocumento = async () => {
    if (!motivoRechazo.trim()) {
      setError("Debes indicar un motivo de rechazo");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/firmar/${token}/rechazar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: motivoRechazo.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error al rechazar");
      } else {
        setResultado({ exito: false, mensaje: "Has rechazado el documento." });
        setPaso(5);
        setShowRechazo(false);
      }
    } catch {
      setError("Error de conexi\u00f3n");
    } finally {
      setLoading(false);
    }
  };

  /* ─── OTP input handlers ───────────────────────────────────────────── */

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const newDigits = [...otpDigits];
    newDigits[index] = value;
    setOtpDigits(newDigits);
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const newDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] ?? "";
    }
    setOtpDigits(newDigits);
    const nextEmpty = newDigits.findIndex((d) => !d);
    otpRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus();
  };

  /* ─── Render ───────────────────────────────────────────────────────── */

  return (
    <div>
      {/* Stepper */}
      <div className="flex items-center justify-between mb-8">
        {pasos.map((p, i) => {
          const isActive = p.num === paso;
          const isCompleted = p.num < paso;
          const Icon = p.icon;

          return (
            <div key={p.num} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                    isCompleted
                      ? "bg-[#0D2340] text-white"
                      : isActive
                      ? "bg-[#1B4F9B] text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    p.num
                  )}
                </div>
                <span
                  className={`text-xs mt-1 hidden sm:block ${
                    isActive ? "text-[#1B4F9B] font-medium" : "text-gray-400"
                  }`}
                >
                  {p.label}
                </span>
              </div>
              {i < pasos.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 ${
                    p.num < paso ? "bg-[#0D2340]" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Error global */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4 flex items-center gap-2">
          <XCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Contenido de cada paso */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        {/* ── PASO 1: Revisar documento ──────────────────────────────── */}
        {paso === 1 && (
          <div>
            <h2 className="text-lg font-bold text-[#0D2340] mb-2">Revisar documento</h2>
            <p className="text-sm text-gray-600 mb-4">
              Hola <strong>{initialData.firmante.nombre}</strong>, revisa el siguiente documento
              antes de proceder a firmarlo.
            </p>

            <div className="mb-4">
              <h3 className="font-medium text-gray-900">{initialData.documento.nombre}</h3>
              {initialData.documento.descripcion && (
                <p className="text-sm text-gray-500 mt-1">{initialData.documento.descripcion}</p>
              )}
            </div>

            {/* PDF iframe */}
            <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
              <iframe
                src={initialData.documento.archivo_url}
                className="w-full h-[500px]"
                title="Documento PDF"
              />
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowRechazo(true)}
                className="text-sm text-red-600 hover:text-red-800 transition-colors"
              >
                Rechazar documento
              </button>
              <button
                onClick={() => setPaso(2)}
                className="bg-[#0D2340] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[#0d2340dd] transition-colors"
              >
                Continuar para firmar
              </button>
            </div>
          </div>
        )}

        {/* ── PASO 2: Solicitar OTP ──────────────────────────────────── */}
        {paso === 2 && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Send className="w-8 h-8 text-[#0D2340]" />
            </div>
            <h2 className="text-lg font-bold text-[#0D2340] mb-2">Verificaci&#243;n de identidad</h2>
            <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
              Enviaremos un c&#243;digo de verificaci&#243;n de 6 d&#237;gitos a tu correo electr&#243;nico
              para confirmar tu identidad.
            </p>

            <button
              onClick={solicitarOtp}
              disabled={loading}
              className="bg-[#1B4F9B] text-white px-8 py-3 rounded-lg text-sm font-medium hover:bg-[#a07609] transition-colors disabled:opacity-50 inline-flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Enviar c&#243;digo
            </button>

            <div className="mt-6">
              <button
                onClick={() => setShowRechazo(true)}
                className="text-sm text-red-600 hover:text-red-800 transition-colors"
              >
                Rechazar documento
              </button>
            </div>
          </div>
        )}

        {/* ── PASO 3: Ingresar OTP ───────────────────────────────────── */}
        {paso === 3 && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <KeyRound className="w-8 h-8 text-[#1B4F9B]" />
            </div>
            <h2 className="text-lg font-bold text-[#0D2340] mb-2">Ingresa el c&#243;digo</h2>
            <p className="text-sm text-gray-600 mb-6">
              C&#243;digo enviado a <strong>{otpDestino}</strong>
            </p>

            {/* 6 inputs */}
            <div className="flex items-center justify-center gap-3 mb-6" onPaste={handleOtpPaste}>
              {otpDigits.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { otpRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className="w-12 h-14 text-center text-xl font-bold border-2 border-gray-300 rounded-lg focus:border-[#1B4F9B] focus:ring-2 focus:ring-[#1B4F9B]/30 outline-none transition-colors"
                />
              ))}
            </div>

            {intentosRestantes < 5 && (
              <p className="text-xs text-red-500 mb-4">
                Intentos restantes: {intentosRestantes}
              </p>
            )}

            <button
              onClick={verificarOtp}
              disabled={loading}
              className="bg-[#0D2340] text-white px-8 py-3 rounded-lg text-sm font-medium hover:bg-[#0d2340dd] transition-colors disabled:opacity-50 inline-flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <KeyRound className="w-4 h-4" />
              )}
              Verificar
            </button>

            <div className="mt-4">
              <button
                onClick={solicitarOtp}
                disabled={loading}
                className="text-sm text-[#1B4F9B] hover:underline inline-flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Reenviar c&#243;digo
              </button>
            </div>

            <div className="mt-6">
              <button
                onClick={() => setShowRechazo(true)}
                className="text-sm text-red-600 hover:text-red-800 transition-colors"
              >
                Rechazar documento
              </button>
            </div>
          </div>
        )}

        {/* ── PASO 4: Captura de foto ────────────────────────────────── */}
        {paso === 4 && (
          <div className="text-center py-4">
            <h2 className="text-lg font-bold text-[#0D2340] mb-2">Captura de foto</h2>
            <p className="text-sm text-gray-600 mb-6">
              Necesitamos una foto tuya para validar tu identidad al firmar el documento.
            </p>

            {cameraError ? (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
                {cameraError}
              </div>
            ) : (
              <div className="flex flex-col items-center">
                {!fotoBase64 ? (
                  <>
                    <div className="w-[300px] h-[300px] bg-gray-900 rounded-xl overflow-hidden mb-4 relative">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      {/* Gu\u00eda circular */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-48 h-48 border-2 border-white/50 rounded-full" />
                      </div>
                    </div>
                    <button
                      onClick={capturarFoto}
                      className="bg-[#1B4F9B] text-white px-8 py-3 rounded-lg text-sm font-medium hover:bg-[#a07609] transition-colors inline-flex items-center gap-2"
                    >
                      <Camera className="w-4 h-4" />
                      Capturar foto
                    </button>
                  </>
                ) : (
                  <>
                    <div className="w-[300px] h-[300px] rounded-xl overflow-hidden mb-4 border-2 border-green-400">
                      <img
                        src={fotoBase64}
                        alt="Foto capturada"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={retomarFoto}
                        className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors inline-flex items-center gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Volver a tomar
                      </button>
                      <button
                        onClick={confirmarFirma}
                        disabled={loading}
                        className="bg-[#0D2340] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[#0d2340dd] transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                      >
                        {loading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        Confirmar y firmar
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            <canvas ref={canvasRef} className="hidden" />

            <div className="mt-6">
              <button
                onClick={() => setShowRechazo(true)}
                className="text-sm text-red-600 hover:text-red-800 transition-colors"
              >
                Rechazar documento
              </button>
            </div>
          </div>
        )}

        {/* ── PASO 5: Resultado ──────────────────────────────────────── */}
        {paso === 5 && resultado && (
          <div className="text-center py-8">
            {resultado.exito ? (
              <>
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-10 h-10 text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-green-800 mb-2">
                  Documento firmado correctamente
                </h2>
                <p className="text-sm text-gray-600 mb-6">
                  Tu firma electr&#243;nica ha sido registrada exitosamente.
                </p>

                <div className="bg-gray-50 rounded-lg p-4 max-w-sm mx-auto text-left text-sm space-y-2 mb-6">
                  {resultado.fecha && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Fecha:</span>
                      <span className="text-gray-900 font-medium">{resultado.fecha}</span>
                    </div>
                  )}
                  {resultado.ip && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">IP:</span>
                      <span className="text-gray-900 font-mono text-xs">{resultado.ip}</span>
                    </div>
                  )}
                  {resultado.transaction_id && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Transaction ID:</span>
                      <span className="text-gray-900 font-mono text-xs">{resultado.transaction_id}</span>
                    </div>
                  )}
                </div>

                {resultado.pdf_url && (
                  <a
                    href={resultado.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-[#0D2340] text-white px-6 py-3 rounded-lg text-sm font-medium hover:bg-[#0d2340dd] transition-colors inline-flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Descargar documento firmado
                  </a>
                )}
              </>
            ) : (
              <>
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <XCircle className="w-10 h-10 text-red-600" />
                </div>
                <h2 className="text-xl font-bold text-red-800 mb-2">
                  {resultado.mensaje ?? "Error al procesar la firma"}
                </h2>
                <p className="text-sm text-gray-600">
                  Si crees que esto es un error, contacta al remitente del documento.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Modal de rechazo ─────────────────────────────────────────── */}
      {showRechazo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Rechazar documento</h3>
            <p className="text-sm text-gray-600 mb-4">
              Indica el motivo por el cual rechazas firmar este documento.
            </p>

            <textarea
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
              rows={4}
              placeholder="Escribe el motivo de rechazo..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none resize-none mb-4"
            />

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowRechazo(false);
                  setMotivoRechazo("");
                  setError("");
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={rechazarDocumento}
                disabled={loading || !motivoRechazo.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Rechazar documento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
