-- supabase/migrations/023_payment_plan_versioning.sql
-- Versionado de la propuesta de pago post-radicación (insolvencia Ley 2445/2025).
-- Permite al deudor y su apoderado presentar ajustes a la propuesta durante el
-- trámite de conciliación (cuando el conciliador o los acreedores lo soliciten),
-- manteniendo el histórico completo para trazabilidad.

BEGIN;

-- ─── 1. Ampliar sgcc_case_payment_plan con versionado ──────────────────────
ALTER TABLE sgcc_case_payment_plan
  ADD COLUMN IF NOT EXISTS version              INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS estado               TEXT NOT NULL DEFAULT 'presentada'
    CHECK (estado IN ('borrador','presentada','sustituida','aceptada','archivada')),
  ADD COLUMN IF NOT EXISTS autor_party_id       UUID REFERENCES sgcc_parties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS motivo_ajuste        TEXT,
  ADD COLUMN IF NOT EXISTS version_anterior_id  UUID REFERENCES sgcc_case_payment_plan(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS presentada_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS snapshot_json        JSONB;

-- La UNIQUE original (case_id, clase_prelacion) ya no aplica con versionado.
-- Ahora cada versión puede tener múltiples filas (una por clase) y varias
-- versiones coexisten. Se remueve la constraint si existe y se agrega
-- una parcial que garantiza una sola versión "presentada" vigente por caso+clase.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'sgcc_case_payment_plan'::regclass
      AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE sgcc_case_payment_plan DROP CONSTRAINT %I', r.conname);
  END LOOP;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_payment_plan_vigente
  ON sgcc_case_payment_plan(case_id, clase_prelacion)
  WHERE estado = 'presentada';

CREATE INDEX IF NOT EXISTS idx_payment_plan_case_version
  ON sgcc_case_payment_plan(case_id, version);

CREATE INDEX IF NOT EXISTS idx_payment_plan_version_anterior
  ON sgcc_case_payment_plan(version_anterior_id)
  WHERE version_anterior_id IS NOT NULL;

-- Trigger para mantener updated_at en sync al modificar borradores.
CREATE OR REPLACE FUNCTION fn_payment_plan_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payment_plan_touch_updated_at ON sgcc_case_payment_plan;
CREATE TRIGGER trg_payment_plan_touch_updated_at
  BEFORE UPDATE ON sgcc_case_payment_plan
  FOR EACH ROW EXECUTE FUNCTION fn_payment_plan_touch_updated_at();

-- ─── 2. Ampliar etapas de timeline para propuesta ──────────────────────────
-- La etapa 'propuesta' permite registrar presentación de nuevas versiones sin
-- ensuciar 'solicitud' ni 'audiencia'. Se regenera la CHECK porque Postgres
-- no permite ALTER directo de CHECK constraints en versiones antiguas.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'sgcc_case_timeline'::regclass
      AND contype = 'c'
      AND conname LIKE '%etapa%'
  LOOP
    EXECUTE format('ALTER TABLE sgcc_case_timeline DROP CONSTRAINT %I', r.conname);
  END LOOP;
END$$;

ALTER TABLE sgcc_case_timeline
  ADD CONSTRAINT sgcc_case_timeline_etapa_check
  CHECK (etapa IN ('solicitud','admision','propuesta','citacion','audiencia','acta','archivo'));

-- ─── 3. Función para sustituir la versión vigente al presentar una nueva ──
-- Al marcar una versión como 'presentada', se marca la anterior como 'sustituida'
-- automáticamente (por clase). Atómica.
CREATE OR REPLACE FUNCTION fn_presentar_propuesta_version(
  p_case_id UUID,
  p_version INT
) RETURNS VOID AS $$
BEGIN
  -- Marcar como sustituidas todas las vigentes de clases que estén en la nueva versión
  UPDATE sgcc_case_payment_plan
     SET estado = 'sustituida'
   WHERE case_id = p_case_id
     AND estado = 'presentada'
     AND version <> p_version
     AND clase_prelacion IN (
       SELECT clase_prelacion
         FROM sgcc_case_payment_plan
        WHERE case_id = p_case_id AND version = p_version
     );

  -- Promover la nueva versión a 'presentada'
  UPDATE sgcc_case_payment_plan
     SET estado = 'presentada',
         presentada_at = NOW()
   WHERE case_id = p_case_id
     AND version = p_version
     AND estado = 'borrador';
END;
$$ LANGUAGE plpgsql;

COMMIT;
