-- supabase/migrations/002_new_tables.sql
-- Nuevas tablas: apoderados, checklists, correspondencia, vigilancia, asistencia
-- Modificaciones: sgcc_cases (tipo_tramite), sgcc_staff (supervisor_id)

-- ─── ALTER: tipo_tramite en casos ──────────────────────────────────────────
ALTER TABLE sgcc_cases
  ADD COLUMN IF NOT EXISTS tipo_tramite TEXT NOT NULL DEFAULT 'conciliacion'
    CHECK (tipo_tramite IN ('conciliacion', 'insolvencia', 'acuerdo_apoyo'));

-- ─── ALTER: supervisor en staff ────────────────────────────────────────────
ALTER TABLE sgcc_staff
  ADD COLUMN IF NOT EXISTS supervisor_id UUID REFERENCES sgcc_staff(id);

-- ─── Apoderados/Abogados ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sgcc_attorneys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  tipo_doc TEXT NOT NULL
    CHECK (tipo_doc IN ('CC', 'CE', 'Pasaporte', 'PPT', 'otro')),
  numero_doc TEXT NOT NULL UNIQUE,
  tarjeta_profesional TEXT UNIQUE,
  email TEXT,
  telefono TEXT,
  verificado BOOLEAN NOT NULL DEFAULT FALSE,
  verificado_por UUID REFERENCES sgcc_staff(id),
  verificado_at TIMESTAMPTZ,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Historial apoderado-parte-caso ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sgcc_case_attorneys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES sgcc_cases(id) ON DELETE CASCADE,
  party_id UUID NOT NULL REFERENCES sgcc_parties(id),
  attorney_id UUID NOT NULL REFERENCES sgcc_attorneys(id),
  poder_url TEXT,
  poder_vigente_desde DATE,
  poder_vigente_hasta DATE,
  motivo_cambio TEXT
    CHECK (motivo_cambio IS NULL OR motivo_cambio IN ('inicial', 'renuncia', 'revocatoria', 'sustitucion')),
  registrado_por UUID REFERENCES sgcc_staff(id),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Checklists (definición por tipo de trámite) ──────────────────────────
CREATE TABLE IF NOT EXISTS sgcc_checklists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  center_id UUID NOT NULL REFERENCES sgcc_centers(id) ON DELETE CASCADE,
  tipo_tramite TEXT NOT NULL
    CHECK (tipo_tramite IN ('conciliacion', 'insolvencia', 'acuerdo_apoyo')),
  tipo_checklist TEXT NOT NULL
    CHECK (tipo_checklist IN ('admision', 'poderes')),
  nombre TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Checklist Responses (estado por caso) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS sgcc_checklist_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES sgcc_cases(id) ON DELETE CASCADE,
  checklist_id UUID NOT NULL REFERENCES sgcc_checklists(id),
  item_index INTEGER NOT NULL,
  completado BOOLEAN NOT NULL DEFAULT FALSE,
  verificado_por_staff UUID REFERENCES sgcc_staff(id),
  documento_id UUID REFERENCES sgcc_documents(id),
  notas TEXT,
  completed_at TIMESTAMPTZ,
  UNIQUE (case_id, checklist_id, item_index)
);

