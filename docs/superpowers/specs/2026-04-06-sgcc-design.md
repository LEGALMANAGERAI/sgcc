# SGCC — Sistema de Gestión para Centros de Conciliación

**Fecha:** 2026-04-06
**Stack:** Next.js 16 + React 19 + TypeScript + Supabase + NextAuth v5 + Tailwind + Resend
**Arquitectura:** Monolito modular, SaaS multi-tenant
**Ruta:** C:/Users/SD21/sgcc

---

## 1. Contexto

Sistema SaaS para centros de conciliación en Colombia. Soporta tres tipos de trámite: **Conciliación**, **Insolvencia** (Ley 1564/2012) y **Acuerdos de Apoyo** (Ley 1996/2019). Multi-tenant: cada centro es un tenant independiente.

El proyecto tiene un 38% de avance con flujos core de casos funcionales (radicar, admitir, citar, audiencia, acta). El principal dolor operativo es el seguimiento de apoderados que cambian sin avisar, especialmente en insolvencias con 5-20 acreedores.

---

## 2. Módulos

### 2.1 Dashboard del Conciliador/Operador

**Propósito:** Vista principal del conciliador al entrar al sistema. Responde a: qué tengo hoy, qué alertas hay, quién me asiste.

**Cards de resumen (parte superior):**
- Casos activos por tipo (conciliación / insolvencia / acuerdos de apoyo)
- Audiencias hoy / esta semana
- Alertas pendientes (poderes vencidos, cambios de apoderado, docs faltantes)
- Equipo asignado (secretario/asistente por caso)

**Tabla "Mis Casos" (panel central):**

| Campo | Descripción |
|-------|-------------|
| Radicado | Número único del caso |
| Tipo | Conciliación / Insolvencia / Acuerdo de apoyo |
| Partes | Convocante y convocado(s) / acreedores |
| Apoderado actual | Último apoderado registrado por cada parte |
| Cambió apoderado? | Icono de alerta si cambió desde última audiencia |
| Estado | Estado actual del caso |
| Próxima audiencia | Fecha y hora |
| Secretario | Asistente asignado al caso |

- Filtros por tipo de trámite, estado y alertas
- Click en caso → abre expediente digital

**Panel lateral — Audiencias del día:**
- Lista cronológica: hora, caso, sala, partes confirmadas
- Indicador de quién confirmó asistencia

**Alertas inteligentes:**
- Poder de apoderado próximo a vencer
- Abogado con tarjeta profesional sin verificar
- Checklist de admisión incompleta
- Documento faltante en expediente

---

### 2.2 Expediente Digital

**Propósito:** Expediente completo de cada caso, accesible desde el dashboard. Organizado en 5 pestañas.

**Pestaña 1 — Información General:**
- Datos del caso (radicado, materia, cuantía, tipo de trámite)
- Partes involucradas con apoderados actuales
- Conciliador y secretario asignados
- Timeline del caso (existente)

**Pestaña 2 — Documentos:**
- Solicitud inicial
- Poderes (historial con fechas de vigencia)
- Anexos (certificados de existencia y representación legal, etc.)
- Actas generadas
- Citaciones enviadas
- Correspondencia vinculada
- Metadatos: fecha de carga, quién subió, estado (vigente/vencido)

**Pestaña 3 — Checklist de Admisión:**
Configurable por tipo de trámite. La de insolvencia es más extensa.

| Campo | Descripción |
|-------|-------------|
| Documento | Nombre del documento requerido |
| Requerido | Sí / No |
| Estado | Completado / Pendiente |
| Verificado por | Staff que verificó |
| Fecha | Fecha de verificación |
| Documento vinculado | Link al archivo subido |
| Notas | Observaciones |

**Pestaña 4 — Checklist de Poderes/Representación:**

| Campo | Descripción |
|-------|-------------|
| Parte | Nombre de la parte |
| Apoderado | Nombre del apoderado actual |
| Poder vigente? | Sí / Cambió (con fecha) / Vencido |
| Tarjeta profesional | Número + estado de verificación |
| Verificado | Manual — quién y cuándo |
| Alertas | Pendientes de este apoderado |

