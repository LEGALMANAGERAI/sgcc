-- ============================================================
-- SGCC — Módulo de Firma Electrónica
-- Migración 004: Tablas para firma electrónica certificada
-- Ley 527 de 1999 / Decreto 2364 de 2012
-- ============================================================

-- Documentos de firma
CREATE TABLE IF NOT EXISTS sgcc_firma_documentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  center_id UUID NOT NULL REFERENCES sgcc_centers(id) ON DELETE CASCADE,
  case_id UUID REFERENCES sgcc_cases(id) ON DELETE SET NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  archivo_url TEXT NOT NULL,
  archivo_hash TEXT NOT NULL, -- SHA-256 del PDF original
  archivo_firmado_url TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'enviado', 'en_proceso', 'completado', 'rechazado', 'expirado')),
  orden_secuencial BOOLEAN NOT NULL DEFAULT FALSE,
  dias_expiracion INTEGER NOT NULL DEFAULT 3,
  fecha_expiracion TIMESTAMPTZ,
  total_firmantes INTEGER NOT NULL DEFAULT 0,
  firmantes_completados INTEGER NOT NULL DEFAULT 0,
  creado_por UUID REFERENCES sgcc_staff(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Firmantes
CREATE TABLE IF NOT EXISTS sgcc_firmantes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firma_documento_id UUID NOT NULL REFERENCES sgcc_firma_documentos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  cedula TEXT NOT NULL,
  email TEXT NOT NULL,
  telefono TEXT,
  orden INTEGER NOT NULL DEFAULT 1,
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'enviado', 'visto', 'firmado', 'rechazado', 'expirado')),
  token TEXT NOT NULL UNIQUE,
  canal_notificacion TEXT NOT NULL DEFAULT 'email',
  motivo_rechazo TEXT,
  firmado_at TIMESTAMPTZ,
  visto_at TIMESTAMPTZ,
  enviado_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Registro de auditoría (audit trail)
CREATE TABLE IF NOT EXISTS sgcc_firma_registros (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firmante_id UUID REFERENCES sgcc_firmantes(id) ON DELETE CASCADE,
  firma_documento_id UUID NOT NULL REFERENCES sgcc_firma_documentos(id) ON DELETE CASCADE,
  accion TEXT NOT NULL
    CHECK (accion IN ('otp_solicitado', 'otp_verificado', 'firmado', 'rechazado', 'visto', 'enviado')),
  ip TEXT,
  user_agent TEXT,
  hash_documento TEXT,
  canal_otp TEXT,
  metadatos JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- OTP para verificación
CREATE TABLE IF NOT EXISTS sgcc_firma_otp (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firmante_id UUID NOT NULL REFERENCES sgcc_firmantes(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL, -- 6 dígitos
  canal TEXT NOT NULL DEFAULT 'email',
  expires_at TIMESTAMPTZ NOT NULL,
  usado BOOLEAN NOT NULL DEFAULT FALSE,
  intentos INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Recordatorios enviados
CREATE TABLE IF NOT EXISTS sgcc_firma_recordatorios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firmante_id UUID NOT NULL REFERENCES sgcc_firmantes(id) ON DELETE CASCADE,
  canal TEXT NOT NULL DEFAULT 'email',
  enviado_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_firma_docs_center ON sgcc_firma_documentos(center_id);
CREATE INDEX IF NOT EXISTS idx_firma_docs_case ON sgcc_firma_documentos(case_id);
CREATE INDEX IF NOT EXISTS idx_firma_docs_estado ON sgcc_firma_documentos(estado);
CREATE INDEX IF NOT EXISTS idx_firmantes_doc ON sgcc_firmantes(firma_documento_id);
CREATE INDEX IF NOT EXISTS idx_firmantes_token ON sgcc_firmantes(token);
CREATE INDEX IF NOT EXISTS idx_firma_registros_doc ON sgcc_firma_registros(firma_documento_id);
CREATE INDEX IF NOT EXISTS idx_firma_otp_firmante ON sgcc_firma_otp(firmante_id);

-- RLS
ALTER TABLE sgcc_firma_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_firmantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_firma_registros ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_firma_otp ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_firma_recordatorios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON sgcc_firma_documentos FOR ALL USING (TRUE);
CREATE POLICY "allow_all" ON sgcc_firmantes FOR ALL USING (TRUE);
CREATE POLICY "allow_all" ON sgcc_firma_registros FOR ALL USING (TRUE);
CREATE POLICY "allow_all" ON sgcc_firma_otp FOR ALL USING (TRUE);
CREATE POLICY "allow_all" ON sgcc_firma_recordatorios FOR ALL USING (TRUE);
