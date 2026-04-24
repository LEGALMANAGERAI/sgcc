-- ═══════════════════════════════════════════════════════════════════════
-- DATAFIX OPCIONAL: normalizar documentos de acreedores ya capturados
-- ═══════════════════════════════════════════════════════════════════════
--
-- Propósito: limpiar typos comunes en el campo acreedor_documento (espacios,
-- puntos, guiones extra) para que la agrupación por documento en "Relación
-- definitiva" consolide todos los créditos del mismo acreedor.
--
-- Es SEGURO re-ejecutar. No toca documentos vacíos ni elimina datos.
--
-- OJO: este script no "adivina" typos (ej: falta del 8 en 60034313-7). Solo
-- normaliza formato. Los typos numéricos reales deben corregirse a mano.
--
-- Uso recomendado:
--   1) Ejecutar la sección REVISAR para ver duplicados potenciales.
--   2) Si los cambios se ven bien, ejecutar la sección APLICAR.

-- ─── REVISAR: ver documentos que se normalizarían ─────────────────────────
-- Devuelve acreencias cuyo documento cambiaría al normalizar.
SELECT
  id,
  case_id,
  acreedor_nombre,
  acreedor_documento AS documento_actual,
  UPPER(REGEXP_REPLACE(acreedor_documento, '[\s._\-]', '', 'g')) AS documento_normalizado
FROM sgcc_acreencias
WHERE acreedor_documento IS NOT NULL
  AND acreedor_documento <> UPPER(REGEXP_REPLACE(acreedor_documento, '[\s._\-]', '', 'g'))
ORDER BY case_id, acreedor_nombre;

-- ─── APLICAR: normalizar documentos (comentado por seguridad) ─────────────
-- Descomentar para ejecutar.
--
-- UPDATE sgcc_acreencias
-- SET acreedor_documento = UPPER(REGEXP_REPLACE(acreedor_documento, '[\s._\-]', '', 'g')),
--     updated_at = NOW()
-- WHERE acreedor_documento IS NOT NULL
--   AND acreedor_documento <> UPPER(REGEXP_REPLACE(acreedor_documento, '[\s._\-]', '', 'g'));
