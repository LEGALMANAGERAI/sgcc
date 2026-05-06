-- supabase/migrations/031_audiencias_modalidad.sql
-- Re-emisión de las columnas que agregaba 019_schema_acta_enriquecido.sql.
-- En el repo había dos archivos con prefijo 019 (portal_partes_solicitudes y
-- schema_acta_enriquecido) y este último nunca llegó a aplicarse en producción,
-- por eso PostgREST no encontraba "modalidad" en sgcc_hearings al programar
-- una audiencia desde la pestaña Acta del expediente (PR #94).
--
-- Todo es idempotente: si ya estaba aplicado en algún entorno, no rompe.

-- ─── Modalidad y plataforma virtual de la audiencia ──────────────────────────
ALTER TABLE sgcc_hearings
  ADD COLUMN IF NOT EXISTS modalidad TEXT NOT NULL DEFAULT 'presencial'
    CHECK (modalidad IN ('presencial', 'virtual', 'mixta'));

ALTER TABLE sgcc_hearings
  ADD COLUMN IF NOT EXISTS plataforma_virtual TEXT;

COMMENT ON COLUMN sgcc_hearings.modalidad IS
  'Modalidad de la audiencia: presencial, virtual o mixta (sala física conectada a Zoom)';

COMMENT ON COLUMN sgcc_hearings.plataforma_virtual IS
  'Plataforma utilizada si la audiencia es virtual o mixta (ej: Zoom, Meet, Teams)';

CREATE INDEX IF NOT EXISTS idx_hearings_modalidad ON sgcc_hearings(modalidad);

-- ─── Código interno del conciliador (ante MinJusticia) ───────────────────────
ALTER TABLE sgcc_staff
  ADD COLUMN IF NOT EXISTS codigo_interno TEXT;

COMMENT ON COLUMN sgcc_staff.codigo_interno IS
  'Código interno del conciliador asignado por el centro (distinto de la tarjeta profesional)';

-- ─── Tipos de acta extendidos para acuerdos de apoyo ─────────────────────────
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

-- ─── Recargar el schema cache de PostgREST ───────────────────────────────────
NOTIFY pgrst, 'reload schema';
