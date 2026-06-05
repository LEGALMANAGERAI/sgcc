-- 044_fix_checklist_items_string.sql
--
-- Algunos registros heredados de sgcc_checklists guardaron la columna jsonb
-- `items` como un string JSON escalar (p.ej. '"[{\"nombre\":...}]"') en vez de
-- un arreglo jsonb. Al consumirlos en el cliente, `items.map(...)` lanzaba
-- "items.map is not a function" y tumbaba las pestañas Poderes/Admisión del
-- expediente y el panel de Configuración → Checklists (client-side exception).
--
-- Esta migración desenvuelve el string al arreglo que ya contiene. Es
-- idempotente: solo afecta filas cuyo valor jsonb es de tipo 'string'.
-- (Ya aplicado en prod vía service role el 2026-06-05; se versiona aquí para
--  reproducibilidad en otros entornos.)

UPDATE sgcc_checklists
SET items = (items #>> '{}')::jsonb
WHERE jsonb_typeof(items) = 'string';
