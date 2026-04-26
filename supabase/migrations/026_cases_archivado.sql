-- ═══════════════════════════════════════════════════════════════════════
-- sgcc_cases: soft delete con auditoría
-- ═══════════════════════════════════════════════════════════════════════
--
-- El admin del centro puede "eliminar" expedientes desde la UI, pero en BD
-- se hace soft delete (no se borran filas). Las queries de listado y de
-- detalle filtran archivado_at IS NULL. La restauración se hace vía SQL
-- por los desarrolladores cuando el admin la solicita.

ALTER TABLE sgcc_cases
  ADD COLUMN IF NOT EXISTS archivado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archivado_por UUID REFERENCES sgcc_staff(id),
  ADD COLUMN IF NOT EXISTS motivo_archivado TEXT;

-- Índice parcial para acelerar filtros "WHERE archivado_at IS NULL"
CREATE INDEX IF NOT EXISTS idx_sgcc_cases_no_archivados
  ON sgcc_cases(center_id)
  WHERE archivado_at IS NULL;

-- Vista para que los devs puedan ver rápido los archivados pendientes de revisión
CREATE OR REPLACE VIEW sgcc_cases_archivados AS
SELECT
  c.id,
  c.numero_radicado,
  c.center_id,
  c.archivado_at,
  c.archivado_por,
  s.nombre AS archivado_por_nombre,
  s.email AS archivado_por_email,
  c.motivo_archivado
FROM sgcc_cases c
LEFT JOIN sgcc_staff s ON s.id = c.archivado_por
WHERE c.archivado_at IS NOT NULL
ORDER BY c.archivado_at DESC;
