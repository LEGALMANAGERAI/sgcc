-- ═══════════════════════════════════════════════════════════════════════
-- 039: SICAAC a nivel de expediente + registros manuales
-- ═══════════════════════════════════════════════════════════════════════
--
-- El módulo SICAAC debe reflejar TODOS los expedientes creados en SIGECC
-- (para que coincida con lo que el centro registra en el portal SICAAC),
-- más permitir entradas manuales de actas/constancias hechas por fuera.

-- 1) Estado SICAAC por expediente. Todos los casos existentes quedan
--    'pendiente' por default, así aparecen de una en el módulo sin backfill.
ALTER TABLE sgcc_cases
  ADD COLUMN IF NOT EXISTS sicaac_estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (sicaac_estado IN ('pendiente', 'registrado')),
  ADD COLUMN IF NOT EXISTS sicaac_numero_registro TEXT,
  ADD COLUMN IF NOT EXISTS sicaac_fecha_registro DATE;

CREATE INDEX IF NOT EXISTS idx_sgcc_cases_sicaac_estado
  ON sgcc_cases(sicaac_estado);

-- 2) Registros manuales: actas/constancias/expedientes gestionados por
--    fuera de SIGECC que el centro igual debe llevar en su control SICAAC.
CREATE TABLE IF NOT EXISTS sgcc_sicaac_manual (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES sgcc_centers(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'acta'
    CHECK (tipo IN ('expediente', 'acta', 'constancia')),
  referencia TEXT NOT NULL,           -- radicado / número de acta / descripción
  fecha DATE,                          -- fecha del acta/expediente
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'registrado')),
  sicaac_numero_registro TEXT,
  sicaac_fecha_registro DATE,
  observaciones TEXT,
  creado_por_staff UUID REFERENCES sgcc_staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sgcc_sicaac_manual_center
  ON sgcc_sicaac_manual(center_id);

-- RLS: igual que el resto de tablas sgcc_* (blindaje 099). Sin policies
-- abiertas; los endpoints usan service role que bypassa RLS.
ALTER TABLE sgcc_sicaac_manual ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_sicaac_manual FORCE ROW LEVEL SECURITY;
