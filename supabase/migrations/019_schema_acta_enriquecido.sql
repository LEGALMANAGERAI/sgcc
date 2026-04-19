-- supabase/migrations/019_schema_acta_enriquecido.sql
-- Campos enriquecidos para actas: código interno del conciliador (ante MinJusticia),
-- modalidad de la audiencia (presencial/virtual/mixta) y plataforma virtual.
-- Además amplía los tipos de acta para cubrir acuerdos de apoyo.

-- ─── Código interno del conciliador (ID ante Ministerio de Justicia) ───────
ALTER TABLE sgcc_staff
  ADD COLUMN IF NOT EXISTS codigo_interno TEXT;

COMMENT ON COLUMN sgcc_staff.codigo_interno IS
  'Código interno del conciliador asignado por el centro (distinto de la tarjeta profesional)';

-- ─── Modalidad de audiencia ───────────────────────────────────────────────
ALTER TABLE sgcc_hearings
  ADD COLUMN IF NOT EXISTS modalidad TEXT NOT NULL DEFAULT 'presencial'
    CHECK (modalidad IN ('presencial', 'virtual', 'mixta'));

ALTER TABLE sgcc_hearings
  ADD COLUMN IF NOT EXISTS plataforma_virtual TEXT;

COMMENT ON COLUMN sgcc_hearings.modalidad IS
  'Modalidad de la audiencia: presencial, virtual o mixta (sala física conectada a Zoom)';

COMMENT ON COLUMN sgcc_hearings.plataforma_virtual IS
  'Plataforma utilizada si la audiencia es virtual o mixta (ej: Zoom, Meet, Teams)';

-- ─── Ampliar tipos de acta para cubrir acuerdos de apoyo ──────────────────
-- Los tipos actuales (acuerdo_total, acuerdo_parcial, no_acuerdo, inasistencia,
-- desistimiento, improcedente) sirven para conciliación e insolvencia.
-- Para acuerdos de apoyo se agregan: suscripcion_apoyo, no_suscripcion_apoyo.

ALTER TABLE sgcc_actas DROP CONSTRAINT IF EXISTS sgcc_actas_tipo_check;

ALTER TABLE sgcc_actas
  ADD CONSTRAINT sgcc_actas_tipo_check
  CHECK (tipo IN (
    'acuerdo_total',
    'acuerdo_parcial',
    'no_acuerdo',
    'inasistencia',
    'desistimiento',
    'improcedente',
    'suscripcion_apoyo',
    'no_suscripcion_apoyo'
  ));

-- ─── Índice para filtros comunes ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_hearings_modalidad ON sgcc_hearings(modalidad);
