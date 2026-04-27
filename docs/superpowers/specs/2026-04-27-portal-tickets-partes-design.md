# Portal de Tickets para Partes — Diseño

**Fecha:** 2026-04-27
**Autor:** Brainstorming SD21 + Claude
**Estado:** Aprobado por el dueño del producto, pendiente de implementación.
**Rama de trabajo:** `feature/portal-tickets-partes`
**Migración:** `supabase/migrations/029_tickets_partes.sql`

---

## 1. Contexto

El módulo de tickets de SGCC (mergeado el 2026-04-18, tabla `sgcc_tickets`) hoy solo lo usa staff: admins y conciliadores abren, asignan y responden tickets internos. Las partes (convocantes, convocados, apoderados) no tienen ningún canal estructurado para pedir ayuda al centro: cualquier duda sobre un trámite hoy se resuelve por canales informales.

Este diseño extiende el módulo existente para que las partes abran tickets desde su portal (`/mis-tickets`), atados o no a un caso, con adjuntos múltiples, y que el staff los reciba en su bandeja unificada (mismo `/tickets` actual, con badge de origen).

## 2. Decisiones de producto

Las 6 decisiones que enmarcan este diseño (resueltas en brainstorming):

| # | Pregunta | Decisión |
|---|---|---|
| Q1 | ¿Atados a un caso o libres? | **Ambos:** `case_id` opcional; cuando hay caso, se valida ownership de la parte sobre ese caso. |
| Q2 | ¿Dónde se accede en el portal? | **Sidebar dedicado:** link "Tickets" → `/mis-tickets` (lista + crear + detalle). |
| Q3 | ¿Qué categorías ven las partes? | **Una sola fija:** `consulta_parte`. La parte no escoge categoría; el formulario es solo título + descripción + caso opcional + adjuntos. |
| Q4 | ¿Quién cierra? | **Staff y la parte propietaria.** La parte solo cierra los suyos; el staff cierra cualquiera del centro. |
| Q5 | ¿A quién notifica al staff cuando abre la parte? | **Solo a admins del centro.** No al conciliador asignado al caso. |
| Q6 | ¿Adjuntos? | **Múltiples archivos** vía tabla aparte `sgcc_ticket_adjuntos`. Hasta 5 archivos por ticket en v1, 10 MB máx por archivo. |

## 3. Modelo de datos

Migración `supabase/migrations/029_tickets_partes.sql`:

```sql
-- 3.1 Extender sgcc_tickets ----------------------------------------------

-- FK opcional al solicitante cuando es una parte
ALTER TABLE sgcc_tickets
  ADD COLUMN IF NOT EXISTS solicitante_party_id UUID REFERENCES sgcc_parties(id) ON DELETE SET NULL;

-- Constraint XOR: exactamente una de las dos FKs debe estar set
ALTER TABLE sgcc_tickets
  ADD CONSTRAINT sgcc_tickets_solicitante_check CHECK (
    (solicitante_staff_id IS NOT NULL AND solicitante_party_id IS NULL) OR
    (solicitante_staff_id IS NULL AND solicitante_party_id IS NOT NULL)
  );

-- Ampliar el CHECK de categoría para aceptar 'consulta_parte'
ALTER TABLE sgcc_tickets DROP CONSTRAINT IF EXISTS sgcc_tickets_categoria_check;
ALTER TABLE sgcc_tickets ADD CONSTRAINT sgcc_tickets_categoria_check
  CHECK (categoria IN ('soporte', 'administrativo', 'operativo', 'consulta_parte'));

-- Índice para "mis tickets" del portal de partes
CREATE INDEX IF NOT EXISTS idx_tickets_solicitante_party
  ON sgcc_tickets(solicitante_party_id);

-- 3.2 Tabla nueva sgcc_ticket_adjuntos -----------------------------------

CREATE TABLE IF NOT EXISTS sgcc_ticket_adjuntos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       UUID NOT NULL REFERENCES sgcc_tickets(id) ON DELETE CASCADE,
  nombre_archivo  TEXT NOT NULL,
  storage_path    TEXT NOT NULL,
  url             TEXT NOT NULL,
  mime_type       TEXT,
  tamano_bytes    INTEGER,
  subido_por_party UUID REFERENCES sgcc_parties(id) ON DELETE SET NULL,
  subido_por_staff UUID REFERENCES sgcc_staff(id)  ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sgcc_ticket_adjuntos_uploader_check CHECK (
    (subido_por_party IS NOT NULL AND subido_por_staff IS NULL) OR
    (subido_por_party IS NULL AND subido_por_staff IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_ticket_adjuntos_ticket
  ON sgcc_ticket_adjuntos(ticket_id);

ALTER TABLE sgcc_ticket_adjuntos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON sgcc_ticket_adjuntos FOR ALL USING (TRUE);
```

