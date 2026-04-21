-- supabase/migrations/020_acta_hechos.sql
-- Agrega campo "hechos" en sgcc_actas para soportar la estructura del acta
-- observada en Corprojusticia: HECHOS (pretensiones) como sección distinta
-- del acuerdo y las consideraciones.

ALTER TABLE sgcc_actas
  ADD COLUMN IF NOT EXISTS hechos TEXT;

COMMENT ON COLUMN sgcc_actas.hechos IS
  'Sección HECHOS del acta: pretensiones del convocante enumeradas (PRIMERO, SEGUNDO, ...). Distinto a consideraciones (analisis del conciliador)';
