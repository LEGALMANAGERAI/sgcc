-- ═══════════════════════════════════════════════════════════════════════
-- sgcc_attorneys: agregar columna updated_at
-- ═══════════════════════════════════════════════════════════════════════
--
-- Múltiples endpoints (/api/casos, /api/expediente/[id]/apoderados,
-- /api/admin/staff/fusionar, etc.) hacen UPDATE … SET updated_at = NOW()
-- sobre sgcc_attorneys, pero la columna no existía en el esquema original
-- (002_new_tables.sql). Resultado: los UPDATE/INSERT fallaban con
-- "Could not find the 'updated_at' column of 'sgcc_attorneys'", y los
-- apoderados nuevos no se podían crear.

ALTER TABLE sgcc_attorneys
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill: para filas existentes, igualar updated_at = created_at
UPDATE sgcc_attorneys
SET updated_at = created_at
WHERE updated_at IS NULL OR updated_at < created_at;
