-- 041_firma_lm_partner.sql
-- Integración con la API partner de firma electrónica de Legal Manager (LM),
-- modelo redirect: SIGECC crea la solicitud en LM, redirige a los firmantes al
-- portal de LM (branding LM) y recibe el resultado por webhook.
--
-- Migración aditiva: columnas nullable + default. No transforma datos.

-- Documento: proveedor de firma + referencias a la solicitud en LM.
ALTER TABLE sgcc_firma_documentos
  ADD COLUMN IF NOT EXISTS proveedor text NOT NULL DEFAULT 'propio',
  ADD COLUMN IF NOT EXISTS lm_solicitud_id text,
  ADD COLUMN IF NOT EXISTS lm_verificacion_url text,
  ADD COLUMN IF NOT EXISTS lm_pdf_firmado_url text;

-- Firmante: id y URL de firma en el portal de LM.
ALTER TABLE sgcc_firmantes
  ADD COLUMN IF NOT EXISTS lm_firmante_id text,
  ADD COLUMN IF NOT EXISTS lm_signing_url text;

-- Búsqueda rápida del documento por solicitud de LM (la usa el webhook).
CREATE INDEX IF NOT EXISTS idx_sgcc_firma_doc_lm_solicitud
  ON sgcc_firma_documentos (lm_solicitud_id)
  WHERE lm_solicitud_id IS NOT NULL;

COMMENT ON COLUMN sgcc_firma_documentos.proveedor IS
  'Proveedor de firma: ''propio'' (OTP nativo de SIGECC) o ''lm'' (Legal Manager, redirect).';
