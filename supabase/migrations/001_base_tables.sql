-- supabase/migrations/001_base_tables.sql
-- Tablas base del SGCC (formalizadas desde código existente)

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Centros ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sgcc_centers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  nit TEXT,
  tipo TEXT NOT NULL DEFAULT 'privado'
    CHECK (tipo IN ('privado', 'camara_comercio', 'universidad', 'notaria', 'otro')),
  rep_legal TEXT,
  direccion TEXT,
  ciudad TEXT NOT NULL,
  departamento TEXT,
  telefono TEXT,
  email_contacto TEXT,
  logo_url TEXT,
  resolucion_habilitacion TEXT,
  fecha_habilitacion DATE,
  legados_empresa_id UUID,
  dias_habiles_citacion INTEGER NOT NULL DEFAULT 10,
  hora_inicio_audiencias TIME NOT NULL DEFAULT '08:00',
  hora_fin_audiencias TIME NOT NULL DEFAULT '18:00',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Staff ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sgcc_staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  center_id UUID NOT NULL REFERENCES sgcc_centers(id) ON DELETE CASCADE,
  legados_user_id UUID,
  email TEXT NOT NULL,
  nombre TEXT NOT NULL,
  telefono TEXT,
  rol TEXT NOT NULL DEFAULT 'secretario'
    CHECK (rol IN ('admin', 'conciliador', 'secretario')),
  tarjeta_profesional TEXT,
  firma_url TEXT,
  password_hash TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (email, center_id)
);

