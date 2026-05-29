-- 042_radicado_configurable.sql
-- Formato de radicado configurable por centro + contador atómico.
--
-- Cada centro define una plantilla con tokens ({AAAA},{AA},{MM},{CENTRO},{SEC}),
-- el número de dígitos del consecutivo, cuándo se reinicia y un código corto.
-- El consecutivo se lleva en una tabla aparte con incremento atómico, así el
-- formato visible es independiente del conteo y se evitan colisiones por
-- concurrencia.

-- 1) Campos de configuración en el centro (aditivo, con defaults retrocompat).
ALTER TABLE sgcc_centers
  ADD COLUMN IF NOT EXISTS radicado_formato  text NOT NULL DEFAULT '{AAAA}-{SEC}',
  ADD COLUMN IF NOT EXISTS radicado_digitos  integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS radicado_reinicio text NOT NULL DEFAULT 'anual',
  ADD COLUMN IF NOT EXISTS radicado_codigo   text;

ALTER TABLE sgcc_centers DROP CONSTRAINT IF EXISTS sgcc_centers_radicado_reinicio_check;
ALTER TABLE sgcc_centers ADD CONSTRAINT sgcc_centers_radicado_reinicio_check
  CHECK (radicado_reinicio IN ('anual', 'nunca', 'mensual'));

-- 2) Contador por centro y periodo (periodo = año, año-mes, o 'global').
CREATE TABLE IF NOT EXISTS sgcc_radicado_secuencias (
  center_id UUID NOT NULL REFERENCES sgcc_centers(id) ON DELETE CASCADE,
  periodo   text NOT NULL,
  ultimo    integer NOT NULL DEFAULT 0,
  PRIMARY KEY (center_id, periodo)
);

-- RLS: igual que el resto de tablas sgcc_* (blindadas). Sin políticas: solo la
-- service_role (que bypassa RLS) puede leer/escribir; la anon/authenticated no.
ALTER TABLE sgcc_radicado_secuencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_radicado_secuencias FORCE ROW LEVEL SECURITY;

-- 3) Incremento atómico: upsert que devuelve el nuevo consecutivo.
CREATE OR REPLACE FUNCTION sgcc_next_radicado_seq(p_center uuid, p_periodo text)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_seq integer;
BEGIN
  INSERT INTO sgcc_radicado_secuencias (center_id, periodo, ultimo)
  VALUES (p_center, p_periodo, 1)
  ON CONFLICT (center_id, periodo)
    DO UPDATE SET ultimo = sgcc_radicado_secuencias.ultimo + 1
  RETURNING ultimo INTO v_seq;
  RETURN v_seq;
END;
$$;

-- 4) Sembrar el contador desde los radicados existentes (formato actual
--    'YYYY-NNNN'), por centro y año, para no reiniciar en 1 y colisionar.
INSERT INTO sgcc_radicado_secuencias (center_id, periodo, ultimo)
SELECT center_id,
       split_part(numero_radicado, '-', 1) AS periodo,
       MAX(NULLIF(split_part(numero_radicado, '-', 2), '')::int) AS ultimo
FROM sgcc_cases
WHERE numero_radicado ~ '^\d{4}-\d+$'
GROUP BY center_id, split_part(numero_radicado, '-', 1)
ON CONFLICT (center_id, periodo)
  DO UPDATE SET ultimo = GREATEST(sgcc_radicado_secuencias.ultimo, EXCLUDED.ultimo);

COMMENT ON COLUMN sgcc_centers.radicado_formato IS
  'Plantilla del radicado con tokens: {AAAA} {AA} {MM} {CENTRO} {SEC}. Ej: {AAAA}-{SEC}';
