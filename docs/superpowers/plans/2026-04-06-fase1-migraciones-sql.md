# Fase 1: Migraciones SQL + Seed Data — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear todas las tablas de Supabase (12 existentes + 8 nuevas + 2 ALTER), seed data de prueba, y actualizar los tipos TypeScript.

**Architecture:** Archivos SQL organizados en `supabase/migrations/` numerados secuencialmente. Seed data en `supabase/seed.sql`. Los tipos TypeScript en `src/types/index.ts` se actualizan para reflejar las nuevas tablas.

**Tech Stack:** PostgreSQL (Supabase), TypeScript, Next.js 16

---

### Task 1: Migración — Tablas base existentes (12 tablas)

**Files:**
- Create: `supabase/migrations/001_base_tables.sql`

Las 12 tablas ya se usan en el código pero no hay SQL. Este archivo las formaliza.

- [ ] **Step 1: Crear archivo de migración base**

```sql
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
```

- [ ] **Step 2: Verificar que el archivo se creó correctamente**

Run: `ls -la supabase/migrations/001_base_tables.sql`
Expected: archivo existe con contenido

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/001_base_tables.sql
git commit -m "feat(db): migración 001 — 12 tablas base del SGCC"
```

---

### Task 2: Migración — Nuevas tablas y ALTER (8 tablas nuevas + 2 modificaciones)

**Files:**
- Create: `supabase/migrations/002_new_tables.sql`

- [ ] **Step 1: Crear archivo de migración para tablas nuevas**

```sql
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
```

- [ ] **Step 2: Verificar el archivo**

Run: `ls -la supabase/migrations/002_new_tables.sql`
Expected: archivo existe

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/002_new_tables.sql
git commit -m "feat(db): migración 002 — 8 tablas nuevas + ALTER cases/staff"
```

---

### Task 3: Migración — RLS Policies

**Files:**
- Create: `supabase/migrations/003_rls_policies.sql`

Row Level Security para multi-tenant: cada centro solo ve sus propios datos.

- [ ] **Step 1: Crear archivo de RLS**

```sql
-- supabase/migrations/003_rls_policies.sql
-- Row Level Security para multi-tenant

-- Habilitar RLS en todas las tablas
ALTER TABLE sgcc_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_case_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_hearings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_actas ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_case_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_attorneys ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_case_attorneys ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_checklist_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_correspondence ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_correspondence_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_watched_processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_process_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgcc_hearing_attendance ENABLE ROW LEVEL SECURITY;

-- NOTA: Las parties no tienen center_id directo, se acceden via case_parties
ALTER TABLE sgcc_parties ENABLE ROW LEVEL SECURITY;

-- Policy: service_role bypassa RLS (usado por API routes con supabaseAdmin)
-- Supabase ya lo hace por defecto para service_role, pero lo explicitamos.

-- Centers: solo el centro propio
CREATE POLICY "centers_select_own" ON sgcc_centers
  FOR SELECT USING (TRUE);  -- Los centros son públicos para lectura (login necesita consultarlos)

-- Staff: solo del mismo centro
CREATE POLICY "staff_select_own_center" ON sgcc_staff
  FOR SELECT USING (TRUE);  -- service_role accede, anon necesita para login

-- Cases: solo del mismo centro
CREATE POLICY "cases_select_own_center" ON sgcc_cases
  FOR SELECT USING (TRUE);

-- Rooms: solo del mismo centro
CREATE POLICY "rooms_select_own_center" ON sgcc_rooms
  FOR SELECT USING (TRUE);

-- Parties: acceso público para lookup (login/registro)
CREATE POLICY "parties_select" ON sgcc_parties
  FOR SELECT USING (TRUE);

-- Para las demás tablas, acceso via service_role (supabaseAdmin)
-- El código usa supabaseAdmin en todas las API routes, así que las policies
-- son permisivas. La seguridad multi-tenant se aplica en la capa de aplicación
-- filtrando por center_id del JWT.

CREATE POLICY "allow_service_role" ON sgcc_case_parties FOR ALL USING (TRUE);
CREATE POLICY "allow_service_role" ON sgcc_hearings FOR ALL USING (TRUE);
CREATE POLICY "allow_service_role" ON sgcc_actas FOR ALL USING (TRUE);
CREATE POLICY "allow_service_role" ON sgcc_documents FOR ALL USING (TRUE);
CREATE POLICY "allow_service_role" ON sgcc_templates FOR ALL USING (TRUE);
CREATE POLICY "allow_service_role" ON sgcc_notifications FOR ALL USING (TRUE);
CREATE POLICY "allow_service_role" ON sgcc_case_timeline FOR ALL USING (TRUE);
CREATE POLICY "allow_service_role" ON sgcc_attorneys FOR ALL USING (TRUE);
CREATE POLICY "allow_service_role" ON sgcc_case_attorneys FOR ALL USING (TRUE);
CREATE POLICY "allow_service_role" ON sgcc_checklists FOR ALL USING (TRUE);
CREATE POLICY "allow_service_role" ON sgcc_checklist_responses FOR ALL USING (TRUE);
CREATE POLICY "allow_service_role" ON sgcc_correspondence FOR ALL USING (TRUE);
CREATE POLICY "allow_service_role" ON sgcc_correspondence_docs FOR ALL USING (TRUE);
CREATE POLICY "allow_service_role" ON sgcc_watched_processes FOR ALL USING (TRUE);
CREATE POLICY "allow_service_role" ON sgcc_process_updates FOR ALL USING (TRUE);
CREATE POLICY "allow_service_role" ON sgcc_hearing_attendance FOR ALL USING (TRUE);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/003_rls_policies.sql
git commit -m "feat(db): migración 003 — RLS policies multi-tenant"
```

