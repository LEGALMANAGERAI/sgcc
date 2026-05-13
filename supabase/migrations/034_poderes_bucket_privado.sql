-- ─── 034: bucket "poderes" privado + datafix poder_url a path ──────────────
-- Antes: bucket público; sgcc_case_attorneys.poder_url guardaba la URL pública
--   completa. Cualquiera con el link podía ver el PDF. Esto incumple Habeas
--   Data (Ley 1581) porque los poderes contienen datos personales sensibles.
--
-- Después: bucket privado; poder_url guarda SOLO el path del archivo
--   (formato: "<caseId>/<caseAttorneyId>.pdf"). La aplicación genera signed
--   URLs temporales (TTL 1 hora) cada vez que un cliente autenticado pide ver
--   un poder. Sin auth, no hay acceso.

-- 1) Privado el bucket
UPDATE storage.buckets
SET public = false
WHERE id = 'poderes';

-- 2) Datafix: convertir URLs públicas existentes en paths.
--    Formato anterior: https://<ref>.supabase.co/storage/v1/object/public/poderes/<caseId>/<caseAttorneyId>.pdf
--    Formato nuevo:    <caseId>/<caseAttorneyId>.pdf
UPDATE sgcc_case_attorneys
SET poder_url = REGEXP_REPLACE(poder_url, '^.*/poderes/', '')
WHERE poder_url IS NOT NULL
  AND poder_url LIKE '%/poderes/%';

-- 3) Eliminar policy de lectura pública (no aplica a bucket privado).
--    Las nuevas lecturas pasan por signed URLs generadas server-side con
--    el service_role key, así que no necesitamos policy SELECT abierta.
DROP POLICY IF EXISTS "Poderes son públicos" ON storage.objects;

-- 4) Mantener policies de INSERT/UPDATE para que el cliente pueda subir
--    via signed upload URL. La firma valida la operación, así que la policy
--    solo necesita asegurar que va al bucket correcto.
--    (Estas ya existían en migración 012; las recreamos por idempotencia.)
DROP POLICY IF EXISTS "Upload poderes autenticado" ON storage.objects;
CREATE POLICY "Upload poderes autenticado"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'poderes');

DROP POLICY IF EXISTS "Update poderes autenticado" ON storage.objects;
CREATE POLICY "Update poderes autenticado"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'poderes');
