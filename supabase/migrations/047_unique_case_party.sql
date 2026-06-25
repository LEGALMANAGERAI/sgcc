-- 047_unique_case_party.sql
-- Previene partes duplicadas en un mismo caso (misma persona/empresa dos veces).
--
-- Contexto: sgcc_case_parties no tenía restricción de unicidad sobre (case_id, party_id),
-- por lo que era posible insertar la misma parte varias veces en un caso. Eso rompía el
-- registro de asistencia con el error de Postgres:
--   "ON CONFLICT DO UPDATE command cannot affect row a second time"
-- al hacer upsert con onConflict "hearing_id,party_id".
--
-- IMPORTANTE: aplicar SOLO después de haber limpiado los duplicados existentes.
-- Si queda algún (case_id, party_id) repetido (p. ej. la misma persona como
-- convocante y convocado), la creación del índice fallará. Resolver primero esos casos.

CREATE UNIQUE INDEX IF NOT EXISTS uq_case_parties_case_party
  ON sgcc_case_parties (case_id, party_id);
