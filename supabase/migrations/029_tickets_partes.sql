-- supabase/migrations/029_tickets_partes.sql
-- Habilitar tickets abiertos por partes (convocantes/convocados/apoderados).
-- Extiende sgcc_tickets con solicitante_party_id (XOR vs solicitante_staff_id),
-- amplía la categoría con 'consulta_parte' y agrega tabla sgcc_ticket_adjuntos
-- para múltiples archivos por ticket.

-- ─── 1. Extender sgcc_tickets ─────────────────────────────────────────────

ALTER TABLE sgcc_tickets
  ADD COLUMN IF NOT EXISTS solicitante_party_id UUID REFERENCES sgcc_parties(id) ON DELETE SET NULL;

-- Eliminar el check viejo (si existe) antes de recrear
ALTER TABLE sgcc_tickets DROP CONSTRAINT IF EXISTS sgcc_tickets_solicitante_check;

-- XOR: exactamente una de las dos FKs debe estar set
ALTER TABLE sgcc_tickets ADD CONSTRAINT sgcc_tickets_solicitante_check CHECK (
  (solicitante_staff_id IS NOT NULL AND solicitante_party_id IS NULL) OR
  (solicitante_staff_id IS NULL AND solicitante_party_id IS NOT NULL)
);

-- Ampliar el CHECK de categoría para aceptar 'consulta_parte'
ALTER TABLE sgcc_tickets DROP CONSTRAINT IF EXISTS sgcc_tickets_categoria_check;
ALTER TABLE sgcc_tickets ADD CONSTRAINT sgcc_tickets_categoria_check
  CHECK (categoria IN ('soporte', 'administrativo', 'operativo', 'consulta_parte'));

-- Índice para "mis tickets" del portal de partes
CREATE INDEX IF NOT EXISTS idx_tickets_solicitante_party
  ON sgcc_tickets(solicitante_party_id);

-- ─── 2. Tabla sgcc_ticket_adjuntos ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sgcc_ticket_adjuntos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       UUID NOT NULL REFERENCES sgcc_tickets(id) ON DELETE CASCADE,
  nombre_archivo  TEXT NOT NULL,
  storage_path    TEXT NOT NULL,
  url             TEXT NOT NULL,
  mime_type       TEXT,
  tamano_bytes    INTEGER,
  subido_por_party UUID REFERENCES sgcc_parties(id) ON DELETE SET NULL,
  subido_por_staff UUID REFERENCES sgcc_staff(id)  ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sgcc_ticket_adjuntos_uploader_check CHECK (
    (subido_por_party IS NOT NULL AND subido_por_staff IS NULL) OR
    (subido_por_party IS NULL AND subido_por_staff IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_ticket_adjuntos_ticket
  ON sgcc_ticket_adjuntos(ticket_id);

ALTER TABLE sgcc_ticket_adjuntos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all" ON sgcc_ticket_adjuntos;
CREATE POLICY "allow_all" ON sgcc_ticket_adjuntos FOR ALL USING (TRUE);

COMMENT ON COLUMN sgcc_tickets.solicitante_party_id IS
  'FK a sgcc_parties cuando el ticket lo abrió una parte (no staff). XOR con solicitante_staff_id.';
COMMENT ON TABLE sgcc_ticket_adjuntos IS
  'Adjuntos de un ticket. Hasta 5 por ticket (validado en app). Bucket: sgcc-documents.';
