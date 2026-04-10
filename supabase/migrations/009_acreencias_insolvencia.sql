-- ═══════════════════════════════════════════════════════════════════════
-- Herramienta de Acreencias para Insolvencia (Ley 1564/2012)
-- ═══════════════════════════════════════════════════════════════════════

-- Relación de acreencias por caso de insolvencia
-- Cada fila = un acreedor con sus montos en 3 columnas: solicitud, acreedor, conciliado
CREATE TABLE IF NOT EXISTS sgcc_acreencias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES sgcc_cases(id) ON DELETE CASCADE,
  center_id UUID NOT NULL REFERENCES sgcc_centers(id) ON DELETE CASCADE,
  party_id UUID REFERENCES sgcc_parties(id),  -- acreedor (convocado)

  -- Nombre del acreedor (por si no está como parte registrada)
  acreedor_nombre TEXT NOT NULL,
  acreedor_documento TEXT,

  -- Valores reportados por el DEUDOR (solicitud)
  sol_capital NUMERIC(18,2) DEFAULT 0,
  sol_intereses_corrientes NUMERIC(18,2) DEFAULT 0,
  sol_intereses_moratorios NUMERIC(18,2) DEFAULT 0,
  sol_seguros NUMERIC(18,2) DEFAULT 0,
  sol_otros NUMERIC(18,2) DEFAULT 0,

  -- Valores reportados por el ACREEDOR
  acr_capital NUMERIC(18,2) DEFAULT 0,
  acr_intereses_corrientes NUMERIC(18,2) DEFAULT 0,
  acr_intereses_moratorios NUMERIC(18,2) DEFAULT 0,
  acr_seguros NUMERIC(18,2) DEFAULT 0,
  acr_otros NUMERIC(18,2) DEFAULT 0,

  -- Relación definitiva de acreencias (valores conciliados)
  con_capital NUMERIC(18,2) DEFAULT 0,
  con_intereses_corrientes NUMERIC(18,2) DEFAULT 0,
  con_intereses_moratorios NUMERIC(18,2) DEFAULT 0,
  con_seguros NUMERIC(18,2) DEFAULT 0,
  con_otros NUMERIC(18,2) DEFAULT 0,
  fecha_conciliacion DATE,

  -- Porcentaje de derecho de voto (calculado: con_capital / sum(con_capital))
  porcentaje_voto NUMERIC(8,4) DEFAULT 0,

  -- Pequeño acreedor: true si sumados no superan 5% del total
  es_pequeno_acreedor BOOLEAN DEFAULT FALSE,

  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sgcc_acreencias_case ON sgcc_acreencias(case_id);
CREATE INDEX idx_sgcc_acreencias_center ON sgcc_acreencias(center_id);

-- Propuesta de pago para votación
CREATE TABLE IF NOT EXISTS sgcc_propuesta_pago (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES sgcc_cases(id) ON DELETE CASCADE,
  center_id UUID NOT NULL REFERENCES sgcc_centers(id) ON DELETE CASCADE,

  titulo TEXT NOT NULL,
  descripcion TEXT NOT NULL,  -- Texto completo de la propuesta
  plazo_meses INTEGER,        -- Plazo propuesto en meses
  tasa_interes TEXT,           -- Ej: "DTF + 2%", "0%", "IPC"
  periodo_gracia_meses INTEGER DEFAULT 0,
  notas TEXT,

  estado TEXT NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador', 'socializada', 'en_votacion', 'aprobada', 'rechazada')),

  fecha_socializacion TIMESTAMPTZ,
  fecha_votacion TIMESTAMPTZ,
  resultado_aprobada BOOLEAN,
  votos_positivos INTEGER DEFAULT 0,
  votos_negativos INTEGER DEFAULT 0,
  porcentaje_aprobacion NUMERIC(8,4) DEFAULT 0,
  acreedores_positivos INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sgcc_propuesta_case ON sgcc_propuesta_pago(case_id);

-- Registro de votos por acreedor
CREATE TABLE IF NOT EXISTS sgcc_votacion_insolvencia (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  propuesta_id UUID NOT NULL REFERENCES sgcc_propuesta_pago(id) ON DELETE CASCADE,
  acreencia_id UUID NOT NULL REFERENCES sgcc_acreencias(id) ON DELETE CASCADE,

  voto TEXT NOT NULL CHECK (voto IN ('positivo', 'negativo', 'abstiene')),
  porcentaje_voto NUMERIC(8,4) NOT NULL,  -- % de derecho de voto al momento de votar
  observaciones TEXT,

  registrado_por UUID REFERENCES sgcc_staff(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Un voto por acreedor por propuesta
  UNIQUE(propuesta_id, acreencia_id)
);

CREATE INDEX idx_sgcc_votacion_propuesta ON sgcc_votacion_insolvencia(propuesta_id);

-- RLS
ALTER TABLE sgcc_acreencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_propuesta_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_votacion_insolvencia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON sgcc_acreencias FOR ALL USING (TRUE);
CREATE POLICY "allow_all" ON sgcc_propuesta_pago FOR ALL USING (TRUE);
CREATE POLICY "allow_all" ON sgcc_votacion_insolvencia FOR ALL USING (TRUE);
