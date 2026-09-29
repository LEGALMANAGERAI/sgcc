"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase-browser";
import {
  FileText,
  Send,
  Upload,
  Download,
  Loader2,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  History,
} from "lucide-react";

type RolStaff = "admin" | "conciliador" | "secretario" | "asistente";

interface RevisionActasPanelProps {
  caseId: string;
  rol: RolStaff;
  staffId: string;
  conciliadorCasoId: string | null;
}

type EstadoRevision = "borrador" | "en_revision" | "devuelta" | "aprobada";
type EstadoFirmaActa = "pendiente" | "firmado_parcial" | "firmado_completo" | "archivado";
type AccionRevision = "enviar_revision" | "aprobar" | "devolver" | "enviar_partes";
type AccionBitacora = "enviada_revision" | "devuelta" | "aprobada" | "nueva_version" | "enviada_partes";

interface ActaRevisionItem {
  id: string;
  numero_acta: string | null;
  tipo: string;
  es_constancia: boolean;
  fecha_acta: string | null;
  estado_revision: EstadoRevision;
  envio_autorizado_asistente: boolean;
  borrador_url: string | null;
  estado_firma: EstadoFirmaActa;
  acta_firmada_url: string | null;
  created_at: string;
}

interface BitacoraEntry {
  id: string;
  accion: AccionBitacora;
  observaciones: string | null;
  documento_url: string | null;
  created_at: string;
  staff_nombre: string;
}

const TIPO_ACTA_LABEL: Record<string, string> = {
  acuerdo_total: "Acuerdo total",
  acuerdo_parcial: "Acuerdo parcial",
  no_acuerdo: "Sin acuerdo",
  inasistencia: "Inasistencia",
  desistimiento: "Desistimiento",
  improcedente: "Improcedencia",
  suscripcion_apoyo: "Suscripción de acuerdo de apoyo",
  no_suscripcion_apoyo: "No suscripción de acuerdo de apoyo",
};

const REVISION_BADGE: Record<EstadoRevision, { label: string; className: string }> = {
  borrador: { label: "Borrador", className: "bg-gray-100 text-gray-700" },
  en_revision: { label: "En revisión", className: "bg-amber-100 text-amber-800" },
  devuelta: { label: "Devuelta", className: "bg-red-100 text-red-700" },
  aprobada: { label: "Aprobada", className: "bg-green-100 text-green-800" },
};

const FIRMA_BADGE: Record<EstadoFirmaActa, { label: string; className: string }> = {
  pendiente: { label: "Firma pendiente", className: "bg-gray-100 text-gray-700" },
  firmado_parcial: { label: "En firma", className: "bg-yellow-100 text-yellow-800" },
  firmado_completo: { label: "Firmada", className: "bg-green-100 text-green-800" },
  archivado: { label: "Archivada", className: "bg-gray-100 text-gray-700" },
};

const ACCION_LABEL: Record<AccionBitacora, string> = {
  enviada_revision: "Envió a revisión",
  devuelta: "Devolvió con observaciones",
  aprobada: "Aprobó",
  nueva_version: "Subió nueva versión",
  enviada_partes: "Envió a las partes",
};

function fechaCorta(fecha: string | null): string {
  if (!fecha) return "—";
  return new Date(fecha).toLocaleDateString("es-CO", { timeZone: "America/Bogota" });
}

