-- ═══════════════════════════════════════════════════════════════════════
-- Orden manual de acreencias dentro de un caso (drag & drop)
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE sgcc_acreencias
  ADD COLUMN IF NOT EXISTS display_order INTEGER;

-- Backfill: asignar display_order según el orden actual (created_at, id)
WITH ordenadas AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY case_id ORDER BY created_at ASC, id ASC) AS rn
  FROM sgcc_acreencias
  WHERE display_order IS NULL
)
UPDATE sgcc_acreencias a
SET display_order = o.rn
FROM ordenadas o
WHERE a.id = o.id;

-- Índice compuesto para consultas ordenadas por caso
CREATE INDEX IF NOT EXISTS idx_sgcc_acreencias_case_order
  ON sgcc_acreencias(case_id, display_order);
