-- 053_sgcc_documents_privado.sql
-- =============================================================================
-- sgcc-documents pasa a PRIVADO.
--
-- ⚠ CORRER SOLO AL FINAL, cuando:
--   1. el PR del proxy /api/archivo está desplegado en prod,
--   2. se probó abrir documentos (staff, parte y firmante externo), y
--   3. los logos ya se movieron a sgcc-public (052 + script).
--
-- Efecto: toda URL pública …/object/public/sgcc-documents/… deja de abrir
-- (incluidos links de correos ya enviados). La app sirve los archivos por
-- /api/archivo y /api/firmar/[token]/archivo con URLs firmadas cortas.
-- Sin policies en storage.objects para este bucket: solo service_role.
--
-- Reversa de emergencia: UPDATE storage.buckets SET public = TRUE WHERE id = 'sgcc-documents';
-- =============================================================================

UPDATE storage.buckets SET public = FALSE WHERE id = 'sgcc-documents';
