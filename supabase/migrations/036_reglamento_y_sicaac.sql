-- ═══════════════════════════════════════════════════════════════════════
-- 036: Reglamento interno del centro + Módulo SICAAC
-- ═══════════════════════════════════════════════════════════════════════

-- ─── Reglamento interno del centro ─────────────────────────────────────
-- Un solo archivo vigente por centro. Reemplazo simple, sin versionado.
-- Path en bucket sgcc-documents: reglamentos/<center_id>/<uuid>.pdf
ALTER TABLE sgcc_centers
  ADD COLUMN IF NOT EXISTS reglamento_url TEXT,
  ADD COLUMN IF NOT EXISTS reglamento_nombre TEXT,
  ADD COLUMN IF NOT EXISTS reglamento_subido_at TIMESTAMPTZ;

-- ─── Módulo SICAAC ─────────────────────────────────────────────────────
-- Control manual del registro de actas/constancias en el portal SICAAC
-- (Sistema Nacional de Información de la Conciliación). El usuario sube
-- por fuera y luego marca aquí "Registrada" capturando número y fecha.
ALTER TABLE sgcc_actas
  ADD COLUMN IF NOT EXISTS sicaac_estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (sicaac_estado IN ('pendiente', 'registrada')),
  ADD COLUMN IF NOT EXISTS sicaac_numero_registro TEXT,
  ADD COLUMN IF NOT EXISTS sicaac_fecha_registro DATE;

CREATE INDEX IF NOT EXISTS idx_sgcc_actas_sicaac_estado
  ON sgcc_actas(sicaac_estado);
