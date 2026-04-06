-- supabase/seed.sql
-- Datos de prueba para desarrollo local
-- Credenciales: todos los usuarios usan contraseña "demo1234"

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
-- password: demo1234
INSERT INTO sgcc_staff (id, center_id, email, nombre, telefono, rol, tarjeta_profesional, password_hash)
VALUES
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001',
   'admin@centrodemo.com', 'Carolina Restrepo', '+57 310 1234567', 'admin', NULL,
   '$2b$10$zCggz8/HW5UpR8Br40Zmk./ukyweNBX6aD4DF8NATwuvB3EH6./IS'),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001',
   'conciliador@centrodemo.com', 'Dr. Andrés Martínez', '+57 311 2345678', 'conciliador', 'TP-156.789',
   '$2b$10$zCggz8/HW5UpR8Br40Zmk./ukyweNBX6aD4DF8NATwuvB3EH6./IS'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001',
   'secretaria@centrodemo.com', 'Ana María López', '+57 312 3456789', 'secretario', NULL,
   '$2b$10$zCggz8/HW5UpR8Br40Zmk./ukyweNBX6aD4DF8NATwuvB3EH6./IS')
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
   'maria.gomez@email.com', '+57 314 5678901', 'Bogotá')
ON CONFLICT DO NOTHING;

INSERT INTO sgcc_parties (id, tipo_persona, razon_social, nit_empresa, tipo_doc, numero_doc, rep_legal_nombre, rep_legal_doc, email, telefono, ciudad)
VALUES
  ('00000000-0000-0000-0000-000000000032', 'juridica',
   'Banco Ejemplo S.A.', '900.111.222-3', 'NIT', '900.111.222-3',
   'Pedro Sánchez', '80.123.456',
   'legal@bancoejemplo.com', '+57 601 9876543', 'Bogotá'),
  ('00000000-0000-0000-0000-000000000033', 'juridica',
   'Cooperativa Nacional', '800.333.444-5', 'NIT', '800.333.444-5',
   'Laura Díaz', '51.789.012',
   'cobranzas@cooperativa.com', '+57 601 8765432', 'Medellín')
ON CONFLICT DO NOTHING;

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

-- Apoderado del convocante en caso 1
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

-- Apoderados en caso de insolvencia
INSERT INTO sgcc_case_attorneys (case_id, party_id, attorney_id, motivo_cambio, registrado_por, activo)
VALUES
  ('00000000-0000-0000-0000-000000000051', '00000000-0000-0000-0000-000000000032',
   '00000000-0000-0000-0000-000000000041', 'inicial',
   '00000000-0000-0000-0000-000000000010', TRUE)
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

-- ─── Timeline ──────────────────────────────────────────────────────────────
INSERT INTO sgcc_case_timeline (case_id, etapa, descripcion, completado, fecha)
VALUES
  ('00000000-0000-0000-0000-000000000050', 'solicitud', 'Solicitud radicada', TRUE, '2026-03-15'),
  ('00000000-0000-0000-0000-000000000050', 'admision', 'Caso admitido — asignado a Dr. Andrés Martínez', TRUE, '2026-03-17'),
  ('00000000-0000-0000-0000-000000000051', 'solicitud', 'Solicitud de insolvencia radicada', TRUE, '2026-04-01'),
  ('00000000-0000-0000-0000-000000000052', 'solicitud', 'Solicitud de acuerdo de apoyo radicada', TRUE, '2026-04-03')
ON CONFLICT DO NOTHING;

-- ─── Audiencia programada para caso 1 ──────────────────────────────────────
INSERT INTO sgcc_hearings (id, case_id, conciliador_id, sala_id, fecha_hora, duracion_min, estado, tipo)
VALUES (
  '00000000-0000-0000-0000-000000000060',
  '00000000-0000-0000-0000-000000000050',
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000020',
  '2026-04-10 10:00:00-05',
  90, 'programada', 'inicial'
) ON CONFLICT DO NOTHING;

-- ─── Checklists por defecto ────────────────────────────────────────────────