- Historial de cambios de apoderado (quién era antes, desde cuándo cambió, motivo)
- Botón "Registrar nuevo apoderado" con carga de poder

**Pestaña 5 — Asistencia a Audiencias:**

| Campo | Descripción |
|-------|-------------|
| Audiencia | Número secuencial |
| Fecha | Fecha y hora |
| Parte | Nombre |
| Asistió | Sí / No |
| Representado por | Abogado que asistió |
| Poder en expediente? | Verificación |

- Vista clara de cambios de representación entre audiencias
- Alerta visual cuando el apoderado es diferente al de la audiencia anterior

---

### 2.3 Gestión de Apoderados

**Propósito:** Registro centralizado de abogados y control de cambios de representación.

**Registro de apoderado:**
- Nombre completo, tipo y número de documento
- Número de tarjeta profesional
- Email, teléfono
- Verificación manual: checkbox + verificador + fecha
- Carga del poder (PDF/imagen)
- Vigencia del poder (desde — hasta, o indefinido)

**Historial por caso:**
Cada cambio de apoderado registra:
- Apoderado saliente y entrante
- Fecha del cambio
- Motivo: renuncia, revocatoria, sustitución
- Quién lo registró
- Documento soporte (nuevo poder)

**Flujo de cambio:**
1. Se detecta en audiencia o llega memorial con nuevo poder
2. Operador → Expediente → Checklist de Poderes → "Registrar nuevo apoderado"
3. Carga poder, datos del nuevo abogado
4. Sistema marca al anterior como inactivo desde la fecha
5. Alerta se resuelve si poder y TP están verificados
6. Si falta verificación → alerta amarilla en dashboard

**Vista global (admin del centro):**
- Listado de todos los abogados que han participado en casos del centro
- Filtro por estado de verificación
- Alertas de poderes próximos a vencer

---

### 2.4 Correspondencia Jurídica

**Propósito:** Gestión de tutelas, derechos de petición, requerimientos y oficios.

**Tipos:**
- Derechos de petición (recibidos y enviados)
- Acciones de tutela (notificaciones, respuestas, cumplimiento)
- Requerimientos (de entidades: Supersociedades, Ministerio, jueces)
- Oficios (comunicaciones generales)

**Campos por correspondencia:**
- Tipo, asunto, fecha de radicación
- Caso asociado (opcional)
- Remitente / destinatario
- Fecha límite de respuesta (cálculo automático según tipo)
- Estado: Recibido → En trámite → Respondido / Vencido
- Documentos adjuntos
- Responsable asignado

**Alertas automáticas:**
- Tutela: 48 horas (alerta roja si quedan menos de 12h)
- Derecho de petición: 15 días hábiles (alerta amarilla a los 10 días)
- Requerimiento: según plazo indicado en el oficio

**Vinculación con expediente:**
- Correspondencia asociada a un caso aparece en pestaña de documentos del expediente
- Tutela contra decisión del centro se vincula al caso origen

---

### 2.5 Vigilancia Judicial

**Propósito:** Monitoreo de procesos judiciales relacionados con casos del centro. Igual que Legal Manager.

**Funcionalidad:**
- Consulta Rama Judicial por número de proceso, cédula o nombre
- Monitoreo automático con Vercel Cron (cada 6-12 horas)
- Alertas cuando hay actuaciones nuevas

**Casos de uso en centros de conciliación:**
- Verificar si parte inició proceso judicial paralelo
- Seguimiento de tutelas contra el centro
- Monitoreo de insolvencias que pasan a liquidación judicial
- Verificar proceso judicial previo antes de admitir conciliación

**Datos por proceso vigilado:**
- Número de radicado, despacho, ciudad
- Partes procesales
- Caso SGCC vinculado (opcional)
- Última actuación detectada + fecha
- Estado: Activo / Terminado / Archivado
- Quién solicitó la vigilancia

**Flujo:**
1. Desde expediente o módulo → "Agregar proceso a vigilancia"
2. Buscar por número de proceso o cédula
3. Sistema consulta Rama Judicial
4. Seleccionar y vincular al caso
5. Cron job consulta periódicamente
6. Actuación nueva → notificación + registro en expediente

