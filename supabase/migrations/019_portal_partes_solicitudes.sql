-- supabase/migrations/019_portal_partes_solicitudes.sql
-- Portal de Partes: radicación de solicitudes por parte (convocante).
-- Introduce tablas de borradores (draft), tablas hijas de sgcc_cases
-- (acreedores, bienes, procesos judiciales, plan de pagos) y un RPC
-- atómico `radicar_solicitud` que convierte un draft en un caso con sus
-- dependencias en una sola transacción.
--
-- Notas de adaptación al esquema real del SGCC:
--   - No existe `sgcc_users`; el rol `parte` se modela sobre `sgcc_parties`.
--   - No existe `set_updated_at()` global: se sigue el patrón
--     "update_<tabla>_updated_at()" usado en 016/018.
--   - No existe `auth.uid()` en RLS: el código usa supabaseAdmin (bypass RLS)
--     y filtra en la capa de app. Mantenemos `allow_all` como el resto de
--     tablas (incluida la de draft) y la validación de ownership se hace
--     dentro del RPC y en las rutas /api.
--   - `gen_random_uuid()` no está disponible: usamos `uuid_generate_v4()`.
--   - `generar_numero_radicado(center_id)` no existía; se crea aquí como
--     función SQL usando la misma lógica del helper TS `generateRadicado`.