-- Admisión: Conciliación
INSERT INTO sgcc_checklists (id, center_id, tipo_tramite, tipo_checklist, nombre, items)
VALUES (
  '00000000-0000-0000-0000-000000000070',
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

-- Admisión: Insolvencia
INSERT INTO sgcc_checklists (id, center_id, tipo_tramite, tipo_checklist, nombre, items)
VALUES (
  '00000000-0000-0000-0000-000000000071',
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

-- Admisión: Acuerdo de apoyo
INSERT INTO sgcc_checklists (id, center_id, tipo_tramite, tipo_checklist, nombre, items)
VALUES (
  '00000000-0000-0000-0000-000000000072',
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

-- Poderes: Conciliación
INSERT INTO sgcc_checklists (id, center_id, tipo_tramite, tipo_checklist, nombre, items)
VALUES (
  '00000000-0000-0000-0000-000000000073',
  '00000000-0000-0000-0000-000000000001',
  'conciliacion', 'poderes', 'Poderes — Conciliación',
  '[
    {"nombre": "Poder especial o general", "requerido": true, "descripcion": "Poder otorgado al apoderado"},
    {"nombre": "Tarjeta profesional vigente", "requerido": true, "descripcion": "Verificar en SIRNA o copia"},
    {"nombre": "Certificado de existencia y representación legal", "requerido": false, "descripcion": "Si la parte es persona jurídica"}
  ]'
) ON CONFLICT DO NOTHING;

-- Poderes: Insolvencia
INSERT INTO sgcc_checklists (id, center_id, tipo_tramite, tipo_checklist, nombre, items)
VALUES (
  '00000000-0000-0000-0000-000000000074',
  '00000000-0000-0000-0000-000000000001',
  'insolvencia', 'poderes', 'Poderes — Insolvencia',
  '[
    {"nombre": "Poder especial o general", "requerido": true, "descripcion": "Poder otorgado al apoderado"},
    {"nombre": "Tarjeta profesional vigente", "requerido": true, "descripcion": "Verificar en SIRNA o copia"},
    {"nombre": "Certificado de existencia y representación legal", "requerido": true, "descripcion": "Para cada acreedor persona jurídica"},
    {"nombre": "Acreditación de la calidad de acreedor", "requerido": true, "descripcion": "Documento que pruebe la acreencia"}
  ]'
) ON CONFLICT DO NOTHING;

-- Poderes: Acuerdo de apoyo
INSERT INTO sgcc_checklists (id, center_id, tipo_tramite, tipo_checklist, nombre, items)
VALUES (
  '00000000-0000-0000-0000-000000000075',
  '00000000-0000-0000-0000-000000000001',
  'acuerdo_apoyo', 'poderes', 'Poderes — Acuerdo de Apoyo',
  '[
    {"nombre": "Poder especial o general", "requerido": true, "descripcion": "Si aplica"},
    {"nombre": "Tarjeta profesional vigente", "requerido": true, "descripcion": "Si actúa con apoderado"}
  ]'
) ON CONFLICT DO NOTHING;

-- ─── Plantilla de citación por defecto ─────────────────────────────────────
INSERT INTO sgcc_templates (id, center_id, tipo, nombre, contenido, variables, es_default, activo)
VALUES (
  '00000000-0000-0000-0000-000000000080',
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

-- ─── Correspondencia de ejemplo ────────────────────────────────────────────
INSERT INTO sgcc_correspondence (id, center_id, case_id, tipo, asunto, remitente, destinatario, fecha_radicacion, fecha_limite_respuesta, estado, responsable_staff_id)
VALUES (
  '00000000-0000-0000-0000-000000000090',
  '00000000-0000-0000-0000-000000000001',
  NULL,
  'derecho_peticion',
  'Solicitud de información sobre tarifas del centro',
  'Ministerio de Justicia',
  'Centro de Conciliación Demo',
  '2026-04-01',
  '2026-04-22',
  'recibido',
  '00000000-0000-0000-0000-000000000010'
) ON CONFLICT DO NOTHING;
