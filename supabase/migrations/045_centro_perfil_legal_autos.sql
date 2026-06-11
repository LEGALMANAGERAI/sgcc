-- ============================================================
-- 045 · Perfil legal del centro para el motor de autos de insolvencia.
--
-- Migración ADITIVA e idempotente. Agrega columnas opcionales (nullable o con
-- default) a sgcc_centers y sgcc_staff con los datos legales que los autos de
-- insolvencia necesitan imprimir: resolución específica de insolvencia, código
-- ante MinJusticia, correos de radicación/secretaría, pie de página de vigilado
-- y datos del conciliador (cédula, ciudad de expedición, código de inscripción).
--
-- No modifica datos existentes ni elimina nada. Segura de re-ejecutar.
-- ============================================================

-- ─── Perfil legal del centro ────────────────────────────────────────────────
ALTER TABLE sgcc_centers ADD COLUMN IF NOT EXISTS resolucion_insolvencia TEXT;
ALTER TABLE sgcc_centers ADD COLUMN IF NOT EXISTS codigo_ministerio TEXT;
ALTER TABLE sgcc_centers ADD COLUMN IF NOT EXISTS email_radicacion TEXT;
ALTER TABLE sgcc_centers ADD COLUMN IF NOT EXISTS email_secretaria TEXT;
ALTER TABLE sgcc_centers ADD COLUMN IF NOT EXISTS pie_vigilado TEXT DEFAULT 'VIGILADO Ministerio de Justicia y del Derecho';

COMMENT ON COLUMN sgcc_centers.resolucion_insolvencia IS 'Resolución específica que habilita al centro para insolvencia de persona natural no comerciante (distinta de la resolución general de habilitación).';
COMMENT ON COLUMN sgcc_centers.codigo_ministerio IS 'Código de identificación del centro ante el Ministerio de Justicia y del Derecho.';
COMMENT ON COLUMN sgcc_centers.email_radicacion IS 'Correo electrónico oficial para la radicación de solicitudes y documentos.';
COMMENT ON COLUMN sgcc_centers.email_secretaria IS 'Correo electrónico de la secretaría de insolvencia del centro.';
COMMENT ON COLUMN sgcc_centers.pie_vigilado IS 'Texto de pie de página que indica la entidad de vigilancia, impreso en los autos.';

-- ─── Datos del operador/conciliador para los autos ──────────────────────────
ALTER TABLE sgcc_staff ADD COLUMN IF NOT EXISTS cedula TEXT;
ALTER TABLE sgcc_staff ADD COLUMN IF NOT EXISTS ciudad_cedula TEXT;
ALTER TABLE sgcc_staff ADD COLUMN IF NOT EXISTS codigo_inscripcion TEXT;

COMMENT ON COLUMN sgcc_staff.cedula IS 'Número de cédula del conciliador/operador, requerido para los autos de insolvencia.';
COMMENT ON COLUMN sgcc_staff.ciudad_cedula IS 'Ciudad de expedición de la cédula del conciliador.';
COMMENT ON COLUMN sgcc_staff.codigo_inscripcion IS 'Código de inscripción del conciliador en el centro / ante el Ministerio de Justicia.';
