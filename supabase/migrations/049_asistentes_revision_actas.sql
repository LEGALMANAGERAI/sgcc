-- 049_asistentes_revision_actas.sql
-- Asistentes de conciliador que redactan actas/constancias + revisión del conciliador.
--
-- 1. Rol 'asistente' en sgcc_staff. A diferencia de 'secretario' (ve todo el
--    centro), la asistente solo ve los casos a los que está vinculada.
-- 2. sgcc_asistente_vinculos: una asistente puede trabajar para varios
--    conciliadores. Alcance:
--      case_id NULL      → todos los casos de ese conciliador
--      case_id NOT NULL  → solo ese expediente
--    La asistente puede SOLICITAR el vínculo (estado 'solicitado') y el
--    conciliador lo aprueba ('activo') o rechaza; puede revocarlo después.
-- 3. sgcc_actas: estado de revisión. Las filas existentes quedan 'aprobada'
--    para no bloquear actas históricas; el código fija 'borrador' en las nuevas
--    que redacta una asistente.
-- 4. sgcc_acta_revisiones: bitácora inmutable de cada paso (envío a revisión,
--    devolución con observaciones, aprobación). Trazabilidad para el expediente.
--
-- Idempotente. RLS ENABLE+FORCE sin policies (igual que 099): la app usa
-- service_role desde las API routes.

-- ─── 1. Rol asistente ──────────────────────────────────────────────────────
-- Borra cualquier CHECK sobre `rol` (sin depender del nombre autogenerado).
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.sgcc_staff'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%(rol = ANY%'
  LOOP
    EXECUTE format('ALTER TABLE sgcc_staff DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE sgcc_staff ADD CONSTRAINT sgcc_staff_rol_check
  CHECK (rol IN ('admin', 'conciliador', 'secretario', 'asistente'));

-- ─── 2. Vínculos asistente ↔ conciliador / expediente ─────────────────────
CREATE TABLE IF NOT EXISTS sgcc_asistente_vinculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES sgcc_centers(id) ON DELETE CASCADE,
  asistente_id UUID NOT NULL REFERENCES sgcc_staff(id) ON DELETE CASCADE,
  conciliador_id UUID NOT NULL REFERENCES sgcc_staff(id) ON DELETE CASCADE,
  case_id UUID REFERENCES sgcc_cases(id) ON DELETE CASCADE,
  estado TEXT NOT NULL DEFAULT 'solicitado'
    CHECK (estado IN ('solicitado', 'activo', 'rechazado', 'revocado')),
  solicitado_por UUID REFERENCES sgcc_staff(id),
  resuelto_por UUID REFERENCES sgcc_staff(id),
  resuelto_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (asistente_id <> conciliador_id)
);

-- Un solo vínculo vivo (solicitado o activo) por asistente+conciliador+alcance.
CREATE UNIQUE INDEX IF NOT EXISTS uq_asistente_vinculo_vivo
  ON sgcc_asistente_vinculos (
    asistente_id, conciliador_id,
    COALESCE(case_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE estado IN ('solicitado', 'activo');

CREATE INDEX IF NOT EXISTS idx_asistente_vinculos_asistente
  ON sgcc_asistente_vinculos (asistente_id) WHERE estado = 'activo';
CREATE INDEX IF NOT EXISTS idx_asistente_vinculos_conciliador
  ON sgcc_asistente_vinculos (conciliador_id, estado);

ALTER TABLE sgcc_asistente_vinculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_asistente_vinculos FORCE ROW LEVEL SECURITY;

-- ─── 3. Revisión de actas / constancias ───────────────────────────────────
ALTER TABLE sgcc_actas
  ADD COLUMN IF NOT EXISTS estado_revision TEXT NOT NULL DEFAULT 'aprobada'
    CHECK (estado_revision IN ('borrador', 'en_revision', 'devuelta', 'aprobada')),
  ADD COLUMN IF NOT EXISTS redactada_por UUID REFERENCES sgcc_staff(id),
  ADD COLUMN IF NOT EXISTS revisada_por UUID REFERENCES sgcc_staff(id),
  ADD COLUMN IF NOT EXISTS revisada_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS envio_autorizado_asistente BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN sgcc_actas.estado_revision IS
  'borrador → en_revision → aprobada | devuelta (vuelve a borrador). Solo aprobada se puede enviar a firma/partes.';
COMMENT ON COLUMN sgcc_actas.envio_autorizado_asistente IS
  'TRUE si el conciliador, al aprobar, autorizó a la asistente a enviarla a las partes.';

CREATE INDEX IF NOT EXISTS idx_actas_en_revision
  ON sgcc_actas (conciliador_id) WHERE estado_revision = 'en_revision';

-- ─── 4. Bitácora de revisión ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sgcc_acta_revisiones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acta_id UUID NOT NULL REFERENCES sgcc_actas(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES sgcc_cases(id) ON DELETE CASCADE,
  accion TEXT NOT NULL
    CHECK (accion IN ('enviada_revision', 'devuelta', 'aprobada', 'nueva_version', 'enviada_partes')),
  staff_id UUID NOT NULL REFERENCES sgcc_staff(id),
  observaciones TEXT,
  documento_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acta_revisiones_acta
  ON sgcc_acta_revisiones (acta_id, created_at);

ALTER TABLE sgcc_acta_revisiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_acta_revisiones FORCE ROW LEVEL SECURITY;