-- ─── Correspondencia Jurídica ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sgcc_correspondence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  center_id UUID NOT NULL REFERENCES sgcc_centers(id) ON DELETE CASCADE,
  case_id UUID REFERENCES sgcc_cases(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL
    CHECK (tipo IN ('tutela', 'derecho_peticion', 'requerimiento', 'oficio')),
  asunto TEXT NOT NULL,
  remitente TEXT NOT NULL,
  destinatario TEXT NOT NULL,
  fecha_radicacion DATE NOT NULL,
  fecha_limite_respuesta DATE,
  estado TEXT NOT NULL DEFAULT 'recibido'
    CHECK (estado IN ('recibido', 'en_tramite', 'respondido', 'vencido')),
  responsable_staff_id UUID REFERENCES sgcc_staff(id),
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Documentos de Correspondencia ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sgcc_correspondence_docs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  correspondence_id UUID NOT NULL REFERENCES sgcc_correspondence(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL
    CHECK (tipo IN ('escrito_recibido', 'respuesta', 'anexo')),
  nombre TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Procesos Vigilados ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sgcc_watched_processes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  center_id UUID NOT NULL REFERENCES sgcc_centers(id) ON DELETE CASCADE,
  case_id UUID REFERENCES sgcc_cases(id) ON DELETE SET NULL,
  numero_proceso TEXT NOT NULL,
  despacho TEXT,
  ciudad TEXT,
  partes_texto TEXT,
  ultima_actuacion TEXT,
  ultima_actuacion_fecha DATE,
  estado TEXT NOT NULL DEFAULT 'activo'
    CHECK (estado IN ('activo', 'terminado', 'archivado')),
  solicitado_por_staff UUID REFERENCES sgcc_staff(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Actuaciones de Procesos Vigilados ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS sgcc_process_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  watched_process_id UUID NOT NULL REFERENCES sgcc_watched_processes(id) ON DELETE CASCADE,
  fecha_actuacion DATE,
  tipo_actuacion TEXT,
  anotacion TEXT,
  detalles TEXT,
  leida BOOLEAN NOT NULL DEFAULT FALSE,
  leida_por UUID REFERENCES sgcc_staff(id),
  leida_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Asistencia a Audiencias ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sgcc_hearing_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hearing_id UUID NOT NULL REFERENCES sgcc_hearings(id) ON DELETE CASCADE,
  party_id UUID NOT NULL REFERENCES sgcc_parties(id),
  attorney_id UUID REFERENCES sgcc_attorneys(id),
  asistio BOOLEAN NOT NULL DEFAULT FALSE,
  representado_por_nombre TEXT,
  poder_verificado BOOLEAN NOT NULL DEFAULT FALSE,
  notas TEXT,
  registrado_por_staff UUID REFERENCES sgcc_staff(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (hearing_id, party_id)
);

-- ─── Índices nuevas tablas ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cases_tipo_tramite ON sgcc_cases(tipo_tramite);
CREATE INDEX IF NOT EXISTS idx_staff_supervisor ON sgcc_staff(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_attorneys_doc ON sgcc_attorneys(numero_doc);
CREATE INDEX IF NOT EXISTS idx_attorneys_tp ON sgcc_attorneys(tarjeta_profesional);
CREATE INDEX IF NOT EXISTS idx_case_attorneys_case ON sgcc_case_attorneys(case_id);
CREATE INDEX IF NOT EXISTS idx_case_attorneys_party ON sgcc_case_attorneys(party_id);
CREATE INDEX IF NOT EXISTS idx_case_attorneys_attorney ON sgcc_case_attorneys(attorney_id);
CREATE INDEX IF NOT EXISTS idx_case_attorneys_active ON sgcc_case_attorneys(case_id, party_id) WHERE activo = TRUE;
CREATE INDEX IF NOT EXISTS idx_checklists_center ON sgcc_checklists(center_id);
CREATE INDEX IF NOT EXISTS idx_checklist_responses_case ON sgcc_checklist_responses(case_id);
CREATE INDEX IF NOT EXISTS idx_correspondence_center ON sgcc_correspondence(center_id);
CREATE INDEX IF NOT EXISTS idx_correspondence_case ON sgcc_correspondence(case_id);
CREATE INDEX IF NOT EXISTS idx_correspondence_estado ON sgcc_correspondence(estado);
CREATE INDEX IF NOT EXISTS idx_correspondence_limite ON sgcc_correspondence(fecha_limite_respuesta);
CREATE INDEX IF NOT EXISTS idx_watched_processes_center ON sgcc_watched_processes(center_id);
CREATE INDEX IF NOT EXISTS idx_watched_processes_case ON sgcc_watched_processes(case_id);
CREATE INDEX IF NOT EXISTS idx_process_updates_process ON sgcc_process_updates(watched_process_id);
CREATE INDEX IF NOT EXISTS idx_process_updates_unread ON sgcc_process_updates(watched_process_id) WHERE leida = FALSE;
CREATE INDEX IF NOT EXISTS idx_hearing_attendance_hearing ON sgcc_hearing_attendance(hearing_id);