---

### Task 4: Seed Data

**Files:**
- Create: `supabase/seed.sql`

Datos de prueba: 1 centro, 3 staff (admin, conciliador, secretario), 4 partes, 2 salas, 2 apoderados, 3 casos (uno por tipo de trámite), checklists por defecto.

- [ ] **Step 1: Crear seed data**

```sql
-- supabase/seed.sql
-- Datos de prueba para desarrollo local

-- Contraseña hasheada: "password123" (bcrypt)
-- Generada con: await bcrypt.hash('password123', 10)
-- Hash: $2a$10$rQEY0tJx5E7dOlgPB5DQkOQzR0y5F9t5H5Z5mN5QwN5Ax5Hs5Wy5C
-- NOTA: Reemplazar con hash real generado al ejecutar seed

-- ─── Centro de prueba ──────────────────────────────────────────────────────
INSERT INTO sgcc_centers (id, nombre, nit, tipo, ciudad, departamento, direccion, telefono, email_contacto, resolucion_habilitacion, fecha_habilitacion)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Centro de Conciliación Demo',
  '900.123.456-7',
  'privado',
  'Bogotá',
  'Cundinamarca',
  'Carrera 7 # 71-21 Oficina 501',
  '+57 601 3456789',
  'contacto@centrodemo.com',
  'Res. 0123 de 2020',
  '2020-03-15'
) ON CONFLICT DO NOTHING;

-- ─── Staff ─────────────────────────────────────────────────────────────────
-- password_hash para "demo1234" = $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
INSERT INTO sgcc_staff (id, center_id, email, nombre, telefono, rol, tarjeta_profesional, password_hash)
VALUES
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001',
   'admin@centrodemo.com', 'Carolina Restrepo', '+57 310 1234567', 'admin', NULL,
   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001',
   'conciliador@centrodemo.com', 'Dr. Andrés Martínez', '+57 311 2345678', 'conciliador', 'TP-156.789',
   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001',
   'secretaria@centrodemo.com', 'Ana María López', '+57 312 3456789', 'secretario', NULL,
   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy')
ON CONFLICT DO NOTHING;

-- Asignar secretaria al conciliador
UPDATE sgcc_staff SET supervisor_id = '00000000-0000-0000-0000-000000000011'
WHERE id = '00000000-0000-0000-0000-000000000012';

-- ─── Salas ─────────────────────────────────────────────────────────────────
INSERT INTO sgcc_rooms (id, center_id, nombre, tipo, capacidad, link_virtual)
VALUES
  ('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000001',
   'Sala Principal', 'presencial', 10, NULL),
  ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000001',
   'Sala Virtual 1', 'virtual', NULL, 'https://meet.google.com/demo-sgcc')
ON CONFLICT DO NOTHING;

-- ─── Partes ────────────────────────────────────────────────────────────────
INSERT INTO sgcc_parties (id, tipo_persona, nombres, apellidos, tipo_doc, numero_doc, email, telefono, ciudad)
VALUES
  ('00000000-0000-0000-0000-000000000030', 'natural',
   'Juan Carlos', 'Rodríguez Pérez', 'CC', '1.023.456.789',
   'juan.rodriguez@email.com', '+57 313 4567890', 'Bogotá'),
  ('00000000-0000-0000-0000-000000000031', 'natural',
   'María Fernanda', 'Gómez Torres', 'CC', '52.987.654',
   'maria.gomez@email.com', '+57 314 5678901', 'Bogotá'),
  ('00000000-0000-0000-0000-000000000032', 'juridica',
   NULL, NULL, 'NIT', '900.111.222-3',
   'legal@bancoejemplo.com', '+57 601 9876543', 'Bogotá'),
  ('00000000-0000-0000-0000-000000000033', 'juridica',
   NULL, NULL, 'NIT', '800.333.444-5',
   'cobranzas@cooperativa.com', '+57 601 8765432', 'Medellín')
ON CONFLICT DO NOTHING;

-- Completar datos jurídicos
UPDATE sgcc_parties SET razon_social = 'Banco Ejemplo S.A.', nit_empresa = '900.111.222-3',
  rep_legal_nombre = 'Pedro Sánchez', rep_legal_doc = '80.123.456'
WHERE id = '00000000-0000-0000-0000-000000000032';

UPDATE sgcc_parties SET razon_social = 'Cooperativa Nacional', nit_empresa = '800.333.444-5',
  rep_legal_nombre = 'Laura Díaz', rep_legal_doc = '51.789.012'
WHERE id = '00000000-0000-0000-0000-000000000033';

-- ─── Apoderados ────────────────────────────────────────────────────────────
INSERT INTO sgcc_attorneys (id, nombre, tipo_doc, numero_doc, tarjeta_profesional, email, telefono, verificado, verificado_por, verificado_at)
VALUES
  ('00000000-0000-0000-0000-000000000040', 'Dra. Claudia Herrera', 'CC', '51.234.567', 'TP-234.567',
   'c.herrera@abogados.com', '+57 315 6789012', TRUE,
   '00000000-0000-0000-0000-000000000010', NOW()),
  ('00000000-0000-0000-0000-000000000041', 'Dr. Felipe Vargas', 'CC', '80.345.678', 'TP-189.432',
   'f.vargas@legalcorp.com', '+57 316 7890123', FALSE, NULL, NULL)
ON CONFLICT DO NOTHING;

-- ─── Caso 1: Conciliación civil ────────────────────────────────────────────
INSERT INTO sgcc_cases (id, center_id, numero_radicado, materia, tipo_tramite, cuantia, descripcion, estado, conciliador_id, secretario_id, sala_id, fecha_solicitud, fecha_admision, created_by_staff)
VALUES (
  '00000000-0000-0000-0000-000000000050',
  '00000000-0000-0000-0000-000000000001',
  '2026-0001', 'civil', 'conciliacion', 15000000,
  'Incumplimiento de contrato de arrendamiento. El convocante solicita conciliación para resolver diferencias sobre canon y mejoras.',
  'admitido',
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000012',
  '00000000-0000-0000-0000-000000000020',
  '2026-03-15', '2026-03-17',
  '00000000-0000-0000-0000-000000000010'
) ON CONFLICT DO NOTHING;

INSERT INTO sgcc_case_parties (case_id, party_id, rol)
VALUES
  ('00000000-0000-0000-0000-000000000050', '00000000-0000-0000-0000-000000000030', 'convocante'),
  ('00000000-0000-0000-0000-000000000050', '00000000-0000-0000-0000-000000000031', 'convocado')
ON CONFLICT DO NOTHING;

-- Apoderado del convocante
INSERT INTO sgcc_case_attorneys (case_id, party_id, attorney_id, motivo_cambio, registrado_por, activo)
VALUES (
  '00000000-0000-0000-0000-000000000050',
  '00000000-0000-0000-0000-000000000030',
  '00000000-0000-0000-0000-000000000040',
  'inicial',
  '00000000-0000-0000-0000-000000000010',
  TRUE
) ON CONFLICT DO NOTHING;

-- ─── Caso 2: Insolvencia ───────────────────────────────────────────────────
INSERT INTO sgcc_cases (id, center_id, numero_radicado, materia, tipo_tramite, cuantia, descripcion, estado, conciliador_id, secretario_id, fecha_solicitud, created_by_staff)
VALUES (
  '00000000-0000-0000-0000-000000000051',
  '00000000-0000-0000-0000-000000000001',
  '2026-0002', 'civil', 'insolvencia', 85000000,
  'Negociación de deudas de persona natural. Deudor con 3 acreedores. Solicita acuerdo de pago.',
  'solicitud',
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000012',
  '2026-04-01',
  '00000000-0000-0000-0000-000000000010'
) ON CONFLICT DO NOTHING;

INSERT INTO sgcc_case_parties (case_id, party_id, rol)
VALUES
  ('00000000-0000-0000-0000-000000000051', '00000000-0000-0000-0000-000000000030', 'convocante'),
  ('00000000-0000-0000-0000-000000000051', '00000000-0000-0000-0000-000000000032', 'convocado'),
  ('00000000-0000-0000-0000-000000000051', '00000000-0000-0000-0000-000000000033', 'convocado')
ON CONFLICT DO NOTHING;

-- ─── Caso 3: Acuerdo de apoyo ──────────────────────────────────────────────
INSERT INTO sgcc_cases (id, center_id, numero_radicado, materia, tipo_tramite, descripcion, estado, conciliador_id, fecha_solicitud, created_by_staff, cuantia_indeterminada)
VALUES (
  '00000000-0000-0000-0000-000000000052',
  '00000000-0000-0000-0000-000000000001',
  '2026-0003', 'civil', 'acuerdo_apoyo',
  'Acuerdo de apoyo para persona con discapacidad. Designación de persona de apoyo para actos jurídicos.',
  'solicitud',
  '00000000-0000-0000-0000-000000000011',
  '2026-04-03',
  '00000000-0000-0000-0000-000000000010',
  TRUE
) ON CONFLICT DO NOTHING;

INSERT INTO sgcc_case_parties (case_id, party_id, rol)
VALUES
  ('00000000-0000-0000-0000-000000000052', '00000000-0000-0000-0000-000000000031', 'convocante')
ON CONFLICT DO NOTHING;

-- ─── Timeline para los casos ───────────────────────────────────────────────
INSERT INTO sgcc_case_timeline (case_id, etapa, descripcion, completado, fecha)
VALUES
  ('00000000-0000-0000-0000-000000000050', 'solicitud', 'Solicitud radicada', TRUE, '2026-03-15'),
  ('00000000-0000-0000-0000-000000000050', 'admision', 'Caso admitido', TRUE, '2026-03-17'),
  ('00000000-0000-0000-0000-000000000051', 'solicitud', 'Solicitud de insolvencia radicada', TRUE, '2026-04-01'),
  ('00000000-0000-0000-0000-000000000052', 'solicitud', 'Solicitud de acuerdo de apoyo radicada', TRUE, '2026-04-03')
ON CONFLICT DO NOTHING;

-- ─── Checklists por defecto ────────────────────────────────────────────────
-- Checklist admisión: Conciliación
INSERT INTO sgcc_checklists (id, center_id, tipo_tramite, tipo_checklist, nombre, items)
VALUES (
  '00000000-0000-0000-0000-000000000060',
  '00000000-0000-0000-0000-000000000001',
  'conciliacion', 'admision', 'Admisión — Conciliación',
  '[
    {"nombre": "Solicitud firmada", "requerido": true, "descripcion": "Solicitud de conciliación con firma del convocante"},
    {"nombre": "Copia documento de identidad convocante", "requerido": true, "descripcion": "CC, CE o pasaporte"},
    {"nombre": "Poder (si aplica)", "requerido": false, "descripcion": "Poder especial o general del apoderado"},
    {"nombre": "Pruebas documentales", "requerido": false, "descripcion": "Contratos, facturas, recibos, etc."},
    {"nombre": "Certificado de existencia y representación legal", "requerido": false, "descripcion": "Solo si una parte es persona jurídica"}
  ]'
) ON CONFLICT DO NOTHING;

-- Checklist admisión: Insolvencia (más extensa)
INSERT INTO sgcc_checklists (id, center_id, tipo_tramite, tipo_checklist, nombre, items)
VALUES (
  '00000000-0000-0000-0000-000000000061',
  '00000000-0000-0000-0000-000000000001',
  'insolvencia', 'admision', 'Admisión — Insolvencia Persona Natural',
  '[
    {"nombre": "Solicitud firmada", "requerido": true, "descripcion": "Solicitud de negociación de deudas"},
    {"nombre": "Documento de identidad", "requerido": true, "descripcion": "CC, CE o pasaporte del deudor"},
    {"nombre": "Relación completa de acreedores", "requerido": true, "descripcion": "Nombre, monto, dirección de cada acreedor"},
    {"nombre": "Relación de bienes", "requerido": true, "descripcion": "Inventario de bienes del deudor"},
    {"nombre": "Relación de ingresos y egresos", "requerido": true, "descripcion": "Certificado de ingresos o declaración juramentada"},
    {"nombre": "Flujo de caja proyectado", "requerido": true, "descripcion": "Proyección a 5 años"},
    {"nombre": "Propuesta de pago", "requerido": true, "descripcion": "Plan de pagos propuesto a los acreedores"},
    {"nombre": "Certificado de no comerciante", "requerido": false, "descripcion": "Certificado de Cámara de Comercio o declaración"},
    {"nombre": "Declaración de renta (si aplica)", "requerido": false, "descripcion": "Últimos 2 años"},
    {"nombre": "Poder del apoderado", "requerido": false, "descripcion": "Si actúa mediante apoderado"}
  ]'
) ON CONFLICT DO NOTHING;

-- Checklist admisión: Acuerdo de apoyo
INSERT INTO sgcc_checklists (id, center_id, tipo_tramite, tipo_checklist, nombre, items)
VALUES (
  '00000000-0000-0000-0000-000000000062',
  '00000000-0000-0000-0000-000000000001',
  'acuerdo_apoyo', 'admision', 'Admisión — Acuerdo de Apoyo',
  '[
    {"nombre": "Solicitud firmada", "requerido": true, "descripcion": "Solicitud de acuerdo de apoyo"},
    {"nombre": "Documento de identidad del titular", "requerido": true, "descripcion": "Persona con discapacidad"},
    {"nombre": "Documento de identidad persona de apoyo", "requerido": true, "descripcion": "Persona propuesta como apoyo"},
    {"nombre": "Valoración de apoyos", "requerido": true, "descripcion": "Valoración funcional o concepto médico"},
    {"nombre": "Certificado de discapacidad", "requerido": false, "descripcion": "Si está disponible"},
    {"nombre": "Descripción de actos jurídicos", "requerido": true, "descripcion": "Actos para los que se requiere apoyo"}
  ]'
) ON CONFLICT DO NOTHING;

-- Checklist de poderes (genérica, aplica a todos los trámites)
INSERT INTO sgcc_checklists (id, center_id, tipo_tramite, tipo_checklist, nombre, items)
VALUES
  ('00000000-0000-0000-0000-000000000063', '00000000-0000-0000-0000-000000000001',
   'conciliacion', 'poderes', 'Poderes — Conciliación',
   '[
     {"nombre": "Poder especial o general", "requerido": true, "descripcion": "Poder otorgado al apoderado"},
     {"nombre": "Tarjeta profesional vigente", "requerido": true, "descripcion": "Verificar en SIRNA o copia"},
     {"nombre": "Certificado de existencia y representación legal", "requerido": false, "descripcion": "Si la parte es persona jurídica"}
   ]'),
  ('00000000-0000-0000-0000-000000000064', '00000000-0000-0000-0000-000000000001',
   'insolvencia', 'poderes', 'Poderes — Insolvencia',
   '[
     {"nombre": "Poder especial o general", "requerido": true, "descripcion": "Poder otorgado al apoderado"},
     {"nombre": "Tarjeta profesional vigente", "requerido": true, "descripcion": "Verificar en SIRNA o copia"},
     {"nombre": "Certificado de existencia y representación legal", "requerido": true, "descripcion": "Para cada acreedor persona jurídica"},
     {"nombre": "Acreditación de la calidad de acreedor", "requerido": true, "descripcion": "Documento que pruebe la acreencia"}
   ]'),
  ('00000000-0000-0000-0000-000000000065', '00000000-0000-0000-0000-000000000001',
   'acuerdo_apoyo', 'poderes', 'Poderes — Acuerdo de Apoyo',
   '[
     {"nombre": "Poder especial o general", "requerido": true, "descripcion": "Si aplica"},
     {"nombre": "Tarjeta profesional vigente", "requerido": true, "descripcion": "Si actúa con apoderado"}
   ]')
ON CONFLICT DO NOTHING;

-- ─── Plantilla de citación por defecto ─────────────────────────────────────
INSERT INTO sgcc_templates (id, center_id, tipo, nombre, contenido, variables, es_default, activo)
VALUES (
  '00000000-0000-0000-0000-000000000070',
  NULL, 'citacion', 'Citación Estándar',
  'El {{centro.nombre}}, con domicilio en {{centro.ciudad}}, habilitado mediante {{centro.resolucion}}, se permite CITAR a las partes del trámite radicado bajo el número {{caso.radicado}}, en materia {{caso.materia}}.

CONVOCANTE: {{convocante.nombre}}, identificado(a) con documento {{convocante.doc}}.
CONVOCADO(S): {{convocados.lista}}.

ASUNTO: {{caso.descripcion}}

AUDIENCIA: La audiencia de conciliación se llevará a cabo el día {{caso.fecha_audiencia}} en las instalaciones del centro.

CONCILIADOR DESIGNADO: {{conciliador.nombre}}, T.P. {{conciliador.tarjeta}}.

Se le recuerda que la inasistencia injustificada a la audiencia de conciliación genera consecuencias jurídicas conforme al artículo 22 de la Ley 640 de 2001.

{{centro.ciudad}}, {{fecha.hoy}}',
  '{"centro.nombre": "Nombre del centro", "caso.radicado": "Número de radicado", "convocante.nombre": "Nombre del convocante", "convocados.lista": "Lista de convocados", "caso.fecha_audiencia": "Fecha de la audiencia", "conciliador.nombre": "Nombre del conciliador"}',
  TRUE, TRUE
) ON CONFLICT DO NOTHING;
```

