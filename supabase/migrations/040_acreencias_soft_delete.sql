-- 040_acreencias_soft_delete.sql
-- Soft-delete para acreencias: en vez de borrar físicamente la fila, se marca
-- con deleted_at. Permite "deshacer" (restaurar) un acreedor eliminado por error
-- y conservar el id, los votos y las propuestas vinculadas.
--
-- Migración aditiva: solo agrega una columna nullable + índice. No transforma
-- datos existentes (todas las filas quedan con deleted_at = NULL = activas).

ALTER TABLE sgcc_acreencias
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Índice parcial: la inmensa mayoría de consultas filtran "activas"
-- (deleted_at IS NULL). El índice acelera ese filtro por caso/centro.
CREATE INDEX IF NOT EXISTS idx_sgcc_acreencias_activas
  ON sgcc_acreencias (case_id, center_id)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN sgcc_acreencias.deleted_at IS
  'Marca de borrado lógico. NULL = activa; con fecha = eliminada (recuperable desde la papelera).';
