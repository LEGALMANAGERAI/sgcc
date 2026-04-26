-- ═══════════════════════════════════════════════════════════════════════
-- sgcc_centers: agregar columnas de colores de marca
-- ═══════════════════════════════════════════════════════════════════════
--
-- El tipo TypeScript SgccCenter incluía color_primario y color_secundario
-- pero la tabla no las tenía. Endpoints como /api/centro/[codigo] y la
-- landing pública /centro/[codigo] las consultan, fallando con
-- "column sgcc_centers.color_primario does not exist".

ALTER TABLE sgcc_centers
  ADD COLUMN IF NOT EXISTS color_primario TEXT,
  ADD COLUMN IF NOT EXISTS color_secundario TEXT;