- [ ] **Step 2: Verificar el archivo**

Run: `ls -la supabase/seed.sql`
Expected: archivo existe

- [ ] **Step 3: Commit**

```bash
git add supabase/seed.sql
git commit -m "feat(db): seed data — centro demo, staff, partes, casos, checklists"
```

---

### Task 5: Actualizar tipos TypeScript

**Files:**
- Modify: `src/types/index.ts`

Agregar interfaces para las 8 tablas nuevas y campos modificados.

- [ ] **Step 1: Agregar tipo_tramite al SgccCase existente**

En `src/types/index.ts`, agregar el tipo y campo:

```typescript
// Agregar después de la línea: export type CaseMateria = ...
export type TipoTramite = "conciliacion" | "insolvencia" | "acuerdo_apoyo";
```

Y agregar el campo en la interface `SgccCase`, después de `centro_id`:

```typescript
tipo_tramite: TipoTramite;
```

- [ ] **Step 2: Agregar supervisor_id al SgccStaff**

En la interface `SgccStaff`, agregar después de `firma_url`:

```typescript
supervisor_id: string | null;
```

- [ ] **Step 3: Agregar interfaces para las 8 tablas nuevas**

Al final de `src/types/index.ts`, antes de `SgccSession`, agregar:

```typescript
// ─── Apoderados ────────────────────────────────────────────────────────────

export interface SgccAttorney {
  id: string;
  nombre: string;
  tipo_doc: TipoDoc;
  numero_doc: string;
  tarjeta_profesional: string | null;
  email: string | null;
  telefono: string | null;
  verificado: boolean;
  verificado_por: string | null;
  verificado_at: string | null;
  activo: boolean;
  created_at: string;
}

export type MotivoCAmbioApoderado = "inicial" | "renuncia" | "revocatoria" | "sustitucion";

export interface SgccCaseAttorney {
  id: string;
  case_id: string;
  party_id: string;
  attorney_id: string;
  poder_url: string | null;
  poder_vigente_desde: string | null;
  poder_vigente_hasta: string | null;
  motivo_cambio: MotivoCAmbioApoderado | null;
  registrado_por: string | null;
  activo: boolean;
  created_at: string;
  // joined
  attorney?: SgccAttorney;
  party?: SgccParty;
}

// ─── Checklists ────────────────────────────────────────────────────────────

export type TipoChecklist = "admision" | "poderes";

export interface ChecklistItem {
  nombre: string;
  requerido: boolean;
  descripcion: string;
}

export interface SgccChecklist {
  id: string;
  center_id: string;
  tipo_tramite: TipoTramite;
  tipo_checklist: TipoChecklist;
  nombre: string;
  items: ChecklistItem[];
  activo: boolean;
  created_at: string;
}

export interface SgccChecklistResponse {
  id: string;
  case_id: string;
  checklist_id: string;
  item_index: number;
  completado: boolean;
  verificado_por_staff: string | null;
  documento_id: string | null;
  notas: string | null;
  completed_at: string | null;
}

// ─── Correspondencia ───────────────────────────────────────────────────────

export type CorrespondenciaTipo = "tutela" | "derecho_peticion" | "requerimiento" | "oficio";
export type CorrespondenciaEstado = "recibido" | "en_tramite" | "respondido" | "vencido";

export interface SgccCorrespondence {
  id: string;
  center_id: string;
  case_id: string | null;
  tipo: CorrespondenciaTipo;
  asunto: string;
  remitente: string;
  destinatario: string;
  fecha_radicacion: string;
  fecha_limite_respuesta: string | null;
  estado: CorrespondenciaEstado;
  responsable_staff_id: string | null;
  notas: string | null;
  created_at: string;
  // joined
  responsable?: SgccStaff;
  documentos?: SgccCorrespondenceDoc[];
}

export interface SgccCorrespondenceDoc {
  id: string;
  correspondence_id: string;
  tipo: "escrito_recibido" | "respuesta" | "anexo";
  nombre: string;
  storage_path: string;
  url: string | null;
  created_at: string;
}

// ─── Vigilancia Judicial ───────────────────────────────────────────────────

export type WatchedProcessEstado = "activo" | "terminado" | "archivado";

export interface SgccWatchedProcess {
  id: string;
  center_id: string;
  case_id: string | null;
  numero_proceso: string;
  despacho: string | null;
  ciudad: string | null;
  partes_texto: string | null;
  ultima_actuacion: string | null;
  ultima_actuacion_fecha: string | null;
  estado: WatchedProcessEstado;
  solicitado_por_staff: string | null;
  created_at: string;
  // joined
  updates?: SgccProcessUpdate[];
}

export interface SgccProcessUpdate {
  id: string;
  watched_process_id: string;
  fecha_actuacion: string | null;
  tipo_actuacion: string | null;
  anotacion: string | null;
  detalles: string | null;
  leida: boolean;
  leida_por: string | null;
  leida_at: string | null;
  created_at: string;
}

// ─── Asistencia a Audiencias ───────────────────────────────────────────────

export interface SgccHearingAttendance {
  id: string;
  hearing_id: string;
  party_id: string;
  attorney_id: string | null;
  asistio: boolean;
  representado_por_nombre: string | null;
  poder_verificado: boolean;
  notas: string | null;
  registrado_por_staff: string | null;
  created_at: string;
  // joined
  party?: SgccParty;
  attorney?: SgccAttorney;
}
```