-- ─── 0. Función generar_numero_radicado ───────────────────────────────────
-- Equivalente al helper TS src/lib/server-utils.ts::generateRadicado.
-- Formato: YYYY-NNNN (ej: 2026-0042). Usa el conteo de casos del centro
-- en el año actual; no es un bloqueo fuerte contra condiciones de carrera
-- pero refleja el comportamiento actual del sistema.
CREATE OR REPLACE FUNCTION generar_numero_radicado(p_center_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_year TEXT := to_char(NOW(), 'YYYY');
  v_seq  INT;
BEGIN
  SELECT COUNT(*) INTO v_seq
    FROM sgcc_cases
    WHERE center_id = p_center_id
      AND numero_radicado LIKE v_year || '-%';

  v_seq := v_seq + 1;
  RETURN v_year || '-' || lpad(v_seq::TEXT, 4, '0');
END;
$$;

COMMENT ON FUNCTION generar_numero_radicado(UUID) IS
  'Genera el siguiente número de radicado del centro para el año actual. Formato YYYY-NNNN.';

-- ─── 1. sgcc_solicitudes_draft ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sgcc_solicitudes_draft (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES sgcc_parties(id) ON DELETE CASCADE,
  center_id      UUID NOT NULL REFERENCES sgcc_centers(id),
  tipo_tramite   TEXT NOT NULL
    CHECK (tipo_tramite IN ('conciliacion','insolvencia','acuerdo_apoyo','directiva_anticipada')),
  form_data      JSONB NOT NULL DEFAULT '{}'::jsonb,
  step_actual    INT  NOT NULL DEFAULT 1,
  completado_pct INT  NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drafts_user ON sgcc_solicitudes_draft(user_id);

CREATE OR REPLACE FUNCTION update_solicitudes_draft_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_drafts_updated_at ON sgcc_solicitudes_draft;
CREATE TRIGGER trg_drafts_updated_at
  BEFORE UPDATE ON sgcc_solicitudes_draft
  FOR EACH ROW
  EXECUTE FUNCTION update_solicitudes_draft_updated_at();

-- ─── 2. Columnas nuevas en sgcc_cases (insolvencia Ley 2445/2025) ─────────
ALTER TABLE sgcc_cases
  ADD COLUMN IF NOT EXISTS tipo_deudor TEXT
    CHECK (tipo_deudor IS NULL OR tipo_deudor IN ('pnnc','pequeno_comerciante')),
  ADD COLUMN IF NOT EXISTS causa_insolvencia TEXT,
  ADD COLUMN IF NOT EXISTS ingresos_mensuales NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS gastos_subsistencia_mensual NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS sociedad_conyugal_info TEXT,
  ADD COLUMN IF NOT EXISTS matricula_mercantil TEXT,
  ADD COLUMN IF NOT EXISTS activos_totales NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS juramento_aceptado BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS solicita_tarifa_especial BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS creado_por_parte BOOLEAN NOT NULL DEFAULT FALSE;

-- Ampliar el CHECK de `tipo_tramite` para admitir `directiva_anticipada`.
-- El constraint original (migración 002) no lo incluye.
DO $$
DECLARE
  v_conname TEXT;
BEGIN
  SELECT conname INTO v_conname
    FROM pg_constraint
    WHERE conrelid = 'sgcc_cases'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%tipo_tramite%';
  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE sgcc_cases DROP CONSTRAINT %I', v_conname);
  END IF;
  ALTER TABLE sgcc_cases
    ADD CONSTRAINT sgcc_cases_tipo_tramite_check
    CHECK (tipo_tramite IN ('conciliacion','insolvencia','acuerdo_apoyo','directiva_anticipada'));
END $$;

-- ─── 3. Tablas hijas de sgcc_cases ────────────────────────────────────────

-- 3.1 Acreedores
CREATE TABLE IF NOT EXISTS sgcc_case_creditors (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id             UUID NOT NULL REFERENCES sgcc_cases(id) ON DELETE CASCADE,
  orden               INT  NOT NULL,
  nombre              TEXT NOT NULL,
  tipo_doc            TEXT,
  numero_doc          TEXT,
  direccion_notif     TEXT,
  ciudad              TEXT,
  correo              TEXT,
  telefono            TEXT,
  tipo_credito        TEXT,
  naturaleza_credito  TEXT,
  clase_prelacion     TEXT
    CHECK (clase_prelacion IS NULL OR clase_prelacion IN
      ('primera','segunda','tercera','cuarta','quinta')),
  capital             NUMERIC(14,2) NOT NULL DEFAULT 0,
  intereses           NUMERIC(14,2) NOT NULL DEFAULT 0,
  dias_mora           INT,
  mas_90_dias_mora    BOOLEAN NOT NULL DEFAULT FALSE,
  es_pequeno_acreedor BOOLEAN NOT NULL DEFAULT FALSE,
  info_adicional      TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_creditors_case ON sgcc_case_creditors(case_id);

-- 3.2 Bienes
CREATE TABLE IF NOT EXISTS sgcc_case_assets (
  id                           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id                      UUID NOT NULL REFERENCES sgcc_cases(id) ON DELETE CASCADE,
  tipo                         TEXT NOT NULL
    CHECK (tipo IN ('inmueble','mueble','elemento_hogar')),
  descripcion                  TEXT,
  valor_estimado               NUMERIC(14,2),
  porcentaje_dominio           INT,
  gravamen                     TEXT,
  direccion                    TEXT,
  ciudad                       TEXT,
  matricula_inmobiliaria       TEXT,
  afectacion_vivienda_familiar BOOLEAN,
  marca_modelo                 TEXT,
  numero_chasis                TEXT,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assets_case ON sgcc_case_assets(case_id);

-- 3.3 Procesos judiciales en contra del deudor
CREATE TABLE IF NOT EXISTS sgcc_case_judicial_processes (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id              UUID NOT NULL REFERENCES sgcc_cases(id) ON DELETE CASCADE,
  juzgado_ciudad       TEXT,
  numero_radicado      TEXT,
  demandante           TEXT,
  tipo_proceso         TEXT,
  tiene_embargo_remate BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_judprocs_case ON sgcc_case_judicial_processes(case_id);

-- 3.4 Propuesta de pago por clase
CREATE TABLE IF NOT EXISTS sgcc_case_payment_plan (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id                     UUID NOT NULL REFERENCES sgcc_cases(id) ON DELETE CASCADE,
  clase_prelacion             TEXT NOT NULL,
  tasa_interes_futura_mensual NUMERIC(5,2),
  tasa_interes_espera_mensual NUMERIC(5,2),
  numero_cuotas               INT,
  cronograma_json             JSONB,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (case_id, clase_prelacion)
);
CREATE INDEX IF NOT EXISTS idx_payment_plan_case ON sgcc_case_payment_plan(case_id);

-- ─── 4. Extender sgcc_documents para adjuntos de draft ────────────────────
ALTER TABLE sgcc_documents
  ADD COLUMN IF NOT EXISTS is_draft   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS draft_id   UUID REFERENCES sgcc_solicitudes_draft(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS tipo_anexo TEXT;

CREATE INDEX IF NOT EXISTS idx_documents_draft
  ON sgcc_documents(draft_id) WHERE draft_id IS NOT NULL;

-- ─── 5. RLS ───────────────────────────────────────────────────────────────
-- Mismo patrón que el resto del sistema: allow_all, control en capa de app
-- (supabaseAdmin bypassa RLS; las rutas /api validan ownership).
ALTER TABLE sgcc_solicitudes_draft       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_case_creditors          ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_case_assets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_case_judicial_processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_case_payment_plan       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON sgcc_solicitudes_draft       FOR ALL USING (TRUE);
CREATE POLICY "allow_all" ON sgcc_case_creditors          FOR ALL USING (TRUE);
CREATE POLICY "allow_all" ON sgcc_case_assets             FOR ALL USING (TRUE);
CREATE POLICY "allow_all" ON sgcc_case_judicial_processes FOR ALL USING (TRUE);
CREATE POLICY "allow_all" ON sgcc_case_payment_plan       FOR ALL USING (TRUE);

-- ─── 6. RPC radicar_solicitud (transacción atómica) ───────────────────────
-- Convierte un draft en un caso con todas sus dependencias. Toda la función
-- corre dentro de la transacción implícita de plpgsql; si cualquier INSERT
-- falla, todos los cambios se revierten (rollback automático).
--
-- Nota: `sgcc_case_parties.party_id` es NOT NULL y referencia a
-- `sgcc_parties`. Para los convocados de conciliación creamos primero el
-- registro en `sgcc_parties` y luego el enlace en `sgcc_case_parties`.
CREATE OR REPLACE FUNCTION radicar_solicitud(p_draft_id UUID, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_draft            sgcc_solicitudes_draft%ROWTYPE;
  v_case_id          UUID;
  v_numero_radicado  TEXT;
  v_fd               JSONB;
  v_materia          TEXT;
  v_cuantia          NUMERIC(14,2);
  v_descripcion      TEXT;
  v_convocado        JSONB;
  v_party_id         UUID;
BEGIN
  -- 1. Leer draft y validar ownership
  SELECT * INTO v_draft FROM sgcc_solicitudes_draft
    WHERE id = p_draft_id AND user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Draft no encontrado o no pertenece al usuario';
  END IF;

  v_fd := v_draft.form_data;

  -- 2. Radicado
  v_numero_radicado := generar_numero_radicado(v_draft.center_id);

  -- 3. Extraer datos comunes (con defaults seguros)
  v_materia     := COALESCE(NULLIF(v_fd->>'materia', ''), 'otro');
  v_cuantia     := COALESCE(NULLIF(v_fd->>'cuantia', '')::NUMERIC, 0);
  v_descripcion := COALESCE(
                     NULLIF(v_fd->>'descripcion', ''),
                     NULLIF(v_fd->>'causa_insolvencia', ''),
                     'Solicitud radicada desde portal de partes'
                   );

  -- 4. INSERT sgcc_cases
  INSERT INTO sgcc_cases (
    id, center_id, numero_radicado, tipo_tramite, materia, estado,
    descripcion, cuantia, fecha_solicitud,
    tipo_deudor, causa_insolvencia, ingresos_mensuales,
    gastos_subsistencia_mensual, sociedad_conyugal_info,
    matricula_mercantil, activos_totales,
    juramento_aceptado, solicita_tarifa_especial, creado_por_parte,
    created_by_party
  ) VALUES (
    uuid_generate_v4(), v_draft.center_id, v_numero_radicado,
    v_draft.tipo_tramite, v_materia, 'solicitud',
    v_descripcion, v_cuantia, NOW(),
    NULLIF(v_fd->>'tipo_deudor', ''),
    NULLIF(v_fd->>'causa_insolvencia', ''),
    NULLIF(v_fd->>'ingresos_mensuales', '')::NUMERIC,
    NULLIF(v_fd->>'gastos_subsistencia_mensual', '')::NUMERIC,
    NULLIF(v_fd->>'sociedad_conyugal_info', ''),
    NULLIF(v_fd->>'matricula_mercantil', ''),
    NULLIF(v_fd->>'activos_totales', '')::NUMERIC,
    COALESCE((v_fd->>'juramento_aceptado')::BOOLEAN, FALSE),
    COALESCE((v_fd->>'solicita_tarifa_especial')::BOOLEAN, FALSE),
    TRUE,
    v_draft.user_id
  )
  RETURNING id INTO v_case_id;

  -- 5. Convocante = el usuario del draft
  INSERT INTO sgcc_case_parties (case_id, party_id, rol)
  VALUES (v_case_id, v_draft.user_id, 'convocante');

  -- 6. Convocados (solo conciliación). Se crea primero la `sgcc_parties`
  --    asociada y luego el vínculo en `sgcc_case_parties`.
  IF v_draft.tipo_tramite = 'conciliacion'
     AND jsonb_typeof(v_fd->'convocados') = 'array' THEN
    FOR v_convocado IN SELECT * FROM jsonb_array_elements(v_fd->'convocados')
    LOOP
      INSERT INTO sgcc_parties (
        id, tipo_persona, nombres, apellidos, tipo_doc, numero_doc,
        razon_social, nit_empresa, email, telefono, ciudad, direccion
      ) VALUES (
        uuid_generate_v4(),
        COALESCE(NULLIF(v_convocado->>'tipo_persona', ''), 'natural'),
        NULLIF(v_convocado->>'nombres', ''),
        NULLIF(v_convocado->>'apellidos', ''),
        NULLIF(v_convocado->>'tipo_doc', ''),
        NULLIF(v_convocado->>'numero_doc', ''),
        NULLIF(v_convocado->>'razon_social', ''),
        NULLIF(v_convocado->>'nit_empresa', ''),
        COALESCE(NULLIF(v_convocado->>'email', ''), 'sin-email@sgcc.local'),
        NULLIF(v_convocado->>'telefono', ''),
        NULLIF(v_convocado->>'ciudad', ''),
        NULLIF(v_convocado->>'direccion', '')
      )
      RETURNING id INTO v_party_id;

      INSERT INTO sgcc_case_parties (case_id, party_id, rol)
      VALUES (v_case_id, v_party_id, 'convocado');
    END LOOP;
  END IF;

  -- 7. Insolvencia: poblar tablas hijas desde JSONB
  IF v_draft.tipo_tramite = 'insolvencia' THEN
    -- 7.1 Acreedores
    IF jsonb_typeof(v_fd->'acreedores') = 'array' THEN
      INSERT INTO sgcc_case_creditors (
        case_id, orden, nombre, tipo_doc, numero_doc, direccion_notif,
        ciudad, correo, telefono, tipo_credito, naturaleza_credito,
        clase_prelacion, capital, intereses, dias_mora, mas_90_dias_mora,
        info_adicional
      )
      SELECT v_case_id,
             (ord - 1)::INT,
             COALESCE(NULLIF(x->>'nombre', ''), 'Acreedor sin nombre'),
             NULLIF(x->>'tipo_doc', ''),
             NULLIF(x->>'numero_doc', ''),
             NULLIF(x->>'direccion_notif', ''),
             NULLIF(x->>'ciudad', ''),
             NULLIF(x->>'correo', ''),
             NULLIF(x->>'telefono', ''),
             NULLIF(x->>'tipo_credito', ''),
             NULLIF(x->>'naturaleza_credito', ''),
             NULLIF(x->>'clase_prelacion', ''),
             COALESCE(NULLIF(x->>'capital', '')::NUMERIC, 0),
             COALESCE(NULLIF(x->>'intereses', '')::NUMERIC, 0),
             NULLIF(x->>'dias_mora', '')::INT,
             COALESCE((x->>'mas_90_dias_mora')::BOOLEAN, FALSE),
             NULLIF(x->>'info_adicional', '')
      FROM jsonb_array_elements(v_fd->'acreedores') WITH ORDINALITY AS t(x, ord);
    END IF;

    -- 7.2 Bienes
    IF jsonb_typeof(v_fd->'bienes') = 'array' THEN
      INSERT INTO sgcc_case_assets (
        case_id, tipo, descripcion, valor_estimado, porcentaje_dominio,
        gravamen, direccion, ciudad, matricula_inmobiliaria,
        afectacion_vivienda_familiar, marca_modelo, numero_chasis
      )
      SELECT v_case_id,
             x->>'tipo',
             NULLIF(x->>'descripcion', ''),
             NULLIF(x->>'valor_estimado', '')::NUMERIC,
             NULLIF(x->>'porcentaje_dominio', '')::INT,
             NULLIF(x->>'gravamen', ''),
             NULLIF(x->>'direccion', ''),
             NULLIF(x->>'ciudad', ''),
             NULLIF(x->>'matricula_inmobiliaria', ''),
             NULLIF(x->>'afectacion_vivienda_familiar', '')::BOOLEAN,
             NULLIF(x->>'marca_modelo', ''),
             NULLIF(x->>'numero_chasis', '')
      FROM jsonb_array_elements(v_fd->'bienes') AS x;
    END IF;

    -- 7.3 Procesos judiciales
    IF jsonb_typeof(v_fd->'procesos') = 'array' THEN
      INSERT INTO sgcc_case_judicial_processes (
        case_id, juzgado_ciudad, numero_radicado, demandante, tipo_proceso,
        tiene_embargo_remate
      )
      SELECT v_case_id,
             NULLIF(x->>'juzgado_ciudad', ''),
             NULLIF(x->>'numero_radicado', ''),
             NULLIF(x->>'demandante', ''),
             NULLIF(x->>'tipo_proceso', ''),
             COALESCE((x->>'tiene_embargo_remate')::BOOLEAN, FALSE)
      FROM jsonb_array_elements(v_fd->'procesos') AS x;
    END IF;

    -- 7.4 Propuesta de pago
    IF jsonb_typeof(v_fd->'propuesta_pago') = 'array' THEN
      INSERT INTO sgcc_case_payment_plan (
        case_id, clase_prelacion, tasa_interes_futura_mensual,
        tasa_interes_espera_mensual, numero_cuotas, cronograma_json
      )
      SELECT v_case_id,
             x->>'clase_prelacion',
             NULLIF(x->>'tasa_interes_futura_mensual', '')::NUMERIC,
             NULLIF(x->>'tasa_interes_espera_mensual', '')::NUMERIC,
             NULLIF(x->>'numero_cuotas', '')::INT,
             x->'cronograma'
      FROM jsonb_array_elements(v_fd->'propuesta_pago') AS x;
    END IF;
  END IF;

  -- 8. Asociar adjuntos del draft al caso (y apagar flag is_draft)
  UPDATE sgcc_documents
    SET is_draft = FALSE,
        draft_id = NULL,
        case_id  = v_case_id
    WHERE draft_id = p_draft_id;

  -- 9. Borrar el draft
  DELETE FROM sgcc_solicitudes_draft WHERE id = p_draft_id;

  -- 10. Resultado
  RETURN jsonb_build_object(
    'case_id',         v_case_id,
    'numero_radicado', v_numero_radicado
  );
END;
$$;

COMMENT ON FUNCTION radicar_solicitud(UUID, UUID) IS
  'Radica un borrador: crea sgcc_cases + tablas hijas en una transacción atómica y borra el draft.';
