-- Crear bucket "poderes" para almacenar archivos PDF de poderes
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'poderes',
  'poderes',
  true,  -- public para permitir acceso directo vía URL
  10485760,  -- 10 MB
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf']::text[];

-- Policy para permitir lectura pública del bucket poderes
DROP POLICY IF EXISTS "Poderes son públicos" ON storage.objects;
CREATE POLICY "Poderes son públicos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'poderes');

-- Policy para permitir upload autenticado
DROP POLICY IF EXISTS "Upload poderes autenticado" ON storage.objects;
CREATE POLICY "Upload poderes autenticado"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'poderes');

-- Policy para permitir update
DROP POLICY IF EXISTS "Update poderes autenticado" ON storage.objects;
CREATE POLICY "Update poderes autenticado"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'poderes');
