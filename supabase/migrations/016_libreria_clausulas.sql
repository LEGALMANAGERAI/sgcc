-- supabase/migrations/016_libreria_clausulas.sql
-- Librería de cláusulas reutilizables para minutas, actas, citaciones y oficios.
-- Las cláusulas globales (center_id IS NULL) son del sistema y no editables por centros.
-- Los centros pueden crear las propias o duplicar las globales para personalizar.

-- ─── Tabla ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sgcc_clausulas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  center_id UUID REFERENCES sgcc_centers(id) ON DELETE CASCADE,  -- NULL = global del sistema
  titulo TEXT NOT NULL,
  categoria TEXT NOT NULL
    CHECK (categoria IN (
      'preambulo',
      'identificacion_partes',
      'consideraciones',
      'obligacion_dar',
      'obligacion_hacer',
      'obligacion_no_hacer',
      'garantias',
      'clausula_penal',
      'confidencialidad',
      'domicilio_notificaciones',
      'desistimiento',
      'inasistencia',
      'cierre',
      'insolvencia_acuerdo_pago',
      'insolvencia_liquidacion',
      'apoyo_decision',
      'otro'
    )),
  tipo_tramite TEXT  -- NULL = aplica a cualquier trámite
    CHECK (tipo_tramite IS NULL OR tipo_tramite IN ('conciliacion', 'insolvencia', 'acuerdo_apoyo', 'arbitraje_ejecutivo')),
  resultado_aplicable TEXT[],  -- array de resultados: NULL = cualquiera
  contenido TEXT NOT NULL,  -- texto con tokens {{variable}}
  variables_requeridas JSONB NOT NULL DEFAULT '[]'::jsonb,  -- extraídas del contenido
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  es_default BOOLEAN NOT NULL DEFAULT FALSE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES sgcc_staff(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Índices ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_clausulas_center ON sgcc_clausulas(center_id);
CREATE INDEX IF NOT EXISTS idx_clausulas_categoria ON sgcc_clausulas(categoria);
CREATE INDEX IF NOT EXISTS idx_clausulas_tipo_tramite ON sgcc_clausulas(tipo_tramite);
CREATE INDEX IF NOT EXISTS idx_clausulas_tags ON sgcc_clausulas USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_clausulas_activo ON sgcc_clausulas(activo) WHERE activo = TRUE;
CREATE INDEX IF NOT EXISTS idx_clausulas_global ON sgcc_clausulas(center_id) WHERE center_id IS NULL;

-- ─── RLS ───────────────────────────────────────────────────────────────────
-- Mismo patrón que demás tablas: allow_all, el control se hace en la capa de app
-- (el código usa supabaseAdmin que bypassa RLS y filtra por center_id).
ALTER TABLE sgcc_clausulas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON sgcc_clausulas FOR ALL USING (TRUE);

-- ─── Trigger updated_at ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_clausulas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_clausulas_updated_at
  BEFORE UPDATE ON sgcc_clausulas
  FOR EACH ROW
  EXECUTE FUNCTION update_clausulas_updated_at();
