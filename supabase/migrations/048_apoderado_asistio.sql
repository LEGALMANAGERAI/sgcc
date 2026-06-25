-- 048_apoderado_asistio.sql
-- Asistencia independiente del APODERADO respecto a la de la PARTE.
--
-- Hasta ahora `sgcc_hearing_attendance.asistio` registraba solo si compareció la
-- PARTE. En conciliación/insolvencia es común que la parte no asista pero sí su
-- apoderado (con poder), o viceversa. Se agrega `apoderado_asistio` para marcarlo
-- por separado. NULL = sin registrar / no aplica (sin apoderado), TRUE/FALSE = asistió o no.

ALTER TABLE sgcc_hearing_attendance
  ADD COLUMN IF NOT EXISTS apoderado_asistio BOOLEAN;

COMMENT ON COLUMN sgcc_hearing_attendance.apoderado_asistio IS
  'Asistencia del apoderado a la audiencia, independiente de asistio (la parte). NULL = sin registrar/sin apoderado.';