**Vista:**
- Tabla de procesos vigilados con última actuación
- Filtro por caso, estado, despacho
- Badge en sidebar cuando hay actuaciones sin leer

---

### 2.6 Gestión de Casos (Existente — 38%)

Ya implementado:
- Radicar nueva solicitud
- Procesar admisión/rechazo
- Generar citación (Word + email)
- Programar audiencia (verificación disponibilidad)
- Generar acta (borrador + firma)
- Listado con filtros
- Dashboard básico

**Modificación necesaria:**
- Agregar campo `tipo_tramite` (conciliacion/insolvencia/acuerdo_apoyo)
- Checklists de admisión diferenciadas por tipo
- Vincular con expediente digital

---

### 2.7 Gestión de Conciliadores y Salas

**Conciliadores — CRUD:**
- Datos personales, tarjeta profesional, firma
- Relación con secretario/asistente (supervisor_id)
- Disponibilidad
- Conflictos de interés (futuro)

**Salas — CRUD:**
- Nombre, tipo (presencial/virtual), capacidad
- Link virtual (Zoom/Teams)
- Estado activa/inactiva

---

### 2.8 Reportes / SICAAC

- Estadísticas del centro (casos por tipo, estado, materia, conciliador)
- Reportes al Ministerio de Justicia (formato SICAAC)
- Exportación a Excel/PDF

---

### 2.9 Portal de Partes Externas

- Mis casos (ver estado, audiencias)
- Descargar documentos (citación, acta)
- Confirmar asistencia a audiencia
- Cargar documentos (poder, pruebas)
- Perfil (actualizar datos)

---

### 2.10 Configuración del Centro

- Datos del centro (nombre, NIT, resolución)
- Horarios de audiencias
- Días hábiles
- Checklists personalizables por tipo de trámite
- Logo y personalización

---

## 3. Modelo de Datos

### 3.1 Tablas nuevas (8)

