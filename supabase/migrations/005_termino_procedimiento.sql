-- 005: Término del procedimiento (60 días hábiles + prórroga 30 días)
ALTER TABLE sgcc_cases ADD COLUMN IF NOT EXISTS fecha_inicio_termino DATE;
ALTER TABLE sgcc_cases ADD COLUMN IF NOT EXISTS dias_termino INTEGER NOT NULL DEFAULT 60;
ALTER TABLE sgcc_cases ADD COLUMN IF NOT EXISTS prorrogado BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN sgcc_cases.fecha_inicio_termino IS 'Fecha desde la cual se cuentan los días hábiles del procedimiento';
COMMENT ON COLUMN sgcc_cases.dias_termino IS 'Número de días hábiles para adelantar el procedimiento (default 60, 90 si prorrogado)';
COMMENT ON COLUMN sgcc_cases.prorrogado IS 'Si el operador prorrogó el término por 30 días adicionales';
