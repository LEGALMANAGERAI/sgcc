-- supabase/migrations/032_agenda_items.sql
-- Compromisos y asuntos pendientes en el módulo Agenda.
-- Permite al staff (admin, secretario, conciliador) registrar items propios
-- en su calendario, opcionalmente vinculados a un expediente.
--
-- Visibilidad (controlada en API, no en RLS):
--   - admin / secretario: ven TODOS los items del centro (los suyos, los de otros
--     admin/secretario y los de TODOS los conciliadores del centro).
--   - conciliador: ve SOLO los items que él creó (no ve los de otros conciliadores
--     ni los de admin/secretario).

-- ─── Tabla ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sgcc_agenda_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES sgcc_centers(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES sgcc_staff(id) ON DELETE CASCADE,

  tipo TEXT NOT NULL
    CHECK (tipo IN ('compromiso', 'pendiente')),

  titulo TEXT NOT NULL,
  descripcion TEXT,

  fecha DATE NOT NULL,
  hora_inicio TIME,           -- NULL = "todo el día" (típico para pendientes)
  duracion_min INT NOT NULL DEFAULT 60,

  caso_id UUID REFERENCES sgcc_cases(id) ON DELETE SET NULL,

  completado BOOLEAN NOT NULL DEFAULT FALSE,
  completado_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE sgcc_agenda_items IS
  'Compromisos y asuntos pendientes del staff en el módulo Agenda.';

COMMENT ON COLUMN sgcc_agenda_items.tipo IS
  'compromiso = evento con hora; pendiente = tarea/recordatorio (puede no tener hora).';

COMMENT ON COLUMN sgcc_agenda_items.hora_inicio IS
  'NULL cuando el item es "todo el día" (típico en pendientes).';

-- ─── Índices ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_agenda_items_center_fecha
  ON sgcc_agenda_items(center_id, fecha);

CREATE INDEX IF NOT EXISTS idx_agenda_items_staff_fecha
  ON sgcc_agenda_items(staff_id, fecha);

CREATE INDEX IF NOT EXISTS idx_agenda_items_caso
  ON sgcc_agenda_items(caso_id)
  WHERE caso_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agenda_items_pendientes_abiertos
  ON sgcc_agenda_items(center_id, fecha)
  WHERE completado = FALSE;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Patrón post-blindaje 099: ENABLE + FORCE RLS, sin policies → deny-all para
-- anon/authenticated. Las APIs usan supabaseAdmin (service_role) que bypassa
-- RLS y aplica el control de visibilidad por rol en código.
ALTER TABLE sgcc_agenda_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_agenda_items FORCE ROW LEVEL SECURITY;

-- ─── Trigger updated_at ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_agenda_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agenda_items_updated_at ON sgcc_agenda_items;
CREATE TRIGGER trg_agenda_items_updated_at
  BEFORE UPDATE ON sgcc_agenda_items
  FOR EACH ROW
  EXECUTE FUNCTION update_agenda_items_updated_at();

-- ─── Recargar el schema cache de PostgREST ───────────────────────────────────
NOTIFY pgrst, 'reload schema';
