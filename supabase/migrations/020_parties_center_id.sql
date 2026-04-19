-- 020_parties_center_id.sql
-- Amarra cada parte a un centro: decisión de producto "una cuenta = un centro".
-- Se agrega como nullable para no romper registros existentes; el registro
-- nuevo (/registro/parte con código corto) la poblará obligatoriamente.

ALTER TABLE sgcc_parties
  ADD COLUMN IF NOT EXISTS center_id UUID REFERENCES sgcc_centers(id);

CREATE INDEX IF NOT EXISTS idx_parties_center ON sgcc_parties(center_id);

COMMENT ON COLUMN sgcc_parties.center_id IS
  'Centro al que pertenece la cuenta. Poblado desde código corto en /registro/parte. Nullable para compatibilidad con registros antiguos (invitados por staff, widget público).';
