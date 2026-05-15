-- ═══════════════════════════════════════════════════════════════════════
-- sgcc_case_attorneys + sgcc_documents: agregar columna updated_at
-- ═══════════════════════════════════════════════════════════════════════
--
-- Múltiples endpoints (POST /api/casos, /api/expediente/[id]/documentos,
-- /api/expediente/[id]/acreencias/crear-con-convocado, etc.) hacen
-- INSERT/UPDATE … SET updated_at = NOW() sobre estas dos tablas, pero la
-- columna nunca se agregó en los esquemas originales (001/002). Resultado
-- en producción: "Could not find the 'updated_at' column of '<tabla>' in
-- the schema cache", reportado por el usuario al crear casos con
-- apoderados y al subir documentos al expediente.
--
-- Sigue exactamente el patrón de la migración 025 que ya hizo lo mismo
-- para sgcc_attorneys. Convierte updated_at en la convención estándar
-- para tablas mutables del proyecto.

ALTER TABLE sgcc_case_attorneys
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE sgcc_documents
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill: para filas existentes, igualar updated_at = created_at
UPDATE sgcc_case_attorneys
SET updated_at = created_at
WHERE updated_at IS NULL OR updated_at < created_at;

UPDATE sgcc_documents
SET updated_at = created_at
WHERE updated_at IS NULL OR updated_at < created_at;
