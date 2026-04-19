# Portal de Partes — Radicación de Solicitudes por el Usuario

**Fecha:** 2026-04-18
**Rama:** `feature/portal-partes-solicitudes`
**Alcance de esta iteración:** Conciliación + Insolvencia.
**Trámites soportados por arquitectura (implementación progresiva):** Conciliación, Insolvencia, Acuerdo de Apoyo (Ley 1996/2019 Art. 16), Directiva Anticipada (Ley 1996/2019 Art. 17).

---

## 1. Motivación y contexto

Hoy el SGCC permite a los usuarios con rol `parte` autenticarse y **leer** sus casos en `/mis-casos`, pero las solicitudes solo se radican:

1. Vía `/widget/[centerId]` público (sin cuenta) — flujo genérico de 5 pasos para cualquier trámite.
2. Vía staff desde `/casos/nuevo` (usuario del centro radica en nombre de la parte).

Se requiere que **cada usuario del centro pueda crear cuenta y radicar sus propias solicitudes** de los 4 trámites legales soportados, en particular para:

- **Conciliación:** flujo corto (convocado + materia + descripción + cuantía).
- **Insolvencia de persona natural no comerciante o pequeño comerciante** (Ley 1564/2012 modificada por **Ley 2445 de 2025**): flujo completo con acreedores, bienes, procesos judiciales, propuesta de pago, anexos y juramento.

El widget público se **desactiva**: toda solicitud pasa por cuenta autenticada.

### Cambios normativos Ley 2445/2025 que impactan el diseño

