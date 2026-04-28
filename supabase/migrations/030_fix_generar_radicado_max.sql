-- supabase/migrations/030_fix_generar_radicado_max.sql
-- Fix bug "duplicate key value violates unique constraint sgcc_cases_center_id_numero_radicado_key".
--
-- Causa: la función generar_numero_radicado usaba COUNT(*) para calcular la
-- secuencia, lo cual choca cuando hay huecos (casos borrados): si existen
-- 2026-0001 y 2026-0003 (y 0002 fue borrado), COUNT=2 → genera 2026-0003
-- → colisión.
--
-- Fix: usar MAX(numero_radicado) parseado en lugar de COUNT(*). Esto resuelve
-- huecos por borrados. Para race conditions concurrentes la app hace
-- retry-on-conflict.

CREATE OR REPLACE FUNCTION generar_numero_radicado(p_center_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_year   TEXT := to_char(NOW(), 'YYYY');
  v_max    TEXT;
  v_seq    INT := 0;
BEGIN
  SELECT numero_radicado INTO v_max
    FROM sgcc_cases
    WHERE center_id = p_center_id
      AND numero_radicado LIKE v_year || '-%'
    ORDER BY numero_radicado DESC
    LIMIT 1;

  IF v_max IS NOT NULL THEN
    -- Extraer la parte numérica después del guion
    v_seq := COALESCE(NULLIF(split_part(v_max, '-', 2), '')::INT, 0);
  END IF;

  v_seq := v_seq + 1;
  RETURN v_year || '-' || lpad(v_seq::TEXT, 4, '0');
END;
$$;

COMMENT ON FUNCTION generar_numero_radicado(UUID) IS
  'Genera el siguiente número de radicado del centro para el año actual. Formato YYYY-NNNN. Usa MAX para evitar colisiones por huecos (casos borrados).';
