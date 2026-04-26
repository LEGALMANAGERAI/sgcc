-- 099_blindar_rls_global.sql
-- =============================================================================
-- BLINDAJE CRÍTICO de RLS en SGCC
--
-- Estado previo (auditado 2026-04-26):
--   - sgcc_centers, sgcc_staff, sgcc_parties tenían `FOR SELECT USING (TRUE)`
--     → cualquiera con la anon key podía leer NITs, password_hash bcrypt,
--       cédulas, emails de partes, etc. (PII protegida por Ley 1581).
--   - El resto de tablas tenía `FOR ALL USING (TRUE)` (allow_all) → wide open.
--
-- Acción:
--   1. Drop de TODAS las policies en tablas del schema `public` que empiezan
--      con `sgcc_` (no toca storage.objects ni otros schemas).
--   2. ENABLE + FORCE RLS en todas las tablas sgcc_*.
--   3. Sin policies → deny-all para anon/authenticated por PostgREST.
--
-- Por qué no rompe la app:
--   - SGCC usa `supabaseAdmin` (service_role) en TODAS las API routes server-side.
--   - service_role tiene atributo BYPASSRLS por diseño en Supabase.
--   - El login va por NextAuth → API route → supabaseAdmin (no usa anon key
--     desde el cliente para leer staff/centers).
--
-- Idempotente. Las policies de storage.objects (bucket poderes) NO se tocan.
-- =============================================================================

DO $$
DECLARE
  r RECORD;
  pol RECORD;
  total_policies_dropped INT := 0;
  total_tables_processed INT := 0;
BEGIN
  -- 1) Drop de TODAS las policies en tablas sgcc_* del schema public
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename LIKE 'sgcc_%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                   pol.policyname, pol.schemaname, pol.tablename);
    RAISE NOTICE 'DROP policy % en %.%', pol.policyname, pol.schemaname, pol.tablename;
    total_policies_dropped := total_policies_dropped + 1;
  END LOOP;

  -- 2) ENABLE + FORCE RLS en todas las tablas sgcc_*
  FOR r IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname LIKE 'sgcc_%'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',  r.table_name);
    RAISE NOTICE 'OK   % (RLS enabled + FORCE)', r.table_name;
    total_tables_processed := total_tables_processed + 1;
  END LOOP;

  RAISE NOTICE '----------------------------------------';
  RAISE NOTICE 'Resumen: % policies eliminadas, % tablas blindadas',
               total_policies_dropped, total_tables_processed;
  RAISE NOTICE '----------------------------------------';
END $$;

-- =============================================================================
-- VERIFICACIÓN
-- =============================================================================
SELECT
  c.relname AS tabla,
  c.relrowsecurity AS rls_habilitada,
  c.relforcerowsecurity AS rls_forzada,
  COALESCE(
    (SELECT COUNT(*)::int FROM pg_policies p
     WHERE p.schemaname = 'public' AND p.tablename = c.relname),
    0
  ) AS policies_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname LIKE 'sgcc_%'
ORDER BY c.relname;

-- =============================================================================
-- POST-EJECUCIÓN
-- =============================================================================
-- Todas las filas deben mostrar:
--   rls_habilitada=true, rls_forzada=true, policies_count=0
--
-- Si algo falla porque service_role pierde acceso (no debería), correr:
--   ALTER ROLE service_role BYPASSRLS;
--
-- Verificación externa con curl + anon key debería devolver `[]` para todas
-- las tablas sgcc_*.
-- =============================================================================
