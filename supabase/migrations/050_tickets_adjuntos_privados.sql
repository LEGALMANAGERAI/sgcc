-- 050_tickets_adjuntos_privados.sql
-- =============================================================================
-- Adjuntos de tickets fuera del bucket público.
--
-- 1. Bucket PRIVADO "sgcc-tickets". La app sube y firma URLs con service_role
--    (bypassa RLS de storage), así que no se crean policies: anon/authenticated
--    no pueden leer ni listar nada. El acceso es solo por
--    GET /api/tickets/adjuntos/<id> → URL firmada de 60 s.
-- 2. Cierra el allow_all que 029 recreó en sgcc_ticket_adjuntos DESPUÉS del
--    blindaje 099 (la anon key podía leer/escribir la tabla). Mismo criterio
--    que 099: RLS ENABLE + FORCE, sin policies (deny-all por PostgREST).
-- 3. Límite de 5 adjuntos por ticket en BD, atómico: lock por ticket dentro
--    de la transacción del INSERT, así dos subidas concurrentes no pasan las
--    dos con count=4.
--
-- Idempotente. No mueve archivos: eso lo hace
-- scripts/migrar-adjuntos-tickets-privados.mjs DESPUÉS de desplegar el código.
-- =============================================================================

-- ─── 1. Bucket privado ───────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sgcc-tickets',
  'sgcc-tickets',
  FALSE,
  10485760, -- 10 MB, igual que la app
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = FALSE,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ─── 2. RLS de tickets y adjuntos ────────────────────────────────────────
DROP POLICY IF EXISTS "allow_all" ON sgcc_ticket_adjuntos;
DROP POLICY IF EXISTS "allow_all" ON sgcc_tickets;
ALTER TABLE sgcc_ticket_adjuntos ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_ticket_adjuntos FORCE ROW LEVEL SECURITY;
ALTER TABLE sgcc_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_tickets FORCE ROW LEVEL SECURITY;

-- ─── 3. Límite atómico de 5 adjuntos ─────────────────────────────────────
CREATE OR REPLACE FUNCTION sgcc_ticket_adjuntos_limite()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Serializa los INSERT del mismo ticket hasta el COMMIT; el COUNT siguiente
  -- ya ve las filas confirmadas por la transacción que tenía el lock.
  PERFORM pg_advisory_xact_lock(hashtext('sgcc_ticket_adjuntos:' || NEW.ticket_id::text));
  IF (SELECT COUNT(*) FROM sgcc_ticket_adjuntos WHERE ticket_id = NEW.ticket_id) >= 5 THEN
    -- El texto lo detecta src/lib/tickets/adjuntos-storage.ts
    RAISE EXCEPTION 'MAX_ADJUNTOS_TICKET';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sgcc_ticket_adjuntos_limite ON sgcc_ticket_adjuntos;
CREATE TRIGGER trg_sgcc_ticket_adjuntos_limite
  BEFORE INSERT ON sgcc_ticket_adjuntos
  FOR EACH ROW EXECUTE FUNCTION sgcc_ticket_adjuntos_limite();

COMMENT ON TABLE sgcc_ticket_adjuntos IS
  'Adjuntos de un ticket. Máx. 5 por ticket (trigger trg_sgcc_ticket_adjuntos_limite). '
  'Bucket PRIVADO sgcc-tickets; url = /api/tickets/adjuntos/<id> (proxy autenticado).';