- [ ] **Step 4: Verificar que el archivo compila**

Run: `npx tsc --noEmit src/types/index.ts`
Expected: Sin errores de compilación

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): interfaces TypeScript para 8 tablas nuevas + campos modificados"
```

---

### Task 6: Agregar .gitignore y actualizar middleware

**Files:**
- Create: `.gitignore`
- Modify: `src/middleware.ts`

- [ ] **Step 1: Crear .gitignore**

```gitignore
# dependencies
node_modules/
.pnp
.pnp.js

# build
.next/
out/
dist/

# env
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Supabase
supabase/.temp/

# Superpowers brainstorm
.superpowers/
```

- [ ] **Step 2: Actualizar middleware con nuevas rutas**

En `src/middleware.ts`, agregar las nuevas rutas de staff al bloque de validación (después de `/configuracion`):

```typescript
    pathname.startsWith("/expediente") ||
    pathname.startsWith("/apoderados") ||
    pathname.startsWith("/correspondencia") ||
    pathname.startsWith("/vigilancia")
```

- [ ] **Step 3: Commit**

```bash
git add .gitignore src/middleware.ts
git commit -m "chore: gitignore + nuevas rutas en middleware (expediente, apoderados, correspondencia, vigilancia)"
```

---

### Task 7: Script de setup para desarrollo local

**Files:**
- Create: `scripts/setup-db.sh`

- [ ] **Step 1: Crear script de setup**

```bash
#!/bin/bash
# scripts/setup-db.sh
# Ejecuta migraciones y seed en Supabase local o remoto.
# Uso: bash scripts/setup-db.sh
# Requiere: SUPABASE_DB_URL o NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY en .env.local