**Notas de la migración:**

- Se usa `gen_random_uuid()` (en `pg_catalog`, PG 13+) para no depender del schema `extensions` — ya aprendimos la lección hoy con el RPC `radicar_solicitud`.
- El constraint XOR de solicitantes garantiza integridad: nunca un ticket sin solicitante ni con dos.
- Path de storage: `tickets/<center_id>/<ticket_id>/<uuid>.<ext>` en el bucket `sgcc-documents` (que ya existe en prod desde la migración 003).
- RLS `allow_all` mantiene el patrón del módulo SGCC: el control real se hace en la capa de API, los endpoints usan `supabaseAdmin` (service role) y la anon key sigue bloqueada por el blindaje del 2026-04-26.

## 4. APIs

### 4.1 Nuevas rutas para partes (auth: `requireParte()`)

| Método | Ruta | Función |
|---|---|---|
| `GET` | `/api/partes/tickets` | Lista tickets del solicitante. Query params opcionales: `estado`, `case_id`. |
| `POST` | `/api/partes/tickets` | Crear ticket. Body: `titulo`, `descripcion`, `case_id?`, `prioridad?` (default `Normal`). Categoría se forza a `consulta_parte`. Notifica a admins del centro. |
| `GET` | `/api/partes/tickets/[id]` | Detalle del ticket (solo si `solicitante_party_id === userId`). Incluye adjuntos. |
| `PATCH` | `/api/partes/tickets/[id]` | Solo permite cambiar `estado` a `Cerrado`. Cualquier otro campo o estado distinto → 403. |
| `POST` | `/api/partes/tickets/[id]/adjuntos` | Subir archivo (multipart). Reusa `uploadFile()` → bucket `sgcc-documents`. Falla si el ticket está cerrado o ya tiene 5 adjuntos. |
| `DELETE` | `/api/partes/tickets/[id]/adjuntos/[adjuntoId]` | Solo si `subido_por_party === guard.userId` y ticket no está cerrado. |

### 4.2 Cambios en rutas de staff existentes

- `GET /api/tickets`: el `select` se amplía para incluir `solicitante_party_id` + JOIN a `sgcc_parties` (nombre/email del solicitante cuando es parte). Nuevo query param: `?origen=parte|staff|todos` (default `todos`).
- `PATCH /api/tickets/[id]`: la lógica de ownership ya no asume que el solicitante es siempre staff. Cuando el solicitante es una parte, los permisos de edición del staff (admin / asignado) siguen igual; el "solicitante" pierde permisos en ese flujo (irrelevante porque la parte usa otro endpoint).
- Nuevo: `POST /api/tickets/[id]/adjuntos` (espejo del de partes con auth de staff). Para que el staff adjunte archivos en su respuesta. Inserta con `subido_por_staff`.

### 4.3 Validaciones

