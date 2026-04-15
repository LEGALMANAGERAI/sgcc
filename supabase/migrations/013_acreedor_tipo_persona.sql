-- ═══════════════════════════════════════════════════════════════════════
-- Tipo de persona del acreedor: natural (CC/CE) o jurídica (NIT)
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE sgcc_acreencias
  ADD COLUMN IF NOT EXISTS acreedor_tipo TEXT NOT NULL DEFAULT 'natural'
  CHECK (acreedor_tipo IN ('natural', 'juridica'));

COMMENT ON COLUMN sgcc_acreencias.acreedor_tipo IS
  'Tipo de persona del acreedor: natural (CC/CE) o juridica (NIT)';