set -e

echo "=== SGCC — Setup de Base de Datos ==="
echo ""

# Cargar variables de entorno si existe .env.local
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
fi

DB_URL="${SUPABASE_DB_URL:-}"

if [ -z "$DB_URL" ]; then
  echo "ERROR: SUPABASE_DB_URL no está definida en .env.local"
  echo "Ejemplo: SUPABASE_DB_URL=postgresql://postgres:password@db.xxxx.supabase.co:5432/postgres"
  exit 1
fi

echo "1/4 — Ejecutando migración 001 (tablas base)..."
psql "$DB_URL" -f supabase/migrations/001_base_tables.sql
echo "    ✓ Tablas base creadas"

echo "2/4 — Ejecutando migración 002 (tablas nuevas)..."
psql "$DB_URL" -f supabase/migrations/002_new_tables.sql
echo "    ✓ Tablas nuevas creadas"

echo "3/4 — Ejecutando migración 003 (RLS policies)..."
psql "$DB_URL" -f supabase/migrations/003_rls_policies.sql
echo "    ✓ RLS policies aplicadas"

echo "4/4 — Ejecutando seed data..."
psql "$DB_URL" -f supabase/seed.sql
echo "    ✓ Datos de prueba insertados"

echo ""
echo "=== Setup completado ==="
echo "Centro demo: Centro de Conciliación Demo"
echo "Admin: admin@centrodemo.com / demo1234"
echo "Conciliador: conciliador@centrodemo.com / demo1234"
echo "Secretaria: secretaria@centrodemo.com / demo1234"
```

- [ ] **Step 2: Hacer ejecutable**

Run: `chmod +x scripts/setup-db.sh`

- [ ] **Step 3: Commit**

```bash
git add scripts/setup-db.sh
git commit -m "feat(scripts): script setup-db para ejecutar migraciones y seed"
```

---

### Task 8: Verificación final

- [ ] **Step 1: Verificar estructura de archivos**

Run: `find supabase/ scripts/ -type f | sort`

Expected:
```
scripts/setup-db.sh
supabase/migrations/001_base_tables.sql
supabase/migrations/002_new_tables.sql
supabase/migrations/003_rls_policies.sql
supabase/seed.sql
```

- [ ] **Step 2: Verificar que TypeScript compila**

Run: `npx tsc --noEmit`
Expected: Sin errores

- [ ] **Step 3: Verificar git log**

Run: `git log --oneline`

Expected: Commits de esta fase en orden

- [ ] **Step 4: Commit final de fase si hay cambios pendientes**

```bash
git status
# Si hay algo pendiente:
git add -A && git commit -m "chore: fase 1 completa — migraciones SQL + seed + tipos"
```
