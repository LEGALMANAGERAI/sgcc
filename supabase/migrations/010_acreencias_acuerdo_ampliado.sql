-- ═══════════════════════════════════════════════════════════════════════
-- Ampliación: clases de crédito, mora, tabla de acuerdo de pagos
-- ═══════════════════════════════════════════════════════════════════════

-- Campos adicionales en acreencias
ALTER TABLE sgcc_acreencias ADD COLUMN IF NOT EXISTS clase_credito TEXT DEFAULT 'quinta'
  CHECK (clase_credito IN ('primera', 'segunda', 'tercera', 'cuarta', 'quinta'));
ALTER TABLE sgcc_acreencias ADD COLUMN IF NOT EXISTS dias_mora INTEGER DEFAULT 0;
ALTER TABLE sgcc_acreencias ADD COLUMN IF NOT EXISTS mora_90_dias BOOLEAN DEFAULT FALSE;

-- Tabla de acuerdo de pagos (se genera cuando la propuesta es aprobada)
CREATE TABLE IF NOT EXISTS sgcc_acuerdo_pago (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES sgcc_cases(id) ON DELETE CASCADE,
  center_id UUID NOT NULL REFERENCES sgcc_centers(id) ON DELETE CASCADE,
  propuesta_id UUID REFERENCES sgcc_propuesta_pago(id),

  -- Parámetros globales del acuerdo
  capital_total NUMERIC(18,2) DEFAULT 0,
  tasa_interes_anual NUMERIC(8,4) DEFAULT 0,    -- Ej: 0.12 = 12%
  plazo_meses INTEGER NOT NULL DEFAULT 12,
  periodo_gracia_meses INTEGER DEFAULT 0,
  fecha_inicio_pago DATE,
  valor_cuota_global NUMERIC(18,2) DEFAULT 0,    -- Calculado con PMT

  notas TEXT,  -- Ej: "Se condonan los intereses causados..."
  porcentaje_aprobacion NUMERIC(8,4) DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sgcc_acuerdo_case ON sgcc_acuerdo_pago(case_id);

-- Detalle del acuerdo por acreedor
CREATE TABLE IF NOT EXISTS sgcc_acuerdo_detalle (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  acuerdo_id UUID NOT NULL REFERENCES sgcc_acuerdo_pago(id) ON DELETE CASCADE,
  acreencia_id UUID NOT NULL REFERENCES sgcc_acreencias(id) ON DELETE CASCADE,

  capital NUMERIC(18,2) DEFAULT 0,
  intereses_causados NUMERIC(18,2) DEFAULT 0,
  intereses_futuros NUMERIC(18,2) DEFAULT 0,
  descuentos_capital NUMERIC(18,2) DEFAULT 0,
  total_a_pagar NUMERIC(18,2) DEFAULT 0,        -- capital + int_futuros - descuentos
  valor_cuota NUMERIC(18,2) DEFAULT 0,           -- proporcional a su % de voto
  derecho_voto NUMERIC(8,4) DEFAULT 0,
  sentido_voto TEXT CHECK (sentido_voto IN ('positivo', 'negativo', 'abstiene')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sgcc_acuerdo_detalle_acuerdo ON sgcc_acuerdo_detalle(acuerdo_id);

-- RLS
ALTER TABLE sgcc_acuerdo_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_acuerdo_detalle ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON sgcc_acuerdo_pago FOR ALL USING (TRUE);
CREATE POLICY "allow_all" ON sgcc_acuerdo_detalle FOR ALL USING (TRUE);
