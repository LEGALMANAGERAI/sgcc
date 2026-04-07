// ============================================================
// SGCC — Tipos del módulo de Firma Electrónica
// ============================================================

export type FirmaEstado = "pendiente" | "enviado" | "en_proceso" | "completado" | "rechazado" | "expirado";
export type FirmanteEstado = "pendiente" | "enviado" | "visto" | "firmado" | "rechazado" | "expirado";
export type FirmaAccion = "otp_solicitado" | "otp_verificado" | "firmado" | "rechazado" | "visto" | "enviado";

export interface SgccFirmaDocumento {
  id: string;
  center_id: string;
  case_id: string | null;
  nombre: string;
  descripcion: string | null;
  archivo_url: string;
  archivo_hash: string;
  archivo_firmado_url: string | null;
  estado: FirmaEstado;
  orden_secuencial: boolean;
  dias_expiracion: number;
  fecha_expiracion: string | null;
  total_firmantes: number;
  firmantes_completados: number;
  creado_por: string | null;
  created_at: string;
  updated_at: string;
  // joins
  firmantes?: SgccFirmante[];
}

export interface SgccFirmante {
  id: string;
  firma_documento_id: string;
  nombre: string;
  cedula: string;
  email: string;
  telefono: string | null;
  orden: number;
  estado: FirmanteEstado;
  token: string;
  canal_notificacion: string;
  motivo_rechazo: string | null;
  firmado_at: string | null;
  visto_at: string | null;
  enviado_at: string | null;
  created_at: string;
}

export interface SgccFirmaRegistro {
  id: string;
  firmante_id: string | null;
  firma_documento_id: string;
  accion: FirmaAccion;
  ip: string | null;
  user_agent: string | null;
  hash_documento: string | null;
  canal_otp: string | null;
  metadatos: Record<string, any> | null;
  created_at: string;
}

export interface SgccFirmaOtp {
  id: string;
  firmante_id: string;
  codigo: string;
  canal: string;
  expires_at: string;
  usado: boolean;
  intentos: number;
  created_at: string;
}
