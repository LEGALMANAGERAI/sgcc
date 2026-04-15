-- ═══ Aplicar migraciones 009 → 013 en orden ═══

-- ─── 009_acreencias_insolvencia.sql ─────────────────────────────────────────
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

-- ─── 010_acreencias_acuerdo_ampliado.sql ─────────────────────────────────────────
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

-- ─── 011_votacion_tokens.sql ─────────────────────────────────────────
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

-- ─── 012_bucket_poderes.sql ─────────────────────────────────────────
-- Crear bucket "poderes" para almacenar archivos PDF de poderes
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'poderes',
  'poderes',
  true,  -- public para permitir acceso directo vía URL
  10485760,  -- 10 MB
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf']::text[];

-- Policy para permitir lectura pública del bucket poderes
DROP POLICY IF EXISTS "Poderes son públicos" ON storage.objects;
CREATE POLICY "Poderes son públicos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'poderes');

-- Policy para permitir upload autenticado
DROP POLICY IF EXISTS "Upload poderes autenticado" ON storage.objects;
CREATE POLICY "Upload poderes autenticado"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'poderes');

-- Policy para permitir update
DROP POLICY IF EXISTS "Update poderes autenticado" ON storage.objects;
CREATE POLICY "Update poderes autenticado"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'poderes');

-- ─── 013_acreedor_tipo_persona.sql ─────────────────────────────────────────
-- ═══════════════════════════════════════════════════════════════════════
-- Tipo de persona del acreedor: natural (CC/CE) o jurídica (NIT)
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE sgcc_acreencias
  ADD COLUMN IF NOT EXISTS acreedor_tipo TEXT NOT NULL DEFAULT 'natural'
  CHECK (acreedor_tipo IN ('natural', 'juridica'));

COMMENT ON COLUMN sgcc_acreencias.acreedor_tipo IS
  'Tipo de persona del acreedor: natural (CC/CE) o juridica (NIT)';