function fechaHora(fecha: string): string {
  return new Date(fecha).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function RevisionActasPanel({ caseId, rol, staffId, conciliadorCasoId }: RevisionActasPanelProps) {
  const [actas, setActas] = useState<ActaRevisionItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargarActas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/casos/${caseId}/acta`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "No se pudieron cargar las actas");
      }
      const data = await res.json();
      setActas(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message ?? "Error inesperado al cargar las actas");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    cargarActas();
  }, [cargarActas]);

  // Tiempo real: quien cambia un acta avisa por Broadcast en el canal del
  // expediente y los demás que lo tienen abierto recargan vía API (con sus
  // permisos). El aviso no lleva datos, solo el "recarga".
  const canalRef = useRef<RealtimeChannel | null>(null);
  useEffect(() => {
    if (!supabaseBrowser) return;
    const canal = supabaseBrowser
      .channel(`actas:${caseId}`)
      .on("broadcast", { event: "cambio" }, () => cargarActas())
      .subscribe();
    canalRef.current = canal;
    return () => {
      supabaseBrowser.removeChannel(canal);
      canalRef.current = null;
    };
  }, [caseId, cargarActas]);

  // Cambio hecho en ESTA pestaña: recargar y avisar a los demás.
  const cambioLocal = useCallback(() => {
    cargarActas();
    canalRef.current?.send({ type: "broadcast", event: "cambio", payload: {} });
  }, [cargarActas]);

  useEffect(() => {
    window.addEventListener("actas:cambio", cambioLocal);
    return () => window.removeEventListener("actas:cambio", cambioLocal);
  }, [cambioLocal]);

  // Respaldo: si la pestaña estaba oculta cuando llegó un aviso, ponerse al día al volver.
  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState === "visible") cargarActas();
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, [cargarActas]);

  if (loading && actas === null) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4" role="status">
        <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!actas || actas.length === 0) return null;

  return (
    <div className="space-y-4 mb-8">
      <h3 className="text-sm font-semibold text-[#0D2340] uppercase tracking-wide">
        Revisión de actas
      </h3>
      {actas.map((acta) => (
        <ActaRevisionCard
          key={acta.id}
          acta={acta}
          caseId={caseId}
          rol={rol}
          staffId={staffId}
          conciliadorCasoId={conciliadorCasoId}
          onCambio={cambioLocal}
        />
      ))}
    </div>
  );
}

function ActaRevisionCard({
  acta,
  caseId,
  rol,
  staffId,
  conciliadorCasoId,
  onCambio,
}: {
  acta: ActaRevisionItem;
  caseId: string;
  rol: RolStaff;
  staffId: string;
  conciliadorCasoId: string | null;
  onCambio: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [observaciones, setObservaciones] = useState("");
  const [autorizarAsistente, setAutorizarAsistente] = useState(false);
  const [historialOpen, setHistorialOpen] = useState(false);
  const [historial, setHistorial] = useState<BitacoraEntry[] | null>(null);
  const [historialLoading, setHistorialLoading] = useState(false);
  const [historialError, setHistorialError] = useState<string | null>(null);

  const esRevisor = staffId === conciliadorCasoId || rol === "admin";
  const puedeEnviar =
    acta.estado_revision === "aprobada" &&
    (esRevisor || rol === "secretario" || (rol === "asistente" && acta.envio_autorizado_asistente));

  const cargarHistorial = useCallback(async () => {
    setHistorialLoading(true);
    setHistorialError(null);
    try {
      const res = await fetch(`/api/casos/${caseId}/acta/revision?acta_id=${acta.id}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "No se pudo cargar el historial");
      }
      const data = await res.json();
      setHistorial(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setHistorialError(e.message ?? "Error inesperado al cargar el historial");
    } finally {
      setHistorialLoading(false);
    }
  }, [caseId, acta.id]);

  // Devuelta: cargamos la bitácora de una vez para destacar la última observación.
  useEffect(() => {
    if (acta.estado_revision === "devuelta" && historial === null && !historialLoading) {
      cargarHistorial();
    }
  }, [acta.estado_revision, historial, historialLoading, cargarHistorial]);

  function toggleHistorial() {
    const abrir = !historialOpen;
    setHistorialOpen(abrir);
    if (abrir && historial === null) cargarHistorial();
  }

  async function postRevision(accion: AccionRevision, extra: Record<string, unknown> = {}) {
    setBusy(accion);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/casos/${caseId}/acta/revision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acta_id: acta.id, accion, ...extra }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo completar la acción");
      const MENSAJES: Record<AccionRevision, string> = {
        enviar_revision: "Acta enviada a revisión.",
        aprobar: "Acta aprobada.",
        devolver: "Acta devuelta con observaciones.",
        enviar_partes: "Acta enviada a las partes.",
      };
      setSuccessMsg(MENSAJES[accion]);
      setObservaciones("");
      onCambio();
    } catch (e: any) {
      setErrorMsg(e.message ?? "Error inesperado");
    } finally {
      setBusy(null);
    }
  }

  async function subirVersion(file: File) {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!file.name.toLowerCase().endsWith(".docx")) {
      setErrorMsg("Solo se permiten archivos Word (.docx)");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setErrorMsg("El archivo supera el límite de 4 MB");
      return;
    }
    setBusy("version");
    try {
      const fd = new FormData();
      fd.append("acta_id", acta.id);
      fd.append("file", file);
      const res = await fetch(`/api/casos/${caseId}/acta/version`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo subir la nueva versión");
      setSuccessMsg("Nueva versión subida correctamente.");
      onCambio();
    } catch (e: any) {
      setErrorMsg(e.message ?? "Error inesperado");
    } finally {
      setBusy(null);
    }
  }

  async function enviarAFirma(confirmado = false) {
    setBusy("firma");
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/expediente/${caseId}/acta-firma`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acta_id: acta.id, confirmar_duplicado: confirmado === true }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.requiere_confirmacion) {
        setBusy(null);
        if (confirm(data.error || "Ya existe un documento de firma activo para este caso. ¿Crear otro de todas formas?")) {
          await enviarAFirma(true);
        }
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Error al enviar a firma");
      setSuccessMsg(`Documento enviado a firma. ID: ${data.firma_documento_id}.`);
      onCambio();
    } catch (e: any) {
      setErrorMsg(e.message ?? "Error inesperado");
    } finally {
      setBusy(null);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) subirVersion(file);
  }

  const ultimaDevolucion = historial
    ? [...historial].reverse().find((h) => h.accion === "devuelta")
    : null;

  const revisionBadge = REVISION_BADGE[acta.estado_revision];
  const firmaBadge = FIRMA_BADGE[acta.estado_firma];
  const tipoLabel = acta.es_constancia
    ? "Constancia"
    : TIPO_ACTA_LABEL[acta.tipo] ?? acta.tipo;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#1B4F9B]" />
          <span className="font-semibold text-[#0D2340]">{acta.numero_acta ?? "—"}</span>
          <span className="text-sm text-gray-500">{tipoLabel}</span>
          <span className="text-xs text-gray-400">{fechaCorta(acta.fecha_acta)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${revisionBadge.className}`}>
            {revisionBadge.label}
          </span>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${firmaBadge.className}`}>
            {firmaBadge.label}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {acta.borrador_url && (
          <a
            href={acta.borrador_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[#1B4F9B] bg-blue-50 hover:bg-blue-100 rounded-lg"
          >
            <Download className="w-3.5 h-3.5" />
            Descargar borrador
          </a>
        )}
        {acta.acta_firmada_url && (
          <a
            href={acta.acta_firmada_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Descargar firmada
          </a>
        )}
      </div>

      {acta.estado_revision === "devuelta" && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800">Devuelta con observaciones</p>
            <p className="text-sm text-red-700 mt-0.5">
              {historialLoading && !ultimaDevolucion
                ? "Cargando observaciones..."
                : ultimaDevolucion?.observaciones ?? "Sin observaciones registradas."}
            </p>
          </div>
        </div>
      )}

      {/* Borrador/devuelta: quien no es revisor puede subir versión y enviar a revisión */}
      {(acta.estado_revision === "borrador" || acta.estado_revision === "devuelta") && !esRevisor && (
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <label className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer border border-gray-200">
            <Upload className="w-3.5 h-3.5" />
            Subir nueva versión
            <input
              type="file"
              accept=".docx"
              className="hidden"
              onChange={handleFileChange}
              disabled={busy !== null}
              aria-label="Subir nueva versión del acta (Word .docx, máx. 4 MB)"
            />
          </label>
          <span className="text-[11px] text-gray-400">Word (.docx), máx. 4 MB</span>
          <button
            type="button"
            onClick={() => postRevision("enviar_revision")}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#0D2340] hover:bg-[#1B4F9B] rounded-lg disabled:opacity-50"
          >
            {busy === "enviar_revision" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar a revisión
          </button>
        </div>
      )}

      {/* En revisión: el revisor decide */}
      {acta.estado_revision === "en_revision" && esRevisor && (
        <div className="space-y-3 pt-1">
          <label className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer border border-gray-200 w-fit">
            <Upload className="w-3.5 h-3.5" />
            Subir versión corregida
            <input
              type="file"
              accept=".docx"
              className="hidden"
              onChange={handleFileChange}
              disabled={busy !== null}
              aria-label="Subir versión corregida del acta (Word .docx, máx. 4 MB)"
            />
          </label>

          <div>
            <label htmlFor={`obs-${acta.id}`} className="block text-xs font-medium text-gray-600 mb-1">
              Observaciones (obligatorias para devolver)
            </label>
            <textarea
              id={`obs-${acta.id}`}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={3}
              placeholder="Describe qué debe corregirse..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F9B] resize-y"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={autorizarAsistente}
              onChange={(e) => setAutorizarAsistente(e.target.checked)}
              className="rounded border-gray-300"
            />
            Autorizar a la asistente a enviarla a las partes / firma
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => postRevision("devolver", { observaciones })}
              disabled={busy !== null || observaciones.trim().length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg disabled:opacity-50"
            >
              {busy === "devolver" ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
              Devolver con observaciones
            </button>
            <button
              type="button"
              onClick={() => postRevision("aprobar", { autorizar_envio: autorizarAsistente })}
              disabled={busy !== null}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#0D2340] hover:bg-[#1B4F9B] rounded-lg disabled:opacity-50"
            >
              {busy === "aprobar" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Aprobar
            </button>
          </div>
        </div>
      )}

      {acta.estado_revision === "en_revision" && !esRevisor && (
        <p className="text-sm text-gray-500 italic">En revisión del conciliador.</p>
      )}

      {acta.estado_revision === "aprobada" && puedeEnviar && (
        <div className="flex flex-wrap gap-3 pt-1">
          <button
            type="button"
            onClick={() => {
              if (confirm("¿Enviar el acta a las partes por correo?")) postRevision("enviar_partes");
            }}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#0D2340] hover:bg-[#1B4F9B] rounded-lg disabled:opacity-50"
          >
            {busy === "enviar_partes" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar a las partes
          </button>
          {acta.estado_firma === "pendiente" && (
            <button
              type="button"
              onClick={() => enviarAFirma(false)}
              disabled={busy !== null}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#1B4F9B] bg-blue-50 hover:bg-blue-100 rounded-lg disabled:opacity-50"
            >
              {busy === "firma" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Enviar a firma electrónica
            </button>
          )}
        </div>
      )}

      {errorMsg && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2" role="status">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-600">{errorMsg}</p>
        </div>
      )}
      {successMsg && (
        <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2" role="status">
          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-green-700">{successMsg}</p>
        </div>
      )}

      <div className="pt-1">
        <button
          type="button"
          onClick={toggleHistorial}
          aria-expanded={historialOpen}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700"
        >
          <History className="w-3.5 h-3.5" />
          Ver historial
          {historialOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {historialOpen && (
          <div className="mt-3 space-y-2 border-l-2 border-gray-100 pl-4">
            {historialLoading && (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Cargando historial...
              </div>
            )}
            {historialError && <p className="text-xs text-red-500">{historialError}</p>}
            {!historialLoading && !historialError && historial && historial.length === 0 && (
              <p className="text-xs text-gray-400">Sin movimientos registrados.</p>
            )}
            {historial?.map((h) => (
              <div key={h.id} className="text-xs">
                <p className="text-gray-600">
                  <span className="font-medium text-[#0D2340]">{ACCION_LABEL[h.accion] ?? h.accion}</span>
                  {" — "}
                  {h.staff_nombre} · {fechaHora(h.created_at)}
                </p>
                {h.observaciones && <p className="text-gray-500 mt-0.5">{h.observaciones}</p>}
                {h.documento_url && (
                  <a
                    href={h.documento_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#1B4F9B] hover:underline"
                  >
                    Ver documento
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
