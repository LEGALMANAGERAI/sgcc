-- ═══════════════════════════════════════════════════════════════════════
-- 037: link al expediente digital (Drive u otra plataforma) por caso
-- ═══════════════════════════════════════════════════════════════════════
--
-- Los centros manejan el expediente físico/digital en Drive y comparten
-- el link con las partes. SIGECC guarda ese URL por caso para que el
-- staff lo edite y todos (incluidas las partes) puedan abrirlo desde la
-- pestaña Documentos del expediente sin tener que pedirlo por WhatsApp.

ALTER TABLE sgcc_cases
  ADD COLUMN IF NOT EXISTS expediente_digital_url TEXT;
