-- supabase/migrations/018_tickets.sql
-- Sistema de tickets / solicitudes internas del centro de conciliación.
-- Permite al staff registrar solicitudes de soporte, administrativas u operativas,
-- asignarlas a otro staff y dejar respuesta/seguimiento. Opcionalmente puede
-- enlazarse a un expediente (case_id) cuando el ticket se refiere a un caso.

-- ─── Tabla ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sgcc_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  center_id UUID NOT NULL REFERENCES sgcc_centers(id) ON DELETE CASCADE,
  case_id UUID REFERENCES sgcc_cases(id) ON DELETE SET NULL,

  titulo TEXT NOT NULL,
  descripcion TEXT,

  categoria TEXT NOT NULL DEFAULT 'soporte'
    CHECK (categoria IN ('soporte', 'administrativo', 'operativo')),

  prioridad TEXT NOT NULL DEFAULT 'Normal'
    CHECK (prioridad IN ('Normal', 'Media', 'Alta')),

  estado TEXT NOT NULL DEFAULT 'Pendiente'
    CHECK (estado IN ('Pendiente', 'EnRevision', 'Respondido', 'Cerrado')),

  solicitante_staff_id UUID REFERENCES sgcc_staff(id) ON DELETE SET NULL,
  asignado_staff_id UUID REFERENCES sgcc_staff(id) ON DELETE SET NULL,

  respuesta TEXT,
  respondido_por UUID REFERENCES sgcc_staff(id) ON DELETE SET NULL,
  respondido_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Índices ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tickets_center ON sgcc_tickets(center_id);
CREATE INDEX IF NOT EXISTS idx_tickets_case ON sgcc_tickets(case_id);
CREATE INDEX IF NOT EXISTS idx_tickets_estado ON sgcc_tickets(estado);
CREATE INDEX IF NOT EXISTS idx_tickets_prioridad ON sgcc_tickets(prioridad);
CREATE INDEX IF NOT EXISTS idx_tickets_solicitante ON sgcc_tickets(solicitante_staff_id);
CREATE INDEX IF NOT EXISTS idx_tickets_asignado ON sgcc_tickets(asignado_staff_id);
CREATE INDEX IF NOT EXISTS idx_tickets_abiertos ON sgcc_tickets(center_id, estado)
  WHERE estado IN ('Pendiente', 'EnRevision');

-- ─── RLS ───────────────────────────────────────────────────────────────────
-- Mismo patrón que demás tablas: allow_all, el control se hace en la capa de app
-- (el código usa supabaseAdmin que bypassa RLS y filtra por center_id).
ALTER TABLE sgcc_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON sgcc_tickets FOR ALL USING (TRUE);

-- ─── Trigger updated_at ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_tickets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tickets_updated_at
  BEFORE UPDATE ON sgcc_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_tickets_updated_at();
