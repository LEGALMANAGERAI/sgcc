-- ═══════════════════════════════════════════════════════════════════════
-- 038: archivos de plantillas / formatos propios por centro
-- ═══════════════════════════════════════════════════════════════════════
--
-- Cada centro sube sus propios formatos (Word, PDF, etc.) en /plantillas/archivos.
-- El staff los sube; cualquier usuario del centro los puede descargar.
-- Path en bucket sgcc-documents: plantillas/<center_id>/<uuid>.<ext>

CREATE TABLE IF NOT EXISTS sgcc_template_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES sgcc_centers(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  tamano_bytes INTEGER NOT NULL,
  subido_por_staff UUID REFERENCES sgcc_staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sgcc_template_files_center
  ON sgcc_template_files(center_id);

-- RLS: igual que el resto de tablas sgcc_* (blindaje migración 099).
-- Sin policies abiertas — los endpoints usan el service_role key que
-- bypassa RLS. Anon/authenticated quedan en deny-by-default.
ALTER TABLE sgcc_template_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_template_files FORCE ROW LEVEL SECURITY;
