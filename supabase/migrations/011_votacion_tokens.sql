-- Tokens de votación para portal público de acreedores
ALTER TABLE sgcc_votacion_insolvencia ADD COLUMN IF NOT EXISTS token TEXT UNIQUE;
ALTER TABLE sgcc_votacion_insolvencia ADD COLUMN IF NOT EXISTS otp_verificado BOOLEAN DEFAULT FALSE;
ALTER TABLE sgcc_votacion_insolvencia ADD COLUMN IF NOT EXISTS ip TEXT;
ALTER TABLE sgcc_votacion_insolvencia ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE sgcc_votacion_insolvencia ADD COLUMN IF NOT EXISTS modo TEXT DEFAULT 'manual'
  CHECK (modo IN ('manual', 'link'));
ALTER TABLE sgcc_votacion_insolvencia ADD COLUMN IF NOT EXISTS votado_at TIMESTAMPTZ;

-- Agregar modo_votacion a propuesta
ALTER TABLE sgcc_propuesta_pago ADD COLUMN IF NOT EXISTS modo_votacion TEXT DEFAULT 'manual'
  CHECK (modo_votacion IN ('manual', 'link', 'dual'));
