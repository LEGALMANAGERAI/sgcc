-- ═══════════════════════════════════════════════════════════════════════
-- Identificación del crédito por acreedor (ej: Tarjeta Visa 1234, Hipoteca, etc.)
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE sgcc_acreencias
  ADD COLUMN IF NOT EXISTS identificacion_credito TEXT;

COMMENT ON COLUMN sgcc_acreencias.identificacion_credito IS
  'Descripción corta que identifica el crédito concreto del acreedor';
