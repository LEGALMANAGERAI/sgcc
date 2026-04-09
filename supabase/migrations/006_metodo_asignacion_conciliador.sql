-- 006: Método de asignación de conciliador por centro
ALTER TABLE sgcc_centers ADD COLUMN IF NOT EXISTS metodo_asignacion TEXT NOT NULL DEFAULT 'manual'
  CHECK (metodo_asignacion IN ('manual', 'aleatorio', 'orden_lista'));

ALTER TABLE sgcc_staff ADD COLUMN IF NOT EXISTS orden_lista INTEGER;
ALTER TABLE sgcc_staff ADD COLUMN IF NOT EXISTS ultima_asignacion TIMESTAMPTZ;

COMMENT ON COLUMN sgcc_centers.metodo_asignacion IS 'Método para asignar conciliador: manual, aleatorio (sorteo), orden_lista (round-robin)';
COMMENT ON COLUMN sgcc_staff.orden_lista IS 'Posición en la lista de asignación por orden';
COMMENT ON COLUMN sgcc_staff.ultima_asignacion IS 'Fecha de última asignación de caso (para round-robin)';