| Aspecto | Ley 1564/2012 (original) | Ley 2445/2025 |
|---|---|---|
| Sujetos | Solo persona natural no comerciante | PNNC **+ pequeño comerciante** (activos < 1.000 SMLMV, excluyendo vivienda y vehículo de trabajo) |
| % obligaciones en mora | 50% del pasivo | **30% del pasivo** (Art. 538) |
| REDAM | No exigido | **Anexo obligatorio** (Art. 539 #9) |
| Matrícula mercantil | N/A | Obligatoria para pequeño comerciante (Art. 539 #10) |
| Pequeño acreedor | Concepto no existía | Definido como acreedores de menor cuantía cuya suma ≤ **5% del capital total reconocido** (Art. 553 #8). Calculado por el sistema, no marcado por el usuario. |
| Juramento | Fórmula declarativa genérica | Art. 539 §1: *"La información y las declaraciones se entenderán rendidas bajo la gravedad del juramento; la solicitud deberá incluir expresamente la manifestación de que no se ha incurrido en omisiones, imprecisiones o errores que impidan conocer la verdadera situación económica y la capacidad de pago."* |
| SGSSS empleados (pequeño comerciante) | N/A | **No es requisito de admisión.** Es gasto de administración durante el trámite (Art. 549) y obligación continua en la ejecución del acuerdo (Art. 553 §4). Queda **fuera del formulario de solicitud**; entra por el módulo de seguimiento del caso. |

---

## 2. Decisiones de producto

1. **Una cuenta = un centro.** En el registro de parte se pide código corto (8 chars alfanuméricos, ya existe) y queda amarrado a ese `center_id`. Para radicar en otro centro, el usuario crea otra cuenta.
2. **Widget público se desactiva.** La ruta `/widget/[centerId]` y su endpoint `POST /api/widget/solicitud` se deprecan (ver plan de transición abajo).
3. **Borrador persistente en BD.** Un usuario puede interrumpir y retomar la solicitud desde cualquier dispositivo. Auto-save cada 3 s.
4. **Insolvencia V1 completa.** Captura acreedores, bienes (inmuebles/muebles/hogar), procesos judiciales, ingresos/gastos, sociedad conyugal, propuesta de pago por clase de prelación con cronograma, anexos tipados, juramento.
5. **Pequeño acreedor:** calculado por el servidor al generar la relación definitiva, **no** marcado en el formulario.
6. **Conciliación V1 simple.** Flujo equivalente al widget actual pero con cuenta, adjuntos opcionales y soporte para apoderado.

---

## 3. Arquitectura

```
┌─ Portal Partes (logueado) ──────────────────────────────┐
│  /registro/parte (existente, + campo código corto)      │
│  /login         (existente)                             │
│                                                         │
│  /mis-solicitudes         (NUEVO)  lista drafts+radicadas│
│  /mis-solicitudes/nueva   (NUEVO)  selector trámite     │
│  /mis-solicitudes/[id]    (NUEVO)  wizard auto-save     │
│                                                         │
│  /mis-casos               (existente, intacto)          │
└─────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─ API /api/partes/* (middleware = sesión parte) ─────────┐
│  POST   /solicitudes                → crear draft       │
│  GET    /solicitudes                → listar mis drafts │
│  GET    /solicitudes/[id]                               │
│  PATCH  /solicitudes/[id]           → guarda form_data  │
│  DELETE /solicitudes/[id]           → borra draft       │
│  POST   /solicitudes/[id]/adjuntos  → upload Storage    │
│  DELETE /solicitudes/[id]/adjuntos/[docId]              │
│  POST   /solicitudes/[id]/radicar   → transacción final │
└─────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─ BD ────────────────────────────────────────────────────┐
│  sgcc_solicitudes_draft       (NUEVA, JSONB form_data)  │
│  sgcc_case_creditors          (NUEVA, hija de cases)    │
│  sgcc_case_assets             (NUEVA)                   │
│  sgcc_case_judicial_processes (NUEVA)                   │
│  sgcc_case_payment_plan       (NUEVA)                   │
│  sgcc_cases                   (+9 columnas insolvencia) │
│  sgcc_case_parties            (existente, reutilizada)  │
│  sgcc_documents               (+columnas is_draft, draft_id)│
│  sgcc_centers                 (existente)               │
└─────────────────────────────────────────────────────────┘
```

**Principio:** Mientras la solicitud es borrador, todo el estado vive en `sgcc_solicitudes_draft.form_data` (JSONB). Los adjuntos ya subidos viven en `sgcc_documents` con `is_draft=true`. Al **radicar**, una transacción SQL:
1. Crea `sgcc_cases` con estado `solicitud`.
2. Crea `sgcc_case_parties` para el convocante (= `user_id`).
3. Para insolvencia, crea N registros en cada tabla hija a partir del JSONB.
4. Marca los adjuntos como `is_draft=false` y los asocia al `case_id`.
5. Elimina el draft.

---

## 4. Schema SQL (migración 019)

### 4.1 Tabla principal del borrador

```sql
CREATE TABLE sgcc_solicitudes_draft (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES sgcc_users(id) ON DELETE CASCADE,
  center_id      uuid NOT NULL REFERENCES sgcc_centers(id),
  tipo_tramite   text NOT NULL CHECK (tipo_tramite IN
                   ('conciliacion','insolvencia','acuerdo_apoyo','directiva_anticipada')),
  form_data      jsonb NOT NULL DEFAULT '{}'::jsonb,
  step_actual    int  NOT NULL DEFAULT 1,
  completado_pct int  NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_drafts_user ON sgcc_solicitudes_draft(user_id);
CREATE TRIGGER trg_drafts_updated BEFORE UPDATE ON sgcc_solicitudes_draft
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### 4.2 Columnas nuevas en `sgcc_cases` (insolvencia)

```sql
ALTER TABLE sgcc_cases
  ADD COLUMN tipo_deudor text CHECK (tipo_deudor IN ('pnnc','pequeno_comerciante')),
  ADD COLUMN causa_insolvencia text,
  ADD COLUMN ingresos_mensuales numeric(14,2),
  ADD COLUMN gastos_subsistencia_mensual numeric(14,2),
  ADD COLUMN sociedad_conyugal_info text,
  ADD COLUMN matricula_mercantil text,
  ADD COLUMN activos_totales numeric(14,2),
  ADD COLUMN juramento_aceptado boolean NOT NULL DEFAULT false,
  ADD COLUMN solicita_tarifa_especial boolean NOT NULL DEFAULT false,
  ADD COLUMN creado_por_parte boolean NOT NULL DEFAULT false;
```

### 4.3 Acreedores

```sql
CREATE TABLE sgcc_case_creditors (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id            uuid NOT NULL REFERENCES sgcc_cases(id) ON DELETE CASCADE,
  orden              int NOT NULL,
  nombre             text NOT NULL,
  tipo_doc           text,
  numero_doc         text,
  direccion_notif    text,
  ciudad             text,
  correo             text,
  telefono           text,
  tipo_credito       text,
  naturaleza_credito text,
  clase_prelacion    text CHECK (clase_prelacion IN
                        ('primera','segunda','tercera','cuarta','quinta')),
  capital            numeric(14,2) NOT NULL DEFAULT 0,
  intereses          numeric(14,2) NOT NULL DEFAULT 0,
  dias_mora          int,
  mas_90_dias_mora   boolean NOT NULL DEFAULT false,
  es_pequeno_acreedor boolean NOT NULL DEFAULT false, -- calculado al consolidar
  info_adicional     text,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_creditors_case ON sgcc_case_creditors(case_id);
```

### 4.4 Bienes

```sql
CREATE TABLE sgcc_case_assets (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id            uuid NOT NULL REFERENCES sgcc_cases(id) ON DELETE CASCADE,
  tipo               text NOT NULL CHECK (tipo IN ('inmueble','mueble','elemento_hogar')),
  descripcion        text,
  valor_estimado     numeric(14,2),
  porcentaje_dominio int,
  gravamen           text,
  -- específicos inmueble
  direccion          text,
  ciudad             text,
  matricula_inmobiliaria text,
  afectacion_vivienda_familiar boolean,
  -- específicos mueble
  marca_modelo       text,
  numero_chasis      text,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_assets_case ON sgcc_case_assets(case_id);
```

### 4.5 Procesos judiciales

```sql
CREATE TABLE sgcc_case_judicial_processes (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id              uuid NOT NULL REFERENCES sgcc_cases(id) ON DELETE CASCADE,
  juzgado_ciudad       text,
  numero_radicado      text,
  demandante           text,
  tipo_proceso         text,
  tiene_embargo_remate boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_judprocs_case ON sgcc_case_judicial_processes(case_id);
```

### 4.6 Propuesta de pago

```sql
CREATE TABLE sgcc_case_payment_plan (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                    uuid NOT NULL REFERENCES sgcc_cases(id) ON DELETE CASCADE,
  clase_prelacion            text NOT NULL,
  tasa_interes_futura_mensual numeric(5,2),
  tasa_interes_espera_mensual numeric(5,2),
  numero_cuotas              int,
  cronograma_json            jsonb, -- [{cuota, capital, intereses_espera, intereses_futuros, saldo, fecha_pago}]
  created_at                 timestamptz NOT NULL DEFAULT now(),
  UNIQUE(case_id, clase_prelacion)
);
```

### 4.7 Adjuntos (extensión de tabla existente)

```sql
ALTER TABLE sgcc_documents
  ADD COLUMN is_draft boolean NOT NULL DEFAULT false,
  ADD COLUMN draft_id uuid REFERENCES sgcc_solicitudes_draft(id) ON DELETE CASCADE,
  ADD COLUMN tipo_anexo text; -- 'cedula','redam','poder','tradicion','soporte_acreencia','ingresos_contador','matricula_mercantil','otro'
CREATE INDEX idx_documents_draft ON sgcc_documents(draft_id) WHERE draft_id IS NOT NULL;
```

### 4.8 RLS

```sql
-- sgcc_solicitudes_draft: cada user solo ve los suyos
ALTER TABLE sgcc_solicitudes_draft ENABLE ROW LEVEL SECURITY;
CREATE POLICY drafts_owner ON sgcc_solicitudes_draft
  FOR ALL USING (user_id = auth.uid());

-- Tablas hijas: hereda políticas de sgcc_cases (allow_all actualmente; queda igual)
ALTER TABLE sgcc_case_creditors ENABLE ROW LEVEL SECURITY;
CREATE POLICY allow_all ON sgcc_case_creditors FOR ALL USING (true) WITH CHECK (true);
-- Idem para sgcc_case_assets, sgcc_case_judicial_processes, sgcc_case_payment_plan.
```

### 4.9 RPC de radicación

```sql
CREATE FUNCTION radicar_solicitud(p_draft_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_draft sgcc_solicitudes_draft%ROWTYPE;
  v_case_id uuid;
  v_numero_radicado text;
BEGIN
  -- 1. Leer draft
  SELECT * INTO v_draft FROM sgcc_solicitudes_draft WHERE id = p_draft_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Draft no encontrado'; END IF;

  -- 2. Validar (ver sección 6) — se hacen validaciones pesadas en el API route;
  --    aquí solo invariantes de integridad (user_id != null, tipo_tramite válido, etc.)

  -- 3. Generar radicado (función existente)
  v_numero_radicado := generar_numero_radicado(v_draft.center_id);

  -- 4. Insertar sgcc_cases
  INSERT INTO sgcc_cases (
    id, center_id, numero_radicado, tipo_tramite, materia, estado,
    descripcion, cuantia, fecha_solicitud,
    tipo_deudor, causa_insolvencia, ingresos_mensuales, gastos_subsistencia_mensual,
    sociedad_conyugal_info, matricula_mercantil, activos_totales,
    juramento_aceptado, solicita_tarifa_especial, creado_por_parte
  )
  VALUES ( ... , true )
  RETURNING id INTO v_case_id;

  -- 5. sgcc_case_parties (convocante = user_id)
  INSERT INTO sgcc_case_parties (case_id, party_id, rol)
  VALUES (v_case_id, v_draft.user_id, 'convocante');

  -- 6. Para insolvencia: insertar hijas iterando el JSONB
  IF v_draft.tipo_tramite = 'insolvencia' THEN
    INSERT INTO sgcc_case_creditors (...) SELECT ... FROM jsonb_to_recordset(v_draft.form_data->'acreedores') AS x(...);
    INSERT INTO sgcc_case_assets (...) SELECT ... FROM jsonb_to_recordset(v_draft.form_data->'bienes') AS x(...);
    INSERT INTO sgcc_case_judicial_processes (...) SELECT ... FROM jsonb_to_recordset(v_draft.form_data->'procesos') AS x(...);
    INSERT INTO sgcc_case_payment_plan (...) SELECT ... FROM jsonb_to_recordset(v_draft.form_data->'propuesta_pago') AS x(...);
  END IF;

  -- 7. Adjuntos: pasar de draft a case
  UPDATE sgcc_documents
  SET is_draft = false, draft_id = null, case_id = v_case_id
  WHERE draft_id = p_draft_id;

  -- 8. Borrar draft
  DELETE FROM sgcc_solicitudes_draft WHERE id = p_draft_id;

  RETURN jsonb_build_object('case_id', v_case_id, 'numero_radicado', v_numero_radicado);
END;
$$;
```

---

## 5. Wizards UI

### 5.1 Conciliación — 5 pasos

1. **Convocado(s)** — datos persona(s) contra quien radica (natural/jurídica).
2. **Materia y hechos** — materia (civil/comercial/laboral/familiar/consumidor/arrendamiento/otro), cuantía (o "indeterminada"), descripción.
3. **Anexos** — opcional (cédula, soportes).
4. **Apoderado** — opcional (si actúa con abogado).
5. **Confirmar** — resumen + aceptar T&C Ley 1581/2012 → Radicar.

### 5.2 Insolvencia — 13 pasos (Ley 2445/2025)

1. **Tipo de deudor** — PNNC o pequeño comerciante. Si comerciante: matrícula mercantil + activos totales. Valida < 1.000 SMLMV (excluye vivienda + vehículo de trabajo).
2. **Supuestos de insolvencia** — validador en vivo: ≥2 acreedores con ≥90 días mora, ≥30% del pasivo en mora. Banner verde/rojo con link a corregir.
3. **Datos del deudor** — prellenado desde perfil (editable).
4. **Causas de la insolvencia** — textarea.
5. **Acreedores** — lista repetible: nombre, doc, dirección notificación judicial, ciudad, tel, email, tipo crédito, naturaleza, clase prelación (1ª–5ª), capital, intereses, días de mora, ¿>90 días? Totales al pie.
6. **Bienes** — 3 sub-tabs: inmuebles (dirección, matrícula, % dominio, gravamen, afectación vivienda familiar), muebles (marca/modelo, chasis, % dominio, gravamen), elementos del hogar (descripción + valor).
7. **Procesos judiciales en contra** — lista: juzgado-ciudad, radicado, demandante, tipo proceso, ¿embargo/remate?
8. **Obligaciones alimentarias + personas a cargo** — monto + beneficiarios + upload obligatorio de **certificado REDAM**.
9. **Ingresos y gastos** — ingresos mensuales + fuentes; gastos: alimentación, salud, arriendo, administración, servicios públicos, educación, cuotas alimentarias, transporte, otros.
10. **Sociedad conyugal/patrimonial** — estado civil + texto.
11. **Propuesta de pago** — por cada clase con acreedores: tasa interés futuro, tasa interés espera, número de cuotas → **cronograma auto-calculado editable** (cuota, capital, intereses, saldo, fecha de pago).
12. **Anexos** — uploads tipados:
    - Copia cédula (obligatorio)
    - Certificado REDAM (obligatorio, Art. 539 #9)
    - Poder (si hay apoderado)
    - Certificado de tradición (por inmueble)
    - Soporte de cada acreencia
    - Certificación de ingresos por contador
    - Matrícula mercantil (obligatorio si pequeño comerciante, Art. 539 #10)
    - Otros
13. **Confirmar** — checkbox juramento (texto literal Art. 539 §1 Ley 2445/2025) + checkbox solicitud de tarifa especial Art. 536 → Radicar.

### 5.3 Patrón UI compartido

- Sidebar izquierda con pasos y estados (✓ completado / ● actual / ○ pendiente).
- Auto-save cada 3 s (debounce) al PATCH del draft; indicador "Guardado 14:32" / "Guardando…" / "Error".
- "Guardar y salir" + "Continuar después" visibles siempre.
- "Siguiente" bloqueado si faltan campos obligatorios del paso; el draft **sí** guarda parcial.
- Barra superior con % completado.
- Responsive (móvil: pasos en drawer, no sidebar).

---

## 6. Validaciones al radicar

Se ejecutan en el API route **antes** de llamar a la RPC. Devuelven `422` con lista de errores y `step` correspondiente.

### Conciliación

| Regla | Error |
|-------|-------|
| ≥1 convocado con datos mínimos (nombre + doc) | "Falta información del convocado" |
| Materia seleccionada | "Selecciona la materia" |
| Descripción no vacía | "Describe el conflicto" |
| T&C aceptados | "Debes aceptar T&C" |

### Insolvencia

| Regla | Art. | Error |
|-------|------|-------|
| `tipo_deudor` seleccionado | — | "Selecciona tipo de deudor" |
| Si comerciante → activos < 1.000 SMLMV | 532 | "Excede el tope de pequeño comerciante" |
| Si comerciante → matrícula mercantil presente y adjunto subido | 539 #10 | "Falta matrícula mercantil" |
| ≥2 acreedores con mora ≥90 días | 538 | "Se requieren ≥2 acreencias en mora ≥90 días" |
| `SUM(capital en mora) / SUM(capital total) ≥ 0.30` | 538 | "La mora debe ser ≥30% del pasivo total" |
| Cada acreedor con clase de prelación | — | "Acreedor #N sin clase" |
| Propuesta cubre toda clase con acreedores | 553 | "Falta propuesta para clase N" |
| Anexo tipo `cedula` | — | "Falta copia de cédula" |
| Anexo tipo `redam` | 539 #9 | "Falta certificado REDAM" |
| Si hay apoderado → anexo `poder` | — | "Falta el poder" |
| `juramento_aceptado = true` | 539 §1 | "Debe aceptar el juramento" |

### Cálculo del pequeño acreedor (post-admisión)

Se ejecuta al **generar la relación definitiva** (no en la solicitud). Algoritmo en `src/lib/solicitudes/small-creditor.ts`:

```
1. total_capital = SUM(capital) de acreedores reconocidos
2. umbral = total_capital * 0.05
3. ordenar acreedores ASC por capital
4. acumular hasta que suma_acumulada + siguiente_capital > umbral
5. todos los iterados son pequeños; el resto, no
6. UPDATE sgcc_case_creditors SET es_pequeno_acreedor = ...
```

---

## 7. Endpoints API

### `POST /api/partes/solicitudes`
Body: `{ tipo_tramite }`. Crea draft vacío con `center_id` del perfil. Devuelve `{ id }`.

### `GET /api/partes/solicitudes`
Lista drafts del usuario. Query opcional: `?tipo=insolvencia`.

### `GET /api/partes/solicitudes/:id`
Devuelve draft completo + adjuntos.

### `PATCH /api/partes/solicitudes/:id`
Body: `{ form_data?, step_actual?, completado_pct? }`. Merge parcial en `form_data`.
Límite: 500 kB de `form_data`. Rate limit: 50/min por user.

### `DELETE /api/partes/solicitudes/:id`
Borra draft + adjuntos (cascade).

### `POST /api/partes/solicitudes/:id/adjuntos`
Multipart: `file` + `tipo_anexo`. Sube a Storage `solicitudes-draft/[userId]/[draftId]/`.
Límites: 10 MB/archivo, 50 MB/draft. Tipos: pdf/jpg/png/docx.

### `DELETE /api/partes/solicitudes/:id/adjuntos/:docId`
Borra adjunto del draft (Storage + BD).

### `POST /api/partes/solicitudes/:id/radicar`
1. Valida (sección 6). Si falla → `422` con lista de errores.
2. Llama `SELECT radicar_solicitud(:id)` (RPC).
3. Envía emails (Resend, si configurado).
4. Devuelve `{ case_id, numero_radicado }`.
Rate limit: 3 radicaciones/hora por user.

---

## 8. Estructura de archivos

```
src/app/(partes)/
├─ layout.tsx                                (existente)
├─ mis-casos/                                (existente, intacto)
├─ mis-solicitudes/                          (NUEVO)
│  ├─ page.tsx                               → lista
│  ├─ MisSolicitudesClient.tsx
│  ├─ nueva/page.tsx                         → selector trámite
│  └─ [id]/
│     ├─ page.tsx                            → shell wizard
│     ├─ WizardShell.tsx                     → sidebar + auto-save
│     ├─ conciliacion/Paso{Convocados,Materia,Anexos,Apoderado,Confirmar}.tsx
│     └─ insolvencia/Paso{TipoDeudor,Supuestos,DatosDeudor,Causas,Acreedores,Bienes,Procesos,AlimentariasRedam,IngresosGastos,SociedadConyugal,PropuestaPago,Anexos,Confirmar}.tsx

src/app/api/partes/solicitudes/
├─ route.ts                                  GET, POST
└─ [id]/
   ├─ route.ts                               GET, PATCH, DELETE
   ├─ adjuntos/route.ts                      POST
   ├─ adjuntos/[docId]/route.ts              DELETE
   └─ radicar/route.ts                       POST

src/hooks/
├─ useDraftAutoSave.ts                       debounce + reintentos
└─ useSolicitudValidation.ts                 valida paso actual + supuestos

src/lib/solicitudes/
├─ validators.ts                             reglas Ley 2445/2025
├─ payment-plan.ts                           cronograma auto
├─ small-creditor.ts                         cálculo 5%
└─ types.ts                                  tipos form_data por trámite

src/components/partes/
├─ PersonaForm.tsx                           reutiliza patrón del widget
├─ RepeatableList.tsx                        filas dinámicas
├─ StepSidebar.tsx
├─ AutoSaveIndicator.tsx
└─ FileUploadBox.tsx                         (reutiliza de staff si existe)

src/app/(auth)/registro/parte/page.tsx       + campo código corto
src/app/api/partes/route.ts                  validar código corto

supabase/migrations/019_portal_partes_solicitudes.sql

docs/superpowers/specs/2026-04-18-portal-partes-solicitudes-design.md
```

---

## 9. Plan de transición del widget público

El widget `/widget/[centerId]` queda **deprecado** pero no se elimina de inmediato:

1. En esta iteración: se añade banner en la página del widget: *"Ahora puedes seguir tu solicitud. Crea tu cuenta y radica con seguimiento completo."* → CTA a `/registro/parte`.
2. En iteración siguiente (tras estabilizar): se retira el widget y su endpoint `/api/widget/solicitud`. No se usa más.
3. Las solicitudes históricas creadas por widget permanecen en `sgcc_cases` sin cambios.

---

## 10. Seguridad

- Rutas `/(partes)/*` exigen `session.user.role === 'parte'` vía `auth()` en cada `page.tsx` server component.
- APIs `/api/partes/*` validan `auth()` y que el recurso pertenezca al `user_id` de sesión (`.eq('user_id', session.user.id)` en toda query) — evita IDOR.
- Storage bucket `solicitudes-draft` con RLS por `userId` en el path.
- Rate limits (ver endpoints).
- Sanitización de uploads: rechazar `.exe`, `.sh`, `.bat`, etc. en servidor por magic bytes + extensión.

---

## 11. Errores y UX

- **PATCH falla** → toast "No se pudo guardar, reintentando…" + reintento exponencial (3 intentos). Form sigue editable.
- **Radicar falla validación** → banner con lista de errores + link al paso de cada uno.
- **Radicar falla RPC** → rollback automático (transacción), draft intacto, mensaje genérico, log server con detalle.
- **Subida falla** → anexo queda sin cargar en UI, botón "Reintentar".
- **Resend no configurado o falla** → radica igual, se loguea. No bloquea.

---

## 12. Testing

- **Unitarios** (Vitest) en `src/lib/solicitudes/`:
  - `validators.ts`: cada regla del Art. 538/539 con fixtures positivo y negativo.
  - `small-creditor.ts`: dataset con 10 acreedores, verifica que la suma de pequeños ≤ 5% del total.
  - `payment-plan.ts`: cronograma con tasa y cuotas conocidas, compara contra tabla esperada.
- **Integración** (Vitest + mock Supabase):
  - CRUD de `/api/partes/solicitudes`.
  - `radicar` con draft válido → caso creado.
  - `radicar` con draft inválido → 422 + draft intacto.
  - `radicar` con falla BD intermedia → rollback, draft intacto.
- **E2E** (opcional, Playwright): flujo conciliación end-to-end con usuario registrado.

---

## 13. Rollout y feature flag

- Migración 019 es **aditiva**: revertir código no rompe nada.
- Env `ENABLE_PORTAL_PARTES_SOLICITUDES=true` en Vercel para activar rutas. Por defecto `false`.
- Para QA: deploy en preview de Vercel, activar flag, probar con usuario seed.
- Para prod: ejecutar migración 019 en Supabase → activar flag → anuncio.

---

## 14. Fuera de alcance de esta iteración

- Acuerdos de apoyo (wizard propio, siguiente iteración).
- Directivas anticipadas (wizard propio, siguiente iteración).
- Arbitraje ejecutivo.
- Firma digital del juramento (hoy solo checkbox; firma cert. va en módulo de firma existente).
- Importación de acreedores desde Excel (hoy solo entrada manual).
- Integración con REDAM para validar automáticamente (hoy solo anexar PDF).
- Cálculo automático de cuotas contra amortización avanzada con capitalización compuesta (hoy cronograma simple editable).

---

## 15. Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| Formulario tan largo que usuarios abandonan | Auto-save real + retomar en cualquier dispositivo. Progreso visible. |
| JSONB de draft crece indefinidamente | Límite 500 kB validado en PATCH. |
| Drafts huérfanos si usuario borra cuenta | `ON DELETE CASCADE`. |
| Drafts abandonados acumulan Storage | Cron semanal borra drafts con `updated_at < now() - 90 days` y `completado_pct < 100`. |
| RPC `radicar_solicitud` compleja y difícil de probar | Escribir primero el SQL + test con fixtures SQL antes de integrar con API. |
| Cambios normativos posteriores (ej. nuevo decreto 2025) | Validadores centralizados en `src/lib/solicitudes/validators.ts` — un solo punto de actualización. |
| Spam de radicaciones | Rate limit 3/hora por user. |
