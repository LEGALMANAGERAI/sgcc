-- supabase/migrations/021_ley_2445_compliance.sql
-- Cumplimiento completo Ley 2445 de 2025 + Decreto 1136 de 2025 (inciso 7 corregido).
--
-- Amplia el modelo de datos de insolvencia para cubrir los 10 requisitos del
-- Art. 539 + Parágrafos 1 y 2:
--   • Acreedores: tasa de interés, fechas otorgamiento/vencimiento, documentos,
--     codeudores/fiadores/avalistas, garantía mobiliaria economía solidaria,
--     otros conceptos, postergado (causal 1 art. 572A), "info desconocida".
--   • Bienes: medidas cautelares, bienes en el exterior, patrimonio de familia
--     inembargable, documento idóneo adjunto.
--   • Caso: fecha de corte Parágrafo 2, sociedad conyugal liquidada, tipo de
--     fuente de ingresos.
--
-- También agrega el flujo PDF + firma electrónica del deudor antes de radicar:
--   • sgcc_solicitudes_draft gana columnas de estado del PDF y la firma.
--   • sgcc_firma_documentos gana draft_id para asociar al borrador.
--   • El RPC radicar_solicitud valida firma + cablea los campos nuevos.

-- ─── 1. Acreedores: 9 campos nuevos (Dec 1136/2025) ───────────────────────
ALTER TABLE sgcc_case_creditors
  ADD COLUMN IF NOT EXISTS tasa_interes_mensual         NUMERIC(6,3),
  ADD COLUMN IF NOT EXISTS fecha_otorgamiento           DATE,
  ADD COLUMN IF NOT EXISTS fecha_vencimiento            DATE,
  ADD COLUMN IF NOT EXISTS documento_credito            TEXT,
  ADD COLUMN IF NOT EXISTS otros_conceptos              NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS es_postergado_572a           BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS es_garantia_mobiliaria_solidaria BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS monto_aportes_ahorros        NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS info_desconocida             TEXT,
  ADD COLUMN IF NOT EXISTS codeudores_json              JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN sgcc_case_creditors.tasa_interes_mensual IS
  'Tasa mensual pactada del crédito (Art. 539 #3 Ley 2445/2025, inciso 7 corregido por Dec 1136/2025).';
COMMENT ON COLUMN sgcc_case_creditors.es_garantia_mobiliaria_solidaria IS
  'Garantía mobiliaria sobre aportes/ahorros en entidades vigiladas Superintendencia Economía Solidaria. '
  'Se califica 2ª clase hasta el monto aportado; excedente pasa a 5ª clase.';
COMMENT ON COLUMN sgcc_case_creditors.codeudores_json IS
  'Array de { nombre, domicilio, direccion, telefono, correo }. '
  'Codeudores, fiadores o avalistas del crédito (inciso 7 Dec 1136/2025).';

-- ─── 2. Bienes: cautelares + exterior + patrimonio + documento idóneo ────
ALTER TABLE sgcc_case_assets
  ADD COLUMN IF NOT EXISTS medidas_cautelares           TEXT,
  ADD COLUMN IF NOT EXISTS esta_en_exterior             BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pais_exterior                TEXT,
  ADD COLUMN IF NOT EXISTS patrimonio_familia_inembargable BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS documento_idoneo_url         TEXT;

COMMENT ON COLUMN sgcc_case_assets.medidas_cautelares IS
  'Medidas cautelares vigentes distintas al gravamen (embargo, secuestro, inscripción de demanda). Art. 539 #4.';
COMMENT ON COLUMN sgcc_case_assets.esta_en_exterior IS
  'Marca si el bien se encuentra fuera de Colombia. Art. 539 #4 exige incluirlos.';
COMMENT ON COLUMN sgcc_case_assets.patrimonio_familia_inembargable IS
  'Bien constituido como patrimonio de familia inembargable (distinto a "vivienda familiar").';

