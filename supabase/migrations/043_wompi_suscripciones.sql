-- 043_wompi_suscripciones.sql
-- Integración Wompi: suscripciones + transacciones + webhook log.
--
-- Migración aditiva sobre sgcc_centers (columnas tier + plan_expires_at) y
-- 3 tablas nuevas (sgcc_suscripciones, sgcc_transacciones_pago,
-- sgcc_webhook_eventos_wompi). RLS blindado igual que el resto de tablas
-- sgcc_* (sin políticas; solo service_role puede acceder).

-- 1) Enums (idempotentes vía DO + EXCEPTION).
DO $$ BEGIN
  CREATE TYPE periodo_suscripcion AS ENUM ('MENSUAL', 'ANUAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE estado_suscripcion AS ENUM ('EN_ESPERA', 'ACTIVA', 'PAUSADA', 'CANCELADA', 'VENCIDA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE estado_transaccion AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'ERROR', 'VOIDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tipo_transaccion AS ENUM ('INICIAL', 'RENOVACION', 'UPGRADE', 'DOWNGRADE', 'REINTENTO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Suscripciones.
CREATE TABLE IF NOT EXISTS sgcc_suscripciones (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id                   UUID NOT NULL REFERENCES sgcc_centers(id) ON DELETE CASCADE,
  plan_key                    text NOT NULL,
  periodo                     periodo_suscripcion NOT NULL,
  precio_cop                  integer NOT NULL,
  estado                      estado_suscripcion NOT NULL DEFAULT 'EN_ESPERA',
  wompi_customer_email        text,
  wompi_payment_source_id     text,
  wompi_payment_method_type   text,
  wompi_card_brand            text,
  wompi_card_last4            text,
  inicia_el                   timestamptz,
  proximo_cobro               timestamptz,
  cancelada_el                timestamptz,
  ultimo_intento_cobro        timestamptz,
  fallos_consecutivos         integer NOT NULL DEFAULT 0,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sgcc_suscripciones_center
  ON sgcc_suscripciones(center_id);
CREATE INDEX IF NOT EXISTS idx_sgcc_suscripciones_estado
  ON sgcc_suscripciones(estado);
CREATE INDEX IF NOT EXISTS idx_sgcc_suscripciones_proximo_cobro
  ON sgcc_suscripciones(proximo_cobro);

ALTER TABLE sgcc_suscripciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_suscripciones FORCE ROW LEVEL SECURITY;

-- 3) Transacciones de pago.
CREATE TABLE IF NOT EXISTS sgcc_transacciones_pago (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suscripcion_id        UUID REFERENCES sgcc_suscripciones(id) ON DELETE SET NULL,
  center_id             UUID NOT NULL REFERENCES sgcc_centers(id) ON DELETE CASCADE,
  wompi_transaction_id  text UNIQUE,
  reference             text NOT NULL UNIQUE,
  monto_cop             integer NOT NULL,
  moneda                text NOT NULL DEFAULT 'COP',
  estado                estado_transaccion NOT NULL DEFAULT 'PENDIENTE',
  metodo_pago           text,
  tipo                  tipo_transaccion NOT NULL,
  detalle_error         text,
  pagada_en             timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sgcc_transacciones_center
  ON sgcc_transacciones_pago(center_id);
CREATE INDEX IF NOT EXISTS idx_sgcc_transacciones_suscripcion
  ON sgcc_transacciones_pago(suscripcion_id);
CREATE INDEX IF NOT EXISTS idx_sgcc_transacciones_estado
  ON sgcc_transacciones_pago(estado);

ALTER TABLE sgcc_transacciones_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_transacciones_pago FORCE ROW LEVEL SECURITY;

-- 4) Webhook log Wompi (idempotencia).
CREATE TABLE IF NOT EXISTS sgcc_webhook_eventos_wompi (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      text NOT NULL UNIQUE,
  tipo          text NOT NULL,
  payload       jsonb NOT NULL,
  procesado_en  timestamptz,
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sgcc_webhook_eventos_wompi ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_webhook_eventos_wompi FORCE ROW LEVEL SECURITY;

-- 5) Campos en centros para reflejar el plan activo.
ALTER TABLE sgcc_centers
  ADD COLUMN IF NOT EXISTS tipo_tier       text,
  ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz;

COMMENT ON COLUMN sgcc_centers.tipo_tier IS
  'Tier de plan activo: SIGECC_ACADEMICO | SIGECC_ESENCIAL | SIGECC_PROFESIONAL | SIGECC_NOTARIAL | SIGECC_ENTERPRISE. Validado en código.';
COMMENT ON COLUMN sgcc_centers.plan_expires_at IS
  'Fecha de expiración del plan pagado. Null = sin plan (gratis/sin contratar).';
