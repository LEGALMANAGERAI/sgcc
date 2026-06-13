-- ============================================================
-- 046 · Tracking de autos generados (motor de autos de insolvencia).
--
-- Permite: (1) sugerir el siguiente CONSECUTIVO del auto por caso, y
-- (2) HEREDAR los datos de Zoom (URL/ID/código/clave) de autos anteriores
-- para no re-digitarlos en cada audiencia.
--
-- Migración ADITIVA e idempotente. No modifica datos existentes. Cada vez que
-- se genera un auto (Word/PDF) o se envía a firma se inserta una fila aquí.
-- ============================================================

CREATE TABLE IF NOT EXISTS sgcc_autos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  center_id UUID NOT NULL REFERENCES sgcc_centers(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES sgcc_cases(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,                -- 'suspension' | 'primera_audiencia' | ...
  numero_auto TEXT,                  -- consecutivo que asignó el operador
  zoom_url TEXT,
  zoom_id TEXT,
  zoom_codigo TEXT,
  zoom_clave TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_autos_case ON sgcc_autos(case_id, created_at DESC);

COMMENT ON TABLE sgcc_autos IS 'Autos de insolvencia generados; sirve para sugerir el consecutivo y heredar datos de Zoom entre audiencias.';

-- RLS: la app accede solo con service role (que bypassa RLS). Sin políticas
-- permisivas, anon/authenticated quedan denegados (multi-tenant). No rompe la app.
ALTER TABLE sgcc_autos ENABLE ROW LEVEL SECURITY;