-- ─── 3. sgcc_cases: fecha corte + sociedad conyugal liquidada + fuente ────
ALTER TABLE sgcc_cases
  ADD COLUMN IF NOT EXISTS fecha_corte_acreedores_bienes DATE,
  ADD COLUMN IF NOT EXISTS tipo_fuente_ingresos         TEXT
    CHECK (tipo_fuente_ingresos IS NULL OR tipo_fuente_ingresos IN
      ('empleado','pensionado','independiente','mixto')),
  ADD COLUMN IF NOT EXISTS sociedad_conyugal_estado     TEXT
    CHECK (sociedad_conyugal_estado IS NULL OR sociedad_conyugal_estado IN
      ('no_aplica','vigente','liquidada_menos_2_anios','liquidada_mas_2_anios')),
  ADD COLUMN IF NOT EXISTS sociedad_conyugal_fecha_liq  DATE,
  ADD COLUMN IF NOT EXISTS sociedad_conyugal_valor_bienes NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS solicitud_pdf_url            TEXT,
  ADD COLUMN IF NOT EXISTS solicitud_pdf_firmado_url    TEXT,
  ADD COLUMN IF NOT EXISTS solicitud_pdf_hash           TEXT,
  ADD COLUMN IF NOT EXISTS solicitud_firmada_at         TIMESTAMPTZ;

COMMENT ON COLUMN sgcc_cases.fecha_corte_acreedores_bienes IS
  'Último día calendario del mes inmediatamente anterior a la radicación (Parágrafo 2 Art. 539).';

-- ─── 4. sgcc_solicitudes_draft: estado PDF + firma ────────────────────────
ALTER TABLE sgcc_solicitudes_draft
  ADD COLUMN IF NOT EXISTS solicitud_pdf_url            TEXT,
  ADD COLUMN IF NOT EXISTS solicitud_pdf_hash           TEXT,
  ADD COLUMN IF NOT EXISTS solicitud_pdf_firmado_url    TEXT,
  ADD COLUMN IF NOT EXISTS solicitud_firma_documento_id UUID,
  ADD COLUMN IF NOT EXISTS solicitud_firmada_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fecha_corte                  DATE;

