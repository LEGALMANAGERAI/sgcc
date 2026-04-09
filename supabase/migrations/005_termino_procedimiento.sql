-- 005: Término del procedimiento (60 días hábiles)
ALTER TABLE sgcc_cases ADD COLUMN IF NOT EXISTS fecha_inicio_termino DATE;
ALTER TABLE sgcc_cases ADD COLUMN IF NOT EXISTS dias_termino INTEGER NOT NULL DEFAULT 60;

COMMENT ON COLUMN sgcc_cases.fecha_inicio_termino IS 'Fecha desde la cual se cuentan los días hábiles del procedimiento';
COMMENT ON COLUMN sgcc_cases.dias_termino IS 'Número de días hábiles para adelantar el procedimiento (default 60)';
