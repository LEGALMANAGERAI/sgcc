-- Ampliar CHECK constraint de acciones en firma_registros
ALTER TABLE sgcc_firma_registros DROP CONSTRAINT IF EXISTS sgcc_firma_registros_accion_check;
ALTER TABLE sgcc_firma_registros ADD CONSTRAINT sgcc_firma_registros_accion_check
  CHECK (accion IN (
    'otp_solicitado', 'otp_verificado', 'firmado', 'rechazado',
    'visto', 'enviado', 'documento_creado', 'recordatorio_enviado', 'cancelado'
  ));

-- Ampliar CHECK constraint de estado en firma_documentos (agregar "cancelado")
ALTER TABLE sgcc_firma_documentos DROP CONSTRAINT IF EXISTS sgcc_firma_documentos_estado_check;
ALTER TABLE sgcc_firma_documentos ADD CONSTRAINT sgcc_firma_documentos_estado_check
  CHECK (estado IN ('pendiente', 'enviado', 'en_proceso', 'completado', 'rechazado', 'expirado', 'cancelado'));

-- Ampliar CHECK constraint de estado en firmantes (agregar "cancelado")
ALTER TABLE sgcc_firmantes DROP CONSTRAINT IF EXISTS sgcc_firmantes_estado_check;
ALTER TABLE sgcc_firmantes ADD CONSTRAINT sgcc_firmantes_estado_check
  CHECK (estado IN ('pendiente', 'enviado', 'visto', 'firmado', 'rechazado', 'expirado', 'cancelado'));

-- Agregar columna firma_documento_id a recordatorios (faltante en migración original)
ALTER TABLE sgcc_firma_recordatorios ADD COLUMN IF NOT EXISTS firma_documento_id UUID REFERENCES sgcc_firma_documentos(id);