-- ─── 5. sgcc_firma_documentos: referencia al draft ───────────────────────
ALTER TABLE sgcc_firma_documentos
  ADD COLUMN IF NOT EXISTS draft_id UUID REFERENCES sgcc_solicitudes_draft(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_firma_docs_draft ON sgcc_firma_documentos(draft_id)
  WHERE draft_id IS NOT NULL;

-- ─── 6. Actualizar RPC radicar_solicitud ──────────────────────────────────
-- Ahora: (a) exige que el draft tenga firma del deudor, (b) copia nuevos
-- campos de acreedores/bienes/caso, (c) asocia el PDF firmado al caso.
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
  SELECT * INTO v_draft FROM sgcc_solicitudes_draft
    WHERE id = p_draft_id AND user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Draft no encontrado o no pertenece al usuario';
  END IF;

  -- Insolvencia: exigir firma electrónica del deudor antes de radicar.
  IF v_draft.tipo_tramite = 'insolvencia'
     AND (v_draft.solicitud_pdf_firmado_url IS NULL
          OR v_draft.solicitud_firmada_at IS NULL) THEN
    RAISE EXCEPTION 'La solicitud debe estar firmada electrónicamente antes de radicar (Ley 527/1999, Art. 539 §1 Ley 2445/2025).';
  END IF;

  v_fd := v_draft.form_data;
  v_numero_radicado := generar_numero_radicado(v_draft.center_id);

  v_materia     := COALESCE(NULLIF(v_fd->>'materia', ''), 'otro');
  v_cuantia     := COALESCE(NULLIF(v_fd->>'cuantia', '')::NUMERIC, 0);
  v_descripcion := COALESCE(
                     NULLIF(v_fd->>'descripcion', ''),
                     NULLIF(v_fd->>'causa_insolvencia', ''),
                     'Solicitud radicada desde portal de partes'
                   );

  INSERT INTO sgcc_cases (
    id, center_id, numero_radicado, tipo_tramite, materia, estado,
    descripcion, cuantia, fecha_solicitud,
    tipo_deudor, causa_insolvencia, ingresos_mensuales,
    gastos_subsistencia_mensual, sociedad_conyugal_info,
    matricula_mercantil, activos_totales,
    juramento_aceptado, solicita_tarifa_especial, creado_por_parte,
    created_by_party,
    fecha_corte_acreedores_bienes, tipo_fuente_ingresos,
    sociedad_conyugal_estado, sociedad_conyugal_fecha_liq,
    sociedad_conyugal_valor_bienes,
    solicitud_pdf_url, solicitud_pdf_firmado_url,
    solicitud_pdf_hash, solicitud_firmada_at
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
    v_draft.user_id,
    v_draft.fecha_corte,
    NULLIF(v_fd->>'tipo_fuente_ingresos', ''),
    NULLIF(v_fd->>'sociedad_conyugal_estado', ''),
    NULLIF(v_fd->>'sociedad_conyugal_fecha_liq', '')::DATE,
    NULLIF(v_fd->>'sociedad_conyugal_valor_bienes', '')::NUMERIC,
    v_draft.solicitud_pdf_url,
    v_draft.solicitud_pdf_firmado_url,
    v_draft.solicitud_pdf_hash,
    v_draft.solicitud_firmada_at
  )
  RETURNING id INTO v_case_id;

  INSERT INTO sgcc_case_parties (case_id, party_id, rol)
  VALUES (v_case_id, v_draft.user_id, 'convocante');

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

  IF v_draft.tipo_tramite = 'insolvencia' THEN
    -- 7.1 Acreedores (con campos nuevos Dec 1136/2025)
    IF jsonb_typeof(v_fd->'acreedores') = 'array' THEN
      INSERT INTO sgcc_case_creditors (
        case_id, orden, nombre, tipo_doc, numero_doc, direccion_notif,
        ciudad, correo, telefono, tipo_credito, naturaleza_credito,
        clase_prelacion, capital, intereses, dias_mora, mas_90_dias_mora,
        info_adicional,
        tasa_interes_mensual, fecha_otorgamiento, fecha_vencimiento,
        documento_credito, otros_conceptos,
        es_postergado_572a, es_garantia_mobiliaria_solidaria,
        monto_aportes_ahorros, info_desconocida, codeudores_json
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
             NULLIF(x->>'info_adicional', ''),
             NULLIF(x->>'tasa_interes_mensual', '')::NUMERIC,
             NULLIF(x->>'fecha_otorgamiento', '')::DATE,
             NULLIF(x->>'fecha_vencimiento', '')::DATE,
             NULLIF(x->>'documento_credito', ''),
             NULLIF(x->>'otros_conceptos', '')::NUMERIC,
             COALESCE((x->>'es_postergado_572a')::BOOLEAN, FALSE),
             COALESCE((x->>'es_garantia_mobiliaria_solidaria')::BOOLEAN, FALSE),
             NULLIF(x->>'monto_aportes_ahorros', '')::NUMERIC,
             NULLIF(x->>'info_desconocida', ''),
             COALESCE(x->'codeudores', '[]'::jsonb)
      FROM jsonb_array_elements(v_fd->'acreedores') WITH ORDINALITY AS t(x, ord);
    END IF;

    -- 7.2 Bienes (con cautelares + exterior + patrimonio + docs)
    IF jsonb_typeof(v_fd->'bienes') = 'array' THEN
      INSERT INTO sgcc_case_assets (
        case_id, tipo, descripcion, valor_estimado, porcentaje_dominio,
        gravamen, direccion, ciudad, matricula_inmobiliaria,
        afectacion_vivienda_familiar, marca_modelo, numero_chasis,
        medidas_cautelares, esta_en_exterior, pais_exterior,
        patrimonio_familia_inembargable, documento_idoneo_url
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
             NULLIF(x->>'numero_chasis', ''),
             NULLIF(x->>'medidas_cautelares', ''),
             COALESCE((x->>'esta_en_exterior')::BOOLEAN, FALSE),
             NULLIF(x->>'pais_exterior', ''),
             COALESCE((x->>'patrimonio_familia_inembargable')::BOOLEAN, FALSE),
             NULLIF(x->>'documento_idoneo_url', '')
      FROM jsonb_array_elements(v_fd->'bienes') AS x;
    END IF;

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

  UPDATE sgcc_documents
    SET is_draft = FALSE,
        draft_id = NULL,
        case_id  = v_case_id
    WHERE draft_id = p_draft_id;

  -- Asociar el documento de firma de la solicitud al caso.
  UPDATE sgcc_firma_documentos
    SET case_id = v_case_id
    WHERE draft_id = p_draft_id;

  DELETE FROM sgcc_solicitudes_draft WHERE id = p_draft_id;

  RETURN jsonb_build_object(
    'case_id',         v_case_id,
    'numero_radicado', v_numero_radicado
  );
END;
$$;

COMMENT ON FUNCTION radicar_solicitud(UUID, UUID) IS
  'Radica un borrador: valida firma del deudor (insolvencia), crea sgcc_cases + '
  'tablas hijas con campos Ley 2445/Dec 1136 y asocia documento firmado.';