**Adjuntos** (mismo patrón que `/api/partes/documentos`):
- MIME permitidos: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`.
- Máx 10 MB por archivo.
- Máx 5 archivos por ticket (configurable como constante en código).

**Crear ticket con `case_id`** (anti-bypass):
```ts
if (caseId) {
  const { data: caseParty } = await supabaseAdmin
    .from("sgcc_case_parties")
    .select("id, caso:sgcc_cases!inner(center_id)")
    .eq("case_id", caseId)
    .eq("party_id", guard.userId)
    .maybeSingle();
  if (!caseParty) return NextResponse.json({ error: "No tiene acceso a este caso" }, { status: 403 });
  centerId = caseParty.caso.center_id;
}
```

Si NO hay `case_id`, `centerId` se infiere de `sgcc_parties.center_id` del solicitante.

## 5. UI portal de partes

### 5.1 Sidebar
Agregar link "Tickets" con icono `LifeBuoy` (lucide-react) en el sidebar del grupo `(partes)`. Posición: debajo de "Mis casos".

### 5.2 `/mis-tickets` — lista
- Header: título "Mis tickets" + botón primario "Nuevo ticket".
- Tabla responsive: columnas `Título`, `Caso` (numero_radicado o "—"), `Estado`, `Última actualización`.
- Estado coloreado con badges (igual al módulo staff): Pendiente=gris, EnRevision=azul, Respondido=verde, Cerrado=neutro.
- Empty state: "Aún no has abierto ningún ticket. Si necesitas ayuda con un trámite, abre uno aquí."
- Filtro pills: `Todos | Abiertos | Cerrados`.
- Click en fila → `/mis-tickets/<id>`.

### 5.3 `/mis-tickets/nuevo` — crear
Form con:
- Título (input, requerido, máx 200)
- Descripción (textarea, requerido, máx 2000)
- Caso relacionado (select opcional con casos del usuario; primer item: "Sin caso específico")
- Prioridad (select: Normal, Media, Alta — default Normal)
- Adjuntos (input multi-archivo, hasta 5)

Botones: Cancelar / Crear ticket. Al crear → redirect a `/mis-tickets/<id>` con toast de confirmación.

### 5.4 `/mis-tickets/[id]` — detalle
Layout vertical estilo "thread":
1. **Cabecera:** título, badge de estado, badge de prioridad, fecha de creación, link al expediente si hay `case_id`.
2. **Mi mensaje:** descripción + adjuntos subidos por la parte.
3. **Respuesta del staff:** nombre, fecha, contenido. Si no hay → "Esperando respuesta del centro…".
4. **Adjuntos del staff** (si aplica).
5. **Acciones:** botón "Marcar como resuelto" (con confirmación) si el ticket no está cerrado; mensaje "Cerrado el <fecha>" si lo está.
6. **Subir adjunto adicional**: input para agregar más archivos mientras el ticket no esté cerrado; botón "Borrar" en cada adjunto propio (solo).

### 5.5 Componentes reutilizables
Extraer del módulo staff existente a `src/components/tickets/`:
- `TicketEstadoBadge.tsx`
- `TicketPrioridadBadge.tsx`

Nuevo:
- `AdjuntosUpload.tsx` — wrapper sobre `<input type="file" multiple>` con drag&drop básico y validación cliente.

## 6. UI staff (cambios mínimos)

### 6.1 `TicketsClient.tsx`
- Columna "Solicitante" muestra nombre del staff o nombre de la parte + badge "Parte".
- Filtro pills nuevo: `Todos | Internos | De partes` (mapea a `?origen`).
- KPI extra "Tickets de partes abiertos".

### 6.2 Modal "Responder ticket"
- Si el solicitante es parte: muestra badge "consulta de parte" en el header.
- Sección "Mensaje original + adjuntos de la parte" (links descargables).
- Sección "Mi respuesta" + `<input type="file" multiple>` para que el staff adjunte archivos. Reusa `<AdjuntosUpload>`.
- Al guardar: actualiza `respuesta` + `estado` y sube adjuntos del staff a `sgcc_ticket_adjuntos` con `subido_por_staff`.

### 6.3 Sidebar staff
Sin cambios — el link "Tickets" ya existe.

**Trade-off explícito:** no agregamos panel separado "Bandeja de tickets de partes". Reutilizamos lista existente con filtro. Razón: menos código, menos divergencia. Si crece el volumen y el staff pide separación, se hace después con el mismo backend.

## 7. Notificaciones

Se aprovecha `notify()` (in-app + email Resend ya configurado).

| Evento | Disparador | Destinatarios | Tipo |
|---|---|---|---|
| Parte abre ticket | `POST /api/partes/tickets` | Admins del centro | `ticket_nuevo` |
| Staff responde a ticket de parte | `PATCH /api/tickets/[id]` con respuesta | La parte solicitante | `ticket_respondido` |
| Parte cierra su ticket | `PATCH /api/partes/tickets/[id]` con estado=Cerrado | Admins del centro (informativo) | `ticket_respondido` |
| Staff cierra ticket de parte | `PATCH /api/tickets/[id]` con estado=Cerrado | La parte solicitante | `ticket_respondido` |

**Decisiones explícitas:**
- No notificar al staff cuando una parte agrega adjuntos a un ticket abierto (los verán al responder).
- No notificar al conciliador del caso (Q5: solo admins). Se puede revisar en una iteración futura.

**Plantilla de email para partes:** subject `Respuesta a tu ticket: <titulo>` (o `Tu ticket fue cerrado` si solo cierra), cuerpo corto + link a `/mis-tickets/<id>`. Si las plantillas viven en archivo separado y existe un copy genérico de "ticket_respondido" pensado para staff, se agrega una variante específica para partes (`ticket_respondido_party`); si no, se pasa un `mensaje` distinto al `notify()` existente.

**In-app para partes:** durante implementación verificar si ya existe un componente `NotificationBell` en `src/app/(partes)/`. Si no existe, dejar solo email para v1 y guardar memoria con TODO para una bandeja in-app de partes en una iteración futura.

## 8. Permisos y seguridad

### 8.1 Auth
- Endpoints `/api/partes/tickets/*`: `requireParte()` (NextAuth con `userType === "party"`).
- Endpoints `/api/tickets/*`: `auth()` + check de staff (sin cambios).

### 8.2 Ownership
Cada endpoint para partes verifica `solicitante_party_id === guard.userId` antes de operar. Para `case_id` opcional al crear, se valida que la parte pertenezca al caso vía `sgcc_case_parties`.

### 8.3 Adjuntos
- Subida via `uploadFile()` al bucket `sgcc-documents`.
- Path: `tickets/<center_id>/<ticket_id>/<uuid>.<ext>`.
- URL pública (consistente con el resto del módulo de documentos). Trade-off conocido: bucket público; si se necesita privacidad real, se cambia a signed URLs en iteración separada.
- DELETE: solo el uploader puede borrar su propio adjunto, y solo mientras el ticket no esté cerrado.

### 8.4 RLS
Patrón estándar SGCC: ENABLE RLS + policy `allow_all` + acceso solo via service_role en endpoints. La anon key sigue bloqueada por el blindaje del 2026-04-26.

### 8.5 Rate limiting
Pendiente fuera de este spec — el portal de partes aún no tiene rate limit (memoria 2026-04-26 lo marca pendiente para `widget/solicitud`). Cuando se implemente, se extiende a `/api/partes/tickets`.

### 8.6 Auditoría
`created_at` y `updated_at` ya existen. No se añade audit log dedicado — patrón actual de SGCC no lo tiene para tickets de staff y mantenemos consistencia.

## 9. Tipos TypeScript

Actualizar `src/types/index.ts`:

- `TicketCategoria` agrega `'consulta_parte'`.
- `SgccTicket` agrega `solicitante_party_id: string | null`.
- Nuevo tipo `SgccTicketAdjunto` con los campos de la tabla `sgcc_ticket_adjuntos`.
- `SgccTicketConRelaciones` (si existe) agrega `solicitante_party?: SgccParty | null` y `adjuntos?: SgccTicketAdjunto[]`.

## 10. Plan de pruebas

### 10.1 Pruebas manuales
- [ ] Aplicar migración `029_tickets_partes.sql` en Supabase prod.
- [ ] Tercero accede a `/mis-tickets` desde el sidebar.
- [ ] Tercero crea ticket sin caso → admins reciben email + in-app.
- [ ] Tercero crea ticket con caso → admins reciben email; el caso aparece en la lista del staff.
- [ ] Tercero intenta crear ticket con `case_id` de otro caso → 403.
- [ ] Tercero sube 3 adjuntos → todos quedan listados; tercero borra uno → solo borra el suyo.
- [ ] Tercero intenta subir 6º adjunto → 400.
- [ ] Staff responde con adjunto → tercero recibe email + ve respuesta y adjunto en `/mis-tickets/<id>`.
- [ ] Tercero cierra ticket → staff recibe in-app; tercero ya no ve botón "Marcar resuelto".
- [ ] Staff cierra ticket → tercero recibe email; sus inputs de adjuntar quedan deshabilitados.

### 10.2 Edge cases
- [ ] Tercero hace `PATCH /api/partes/tickets/[id]` con `titulo` distinto → 403.
- [ ] Tercero accede a `/api/partes/tickets/[id]` de otro tercero → 404 (silencioso, no 403, para no leak existencia).
- [ ] Adjunto >10 MB → 413.
- [ ] Adjunto con MIME no permitido (.exe, .zip) → 415.
- [ ] Crear ticket con `descripcion` >2000 chars → 400.

## 11. Fuera de alcance (futuras iteraciones)

- Bandeja de notificaciones in-app para partes (si no existe hoy).
- Signed URLs para adjuntos privados.
- Rate limiting en endpoints de partes.
- Notificación al conciliador asignado al caso (Q5 quedó solo admins).
- Hilo de respuestas múltiples (hoy: una sola respuesta del staff).
- SLA / tiempos máximos de respuesta.
- Plantillas de respuesta del staff.
- Búsqueda full-text en tickets.
