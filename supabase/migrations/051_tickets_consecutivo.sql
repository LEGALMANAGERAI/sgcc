-- 051_tickets_consecutivo.sql
-- =============================================================================
-- Número consecutivo legible para tickets, POR CENTRO y por categoría:
--   soporte → SOP-0001 · administrativo → ADM-0001 · operativo → OPE-0001
--   consulta_parte → CON-0001
-- (Mismo esquema que Legal Manager PR #354, pero por centro: cada centro es
-- un cliente distinto y no debe ver el volumen de los demás.)
--
-- El contador reutiliza el incremento atómico de radicados (042,
-- sgcc_next_radicado_seq) con periodo 'ticket:<PREFIJO>' — no choca con los
-- periodos de radicado ('2026', '2026-10', 'global'). Sin duplicados aunque
-- haya inserts concurrentes.
--
-- Aditiva e idempotente.
-- =============================================================================

ALTER TABLE sgcc_tickets ADD COLUMN IF NOT EXISTS numero TEXT;

CREATE OR REPLACE FUNCTION sgcc_ticket_siguiente_numero(p_center UUID, p_categoria TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_prefijo TEXT := CASE p_categoria
    WHEN 'administrativo' THEN 'ADM'
    WHEN 'operativo'      THEN 'OPE'
    WHEN 'consulta_parte' THEN 'CON'
    ELSE 'SOP'
  END;
  v_n INTEGER := sgcc_next_radicado_seq(p_center, 'ticket:' || v_prefijo);
BEGIN
  -- 4 dígitos mínimo; desde 10000 sigue creciendo (lpad truncaría).
  RETURN v_prefijo || '-' || CASE WHEN v_n < 10000 THEN lpad(v_n::TEXT, 4, '0') ELSE v_n::TEXT END;
END;
$$;

CREATE OR REPLACE FUNCTION sgcc_ticket_asignar_numero()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.numero IS NULL THEN
    NEW.numero := sgcc_ticket_siguiente_numero(NEW.center_id, NEW.categoria);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sgcc_ticket_numero ON sgcc_tickets;
CREATE TRIGGER trg_sgcc_ticket_numero
  BEFORE INSERT ON sgcc_tickets
  FOR EACH ROW EXECUTE FUNCTION sgcc_ticket_asignar_numero();

-- Numerar los tickets existentes por fecha de creación (solo los que no tienen).
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT id, center_id, categoria FROM sgcc_tickets
    WHERE numero IS NULL
    ORDER BY created_at, id
  LOOP
    UPDATE sgcc_tickets
       SET numero = sgcc_ticket_siguiente_numero(r.center_id, r.categoria)
     WHERE id = r.id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS sgcc_tickets_center_numero_key
  ON sgcc_tickets(center_id, numero);

COMMENT ON COLUMN sgcc_tickets.numero IS
  'Consecutivo por centro y categoría (SOP/ADM/OPE/CON-0001). Lo asigna trg_sgcc_ticket_numero; no se recalcula si cambia la categoría.';