```sql
-- Registro de abogados/apoderados
sgcc_attorneys (
  id UUID PK,
  nombre TEXT NOT NULL,
  tipo_doc TEXT NOT NULL,
  numero_doc TEXT NOT NULL UNIQUE,
  tarjeta_profesional TEXT UNIQUE,
  email TEXT,
  telefono TEXT,
  verificado BOOLEAN DEFAULT FALSE,
  verificado_por UUID FK sgcc_staff,
  verificado_at TIMESTAMPTZ,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Historial apoderado-parte-caso
sgcc_case_attorneys (
  id UUID PK,
  case_id UUID FK sgcc_cases NOT NULL,
  party_id UUID FK sgcc_parties NOT NULL,
  attorney_id UUID FK sgcc_attorneys NOT NULL,
  poder_url TEXT,
  poder_vigente_desde DATE,
  poder_vigente_hasta DATE,
  motivo_cambio TEXT, -- renuncia, revocatoria, sustitución
  registrado_por UUID FK sgcc_staff,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Definición de checklists por tipo de trámite
sgcc_checklists (
  id UUID PK,
  center_id UUID FK sgcc_centers NOT NULL,
  tipo_tramite TEXT NOT NULL, -- conciliacion, insolvencia, acuerdo_apoyo
  tipo_checklist TEXT NOT NULL, -- admision, poderes
  nombre TEXT NOT NULL,
  items JSONB NOT NULL, -- [{nombre, requerido, descripcion}]
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Estado de cada item de checklist por caso
sgcc_checklist_responses (
  id UUID PK,
  case_id UUID FK sgcc_cases NOT NULL,
  checklist_id UUID FK sgcc_checklists NOT NULL,
  item_index INTEGER NOT NULL,
  completado BOOLEAN DEFAULT FALSE,
  verificado_por_staff UUID FK sgcc_staff,
  documento_id UUID FK sgcc_documents,
  notas TEXT,
  completed_at TIMESTAMPTZ
)

-- Correspondencia jurídica
sgcc_correspondence (
  id UUID PK,
  center_id UUID FK sgcc_centers NOT NULL,
  case_id UUID FK sgcc_cases, -- nullable
  tipo TEXT NOT NULL, -- tutela, derecho_peticion, requerimiento, oficio
  asunto TEXT NOT NULL,
  remitente TEXT NOT NULL,
  destinatario TEXT NOT NULL,
  fecha_radicacion DATE NOT NULL,
  fecha_limite_respuesta DATE,
  estado TEXT NOT NULL DEFAULT 'recibido', -- recibido, en_tramite, respondido, vencido
  responsable_staff_id UUID FK sgcc_staff,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Documentos de correspondencia
sgcc_correspondence_docs (
  id UUID PK,
  correspondence_id UUID FK sgcc_correspondence NOT NULL,
  tipo TEXT NOT NULL, -- escrito_recibido, respuesta, anexo
  nombre TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Procesos en vigilancia judicial
sgcc_watched_processes (
  id UUID PK,
  center_id UUID FK sgcc_centers NOT NULL,
  case_id UUID FK sgcc_cases, -- nullable
  numero_proceso TEXT NOT NULL,
  despacho TEXT,
  ciudad TEXT,
  partes_texto TEXT,
  ultima_actuacion TEXT,
  ultima_actuacion_fecha DATE,
  estado TEXT NOT NULL DEFAULT 'activo', -- activo, terminado, archivado
  solicitado_por_staff UUID FK sgcc_staff,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Actuaciones detectadas en procesos vigilados
sgcc_process_updates (
  id UUID PK,
  watched_process_id UUID FK sgcc_watched_processes NOT NULL,
  fecha_actuacion DATE,
  tipo_actuacion TEXT,
  anotacion TEXT,
  detalles TEXT,
  leida BOOLEAN DEFAULT FALSE,
  leida_por UUID FK sgcc_staff,
  leida_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Asistencia detallada por audiencia
sgcc_hearing_attendance (
  id UUID PK,
  hearing_id UUID FK sgcc_hearings NOT NULL,
  party_id UUID FK sgcc_parties NOT NULL,
  attorney_id UUID FK sgcc_attorneys,
  asistio BOOLEAN DEFAULT FALSE,
  representado_por_nombre TEXT,
  poder_verificado BOOLEAN DEFAULT FALSE,
  notas TEXT,
  registrado_por_staff UUID FK sgcc_staff,
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

### 3.2 Modificaciones a tablas existentes

```sql
-- sgcc_cases: agregar tipo de trámite
ALTER TABLE sgcc_cases ADD COLUMN tipo_tramite TEXT NOT NULL DEFAULT 'conciliacion';
-- valores: conciliacion, insolvencia, acuerdo_apoyo

-- sgcc_staff: agregar relación supervisor (conciliador ↔ secretario)
ALTER TABLE sgcc_staff ADD COLUMN supervisor_id UUID REFERENCES sgcc_staff(id);
```

### 3.3 Resumen

- 12 tablas existentes + 8 nuevas + 2 modificadas = **20 tablas totales**

---

## 4. Orden de Implementación

| Fase | Módulo | Dependencias |
|------|--------|-------------|
| 1 | Migraciones SQL + seed data | Ninguna |
| 2 | Dashboard del conciliador | Migraciones |
| 3 | Expediente digital + checklists | Dashboard |
| 4 | Gestión de apoderados + asistencia | Expediente |
| 5 | Correspondencia jurídica | Expediente |
| 6 | Vigilancia judicial | Migraciones |
| 7 | Conciliadores / salas / agenda | Migraciones |
| 8 | Reportes / SICAAC | Todos los módulos |
| 9 | Portal de partes | Expediente |
| 10 | Configuración del centro | Migraciones |

---

## 5. Decisiones Técnicas

- **Verificación de abogados:** Manual por ahora (checkbox + soporte), preparado para integración SIRNA futura
- **Vigilancia Judicial:** Reutilizar lógica de Legal Manager (consulta Rama Judicial + Vercel Cron)
- **Generación de documentos:** Ya existe con librería `docx`, se extiende para nuevos tipos
- **Notificaciones:** Backend con Resend ya existe, falta UI (campana, panel, marcar leído)
- **Multi-tenant:** Cada consulta filtrada por `center_id` del JWT
