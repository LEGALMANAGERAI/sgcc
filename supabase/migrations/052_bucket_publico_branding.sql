-- 052_bucket_publico_branding.sql
-- =============================================================================
-- Bucket PÚBLICO "sgcc-public" solo para branding (logo del centro).
--
-- sgcc-documents pasa a privado (053). El logo tiene que seguir público: lo
-- usan el widget embebido en webs externas, /centro/[codigo] (anónimo) y los
-- autos Word/PDF. Por eso se separa en su propio bucket.
--
-- CORRER ANTES de mergear el PR (la subida de logo ya apunta a este bucket).
-- Después: node scripts/migrar-logos-sgcc-public.mjs --apply (copia los logos
-- actuales y reescribe sgcc_centers.logo_url). Idempotente.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sgcc-public',
  'sgcc-public',
  TRUE,
  2097152, -- 2 MB, igual que /api/configuracion/logo
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
  SET public = TRUE,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