-- ─── Partes ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sgcc_parties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo_persona TEXT NOT NULL DEFAULT 'natural'
    CHECK (tipo_persona IN ('natural', 'juridica')),
  nombres TEXT,
  apellidos TEXT,
  tipo_doc TEXT CHECK (tipo_doc IN ('CC', 'CE', 'NIT', 'Pasaporte', 'PPT', 'otro')),
  numero_doc TEXT,
  razon_social TEXT,
  nit_empresa TEXT,
  rep_legal_nombre TEXT,
  rep_legal_doc TEXT,
  email TEXT NOT NULL,
  telefono TEXT,
  direccion TEXT,
  ciudad TEXT,
  email_verified TIMESTAMPTZ,
  invited_at TIMESTAMPTZ,
  password_hash TEXT,
  invite_token TEXT,
  invite_expires TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Salas ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sgcc_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  center_id UUID NOT NULL REFERENCES sgcc_centers(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'presencial'
    CHECK (tipo IN ('presencial', 'virtual')),
  capacidad INTEGER,
  link_virtual TEXT,
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Casos ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sgcc_cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  center_id UUID NOT NULL REFERENCES sgcc_centers(id) ON DELETE CASCADE,
  numero_radicado TEXT NOT NULL,
  materia TEXT NOT NULL
    CHECK (materia IN ('civil', 'comercial', 'laboral', 'familiar', 'consumidor', 'arrendamiento', 'otro')),
  cuantia NUMERIC,
  cuantia_indeterminada BOOLEAN NOT NULL DEFAULT FALSE,
  descripcion TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'solicitud'
    CHECK (estado IN ('solicitud', 'admitido', 'citado', 'audiencia', 'cerrado', 'rechazado')),
  sub_estado TEXT
    CHECK (sub_estado IS NULL OR sub_estado IN ('acuerdo_total', 'acuerdo_parcial', 'no_acuerdo', 'inasistencia', 'desistimiento')),
  conciliador_id UUID REFERENCES sgcc_staff(id),
  secretario_id UUID REFERENCES sgcc_staff(id),
  sala_id UUID REFERENCES sgcc_rooms(id),
  fecha_solicitud TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_admision TIMESTAMPTZ,
  fecha_limite_citacion DATE,
  fecha_audiencia TIMESTAMPTZ,
  fecha_cierre TIMESTAMPTZ,
  tarifa_base NUMERIC,
  tarifa_adicional NUMERIC NOT NULL DEFAULT 0,
  tarifa_pagada BOOLEAN NOT NULL DEFAULT FALSE,
  motivo_rechazo TEXT,
  created_by_staff UUID REFERENCES sgcc_staff(id),
  created_by_party UUID REFERENCES sgcc_parties(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (center_id, numero_radicado)
);

-- ─── Case Parties (relación caso-parte) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS sgcc_case_parties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES sgcc_cases(id) ON DELETE CASCADE,
  party_id UUID NOT NULL REFERENCES sgcc_parties(id),
  rol TEXT NOT NULL CHECK (rol IN ('convocante', 'convocado')),
  apoderado_nombre TEXT,
  apoderado_doc TEXT,
  citacion_enviada_at TIMESTAMPTZ,
  citacion_confirmada_at TIMESTAMPTZ,
  asistio BOOLEAN,
  firmo_acta BOOLEAN NOT NULL DEFAULT FALSE,
  firma_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Audiencias ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sgcc_hearings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES sgcc_cases(id) ON DELETE CASCADE,
  conciliador_id UUID REFERENCES sgcc_staff(id),
  sala_id UUID REFERENCES sgcc_rooms(id),
  fecha_hora TIMESTAMPTZ NOT NULL,
  duracion_min INTEGER NOT NULL DEFAULT 60,
  estado TEXT NOT NULL DEFAULT 'programada'
    CHECK (estado IN ('programada', 'en_curso', 'suspendida', 'finalizada', 'cancelada')),
  tipo TEXT NOT NULL DEFAULT 'inicial'
    CHECK (tipo IN ('inicial', 'continuacion', 'complementaria')),
  notas_previas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Actas ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sgcc_actas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES sgcc_cases(id) ON DELETE CASCADE,
  hearing_id UUID REFERENCES sgcc_hearings(id),
  numero_acta TEXT NOT NULL,
  tipo TEXT NOT NULL
    CHECK (tipo IN ('acuerdo_total', 'acuerdo_parcial', 'no_acuerdo', 'inasistencia', 'desistimiento', 'improcedente')),
  consideraciones TEXT,
  acuerdo_texto TEXT,
  obligaciones JSONB,
  borrador_url TEXT,
  estado_firma TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado_firma IN ('pendiente', 'firmado_parcial', 'firmado_completo', 'archivado')),
  acta_firmada_url TEXT,
  conciliador_id UUID REFERENCES sgcc_staff(id),
  fecha_acta DATE NOT NULL DEFAULT CURRENT_DATE,
  es_constancia BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Documentos ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sgcc_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  center_id UUID NOT NULL REFERENCES sgcc_centers(id) ON DELETE CASCADE,
  case_id UUID REFERENCES sgcc_cases(id) ON DELETE CASCADE,
  acta_id UUID REFERENCES sgcc_actas(id),
  tipo TEXT NOT NULL
    CHECK (tipo IN ('solicitud', 'poder', 'prueba', 'citacion', 'acta_borrador', 'acta_firmada', 'constancia', 'admision', 'rechazo', 'otro')),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  mime_type TEXT,
  tamano_bytes BIGINT,
  subido_por_staff UUID REFERENCES sgcc_staff(id),
  subido_por_party UUID REFERENCES sgcc_parties(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Plantillas ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sgcc_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  center_id UUID REFERENCES sgcc_centers(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL
    CHECK (tipo IN ('citacion', 'acta_acuerdo', 'acta_no_acuerdo', 'acta_inasistencia', 'constancia', 'admision', 'rechazo')),
  nombre TEXT NOT NULL,
  contenido TEXT NOT NULL,
  variables JSONB,
  es_default BOOLEAN NOT NULL DEFAULT FALSE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Notificaciones ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sgcc_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  center_id UUID NOT NULL REFERENCES sgcc_centers(id) ON DELETE CASCADE,
  case_id UUID REFERENCES sgcc_cases(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES sgcc_staff(id) ON DELETE SET NULL,
  party_id UUID REFERENCES sgcc_parties(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  canal TEXT NOT NULL DEFAULT 'both'
    CHECK (canal IN ('in_app', 'email', 'both')),
  email_enviado BOOLEAN NOT NULL DEFAULT FALSE,
  email_enviado_at TIMESTAMPTZ,
  resend_id TEXT,
  leida BOOLEAN NOT NULL DEFAULT FALSE,
  leida_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Timeline ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sgcc_case_timeline (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES sgcc_cases(id) ON DELETE CASCADE,
  etapa TEXT NOT NULL
    CHECK (etapa IN ('solicitud', 'admision', 'citacion', 'audiencia', 'acta', 'archivo')),
  descripcion TEXT NOT NULL,
  completado BOOLEAN NOT NULL DEFAULT FALSE,
  fecha TIMESTAMPTZ,
  referencia_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Índices ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_staff_center ON sgcc_staff(center_id);
CREATE INDEX IF NOT EXISTS idx_staff_email ON sgcc_staff(email);
CREATE INDEX IF NOT EXISTS idx_cases_center ON sgcc_cases(center_id);
CREATE INDEX IF NOT EXISTS idx_cases_estado ON sgcc_cases(estado);
CREATE INDEX IF NOT EXISTS idx_cases_conciliador ON sgcc_cases(conciliador_id);
CREATE INDEX IF NOT EXISTS idx_case_parties_case ON sgcc_case_parties(case_id);
CREATE INDEX IF NOT EXISTS idx_case_parties_party ON sgcc_case_parties(party_id);
CREATE INDEX IF NOT EXISTS idx_hearings_case ON sgcc_hearings(case_id);
CREATE INDEX IF NOT EXISTS idx_hearings_fecha ON sgcc_hearings(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_actas_case ON sgcc_actas(case_id);
CREATE INDEX IF NOT EXISTS idx_documents_case ON sgcc_documents(case_id);
CREATE INDEX IF NOT EXISTS idx_notifications_staff ON sgcc_notifications(staff_id);
CREATE INDEX IF NOT EXISTS idx_notifications_party ON sgcc_notifications(party_id);
CREATE INDEX IF NOT EXISTS idx_timeline_case ON sgcc_case_timeline(case_id);
