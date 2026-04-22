-- ═══════════════════════════════════════════════════════════════════════════
-- 022_vigilancia_rama_judicial.sql
--
-- Extiende el módulo de vigilancia judicial para soportar búsqueda e
-- importación directa desde la API pública de la Rama Judicial
-- (consultaprocesos.ramajudicial.gov.co), copiando el esquema de Legados.
--
-- Cambios:
--   1. Nuevas columnas en sgcc_watched_processes con los datos que devuelve
--      la API de la Rama (idProceso, despacho, departamento, partes, etc.).
--   2. Nueva tabla sgcc_rama_searches para guardar búsquedas recurrentes.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Columnas de Rama Judicial en sgcc_watched_processes ───────────────
ALTER TABLE sgcc_watched_processes
  ADD COLUMN IF NOT EXISTS rama_id_proceso BIGINT,
  ADD COLUMN IF NOT EXISTS rama_ultima_actuacion_fecha TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS departamento TEXT,
  ADD COLUMN IF NOT EXISTS sujetos_procesales TEXT,
  ADD COLUMN IF NOT EXISTS fecha_proceso TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS es_privado BOOLEAN;

-- Un centro no debe vigilar dos veces el mismo idProceso de Rama Judicial.
-- (Cuando rama_id_proceso es NULL, el usuario registró el proceso a mano
-- y ese no entra en la restricción).
CREATE UNIQUE INDEX IF NOT EXISTS uq_watched_center_rama_id
  ON sgcc_watched_processes (center_id, rama_id_proceso)
  WHERE rama_id_proceso IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_watched_rama_id
  ON sgcc_watched_processes (rama_id_proceso)
  WHERE rama_id_proceso IS NOT NULL;

-- ─── 2. Tabla de búsquedas guardadas ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS sgcc_rama_searches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  center_id UUID NOT NULL REFERENCES sgcc_centers(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES sgcc_staff(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('nombre', 'radicado')),
  query TEXT NOT NULL,
  resultados JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_resultados INTEGER NOT NULL DEFAULT 0,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rama_searches_center
  ON sgcc_rama_searches (center_id, updated_at DESC);

-- ─── 3. RLS ───────────────────────────────────────────────────────────────
-- Usamos service role desde server-side (supabaseAdmin), por lo que RLS
-- se mantiene igual al patrón del resto del schema.
ALTER TABLE sgcc_rama_searches ENABLE ROW LEVEL SECURITY;

-- Policy: sólo lectura/escritura por service role (default denies anon).
DROP POLICY IF EXISTS "service_role_all_rama_searches" ON sgcc_rama_searches;
CREATE POLICY "service_role_all_rama_searches"
  ON sgcc_rama_searches
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
