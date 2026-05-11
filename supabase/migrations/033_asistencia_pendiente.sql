-- ─── 033: estado "pendiente" para asistencia ──────────────────────────────
-- Permite distinguir 3 estados en sgcc_hearing_attendance.asistio:
--   NULL  → pendiente (aún no se marcó)
--   TRUE  → asistió
--   FALSE → no asistió
-- Antes era NOT NULL DEFAULT FALSE, lo que confundía pendiente con no asistió.

ALTER TABLE sgcc_hearing_attendance
  ALTER COLUMN asistio DROP NOT NULL,
  ALTER COLUMN asistio DROP DEFAULT;
