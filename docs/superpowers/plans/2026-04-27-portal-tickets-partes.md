# Portal de Tickets para Partes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** permitir que las partes (convocantes, convocados, apoderados) abran tickets desde el portal `/mis-tickets` con adjuntos múltiples, atados o no a un caso, y que el staff los reciba en su bandeja unificada con badges de origen.

**Architecture:** se extiende la tabla existente `sgcc_tickets` con `solicitante_party_id` + check XOR; tabla nueva `sgcc_ticket_adjuntos` (múltiples archivos en `sgcc-documents`); 6 nuevas rutas REST bajo `/api/partes/tickets/*` con `requireParte()`; 3 cambios mínimos a rutas staff existentes; UI portal partes con link en header + 3 páginas; UI staff con badge origen + filtro + uploader en respuesta; notificaciones reusando `notify()`.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Supabase (Postgres + Storage), NextAuth v5, Resend (email), Tailwind, lucide-react, React 19.

**Spec:** `docs/superpowers/specs/2026-04-27-portal-tickets-partes-design.md` (commit 3f674cc).

**Working branch:** `feature/portal-tickets-partes` (ya creada, contiene el spec).

**Verificación:** SGCC no tiene framework de tests. Cada tarea verifica con `npm run lint` (errores mostrados) y al final `npm run build` (typecheck completo). Las pruebas funcionales son manuales y están listadas en la sección 10 del spec.

---

## File Structure

**Crear:**
- `supabase/migrations/029_tickets_partes.sql`
- `src/app/api/partes/tickets/route.ts` — GET (lista) + POST (crear)
- `src/app/api/partes/tickets/[id]/route.ts` — GET (detalle) + PATCH (cerrar)
- `src/app/api/partes/tickets/[id]/adjuntos/route.ts` — POST (subir)
- `src/app/api/partes/tickets/[id]/adjuntos/[adjuntoId]/route.ts` — DELETE
- `src/app/api/tickets/[id]/adjuntos/route.ts` — POST (staff sube adjunto en respuesta)
- `src/components/tickets/TicketEstadoBadge.tsx`
- `src/components/tickets/TicketPrioridadBadge.tsx`
- `src/components/tickets/AdjuntosUpload.tsx`
- `src/app/(partes)/mis-tickets/page.tsx` — server component (lista)
- `src/app/(partes)/mis-tickets/MisTicketsClient.tsx` — client (filtro + tabla)
- `src/app/(partes)/mis-tickets/nuevo/page.tsx`
- `src/app/(partes)/mis-tickets/nuevo/NuevoTicketForm.tsx`
- `src/app/(partes)/mis-tickets/[id]/page.tsx`
- `src/app/(partes)/mis-tickets/[id]/TicketDetalleClient.tsx`

**Modificar:**
- `src/types/index.ts` — extender `TicketCategoria`, `SgccTicket`, agregar `SgccTicketAdjunto`
- `src/app/api/tickets/route.ts` — GET incluye `solicitante_party` + filtro `?origen=`
- `src/app/api/tickets/[id]/route.ts` — PATCH notifica también a `solicitante_party_id` cuando aplica
- `src/app/(partes)/layout.tsx` — agregar link "Tickets" en navegación
- `src/app/(staff)/tickets/TicketsClient.tsx` — badge origen + filtro origen + KPI + uploader en modal respuesta

**Cada tarea = un commit.** Granularidad: ~10-30 minutos de trabajo por tarea.

---

## Task 1: Migración SQL 029 (extender sgcc_tickets + tabla sgcc_ticket_adjuntos)

**Files:**
- Create: `supabase/migrations/029_tickets_partes.sql`

- [ ] **Step 1: Crear el archivo de migración con el SQL completo**

```sql
-- supabase/migrations/029_tickets_partes.sql
-- Habilitar tickets abiertos por partes (convocantes/convocados/apoderados).
-- Extiende sgcc_tickets con solicitante_party_id (XOR vs solicitante_staff_id),
-- amplía la categoría con 'consulta_parte' y agrega tabla sgcc_ticket_adjuntos
-- para múltiples archivos por ticket.

-- ─── 1. Extender sgcc_tickets ─────────────────────────────────────────────

ALTER TABLE sgcc_tickets
  ADD COLUMN IF NOT EXISTS solicitante_party_id UUID REFERENCES sgcc_parties(id) ON DELETE SET NULL;

-- Eliminar el check viejo (si existe) antes de recrear
ALTER TABLE sgcc_tickets DROP CONSTRAINT IF EXISTS sgcc_tickets_solicitante_check;

-- XOR: exactamente una de las dos FKs debe estar set
ALTER TABLE sgcc_tickets ADD CONSTRAINT sgcc_tickets_solicitante_check CHECK (
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

-- ─── 2. Tabla sgcc_ticket_adjuntos ────────────────────────────────────────

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

COMMENT ON COLUMN sgcc_tickets.solicitante_party_id IS
  'FK a sgcc_parties cuando el ticket lo abrió una parte (no staff). XOR con solicitante_staff_id.';
COMMENT ON TABLE sgcc_ticket_adjuntos IS
  'Adjuntos de un ticket. Hasta 5 por ticket (validado en app). Bucket: sgcc-documents.';
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/029_tickets_partes.sql
git commit -m "feat(sgcc): migración 029 — tickets de partes (sgcc_tickets + sgcc_ticket_adjuntos)"
```

- [ ] **Step 3: Aplicar migración en Supabase prod (manual)**

Copiar al portapapeles el contenido del archivo y pegarlo en el SQL Editor de Supabase prod (`vciifcfppebjpqdawwzh`). Comando para copiar:

```bash
cat supabase/migrations/029_tickets_partes.sql | clip
```

Esperado tras Run en Supabase: `Success. No rows returned.` Si falla por algún CHECK pre-existente, eliminar el constraint manualmente y reintentar.

---

## Task 2: Tipos TypeScript

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Editar `TicketCategoria` para incluir `'consulta_parte'`**

En `src/types/index.ts` línea 424, reemplazar:

```ts
export type TicketCategoria = "soporte" | "administrativo" | "operativo";
```

por:

```ts
export type TicketCategoria = "soporte" | "administrativo" | "operativo" | "consulta_parte";
```

- [ ] **Step 2: Editar `SgccTicket` para incluir `solicitante_party_id`**

En `src/types/index.ts` línea 437, después de `solicitante_staff_id: string | null;`, agregar:

```ts
  solicitante_party_id: string | null;
```

- [ ] **Step 3: Agregar interface `SgccTicketAdjunto`**

Al final de la sección "Tickets" (después de la cerradura `}` de `SgccTicket`), agregar:

```ts
export interface SgccTicketAdjunto {
  id: string;
  ticket_id: string;
  nombre_archivo: string;
  storage_path: string;
  url: string;
  mime_type: string | null;
  tamano_bytes: number | null;
  subido_por_party: string | null;
  subido_por_staff: string | null;
  created_at: string;
}
```

- [ ] **Step 4: Verificar tipos**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | head -30
```

Expected: sin errores. Si aparecen errores en archivos que usan `TicketCategoria` con switch exhaustivo, dejarlos para la tarea correspondiente.

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(sgcc): tipos para tickets de partes (consulta_parte + SgccTicketAdjunto)"
```

---

## Task 3: API `GET/POST /api/partes/tickets`

**Files:**
- Create: `src/app/api/partes/tickets/route.ts`

- [ ] **Step 1: Crear el archivo con GET (lista) y POST (crear)**

Contenido completo de `src/app/api/partes/tickets/route.ts`:

```ts
// src/app/api/partes/tickets/route.ts
// GET: lista tickets de la parte autenticada (filtros opcionales estado, case_id).
// POST: crea ticket nuevo. Categoría se forza a 'consulta_parte'. Si se envía
// case_id, se valida que la parte pertenezca al caso. Notifica a admins del centro.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireParte } from "@/lib/partes/auth-guard";
import { notify } from "@/lib/notifications";
import { randomUUID } from "crypto";
import type { TicketEstado, TicketPrioridad } from "@/types";

const PRIORIDADES_VALIDAS: TicketPrioridad[] = ["Normal", "Media", "Alta"];
const ESTADOS_FILTRO: TicketEstado[] = ["Pendiente", "EnRevision", "Respondido", "Cerrado"];

export async function GET(req: NextRequest) {
  const guard = await requireParte();
  if ("error" in guard) return guard.error;

  const { searchParams } = new URL(req.url);
  const estado = searchParams.get("estado");
  const caseId = searchParams.get("case_id");

  let query = supabaseAdmin
    .from("sgcc_tickets")
    .select(`
      *,
      caso:sgcc_cases(id, numero_radicado),
      respondedor:sgcc_staff!sgcc_tickets_respondido_por_fkey(id, nombre)
    `)
    .eq("solicitante_party_id", guard.userId)
    .order("created_at", { ascending: false });

  if (estado && ESTADOS_FILTRO.includes(estado as TicketEstado)) {
    query = query.eq("estado", estado);
  }
  if (caseId) query = query.eq("case_id", caseId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const guard = await requireParte();
  if ("error" in guard) return guard.error;

  const body = await req.json();
  const titulo = String(body.titulo ?? "").trim();
  const descripcion = body.descripcion ? String(body.descripcion).trim() : null;
  const prioridad: TicketPrioridad = PRIORIDADES_VALIDAS.includes(body.prioridad)
    ? body.prioridad
    : "Normal";
  const caseId = body.case_id ? String(body.case_id) : null;

  if (!titulo) {
    return NextResponse.json({ error: "El título es requerido" }, { status: 400 });
  }
  if (titulo.length > 200) {
    return NextResponse.json({ error: "El título no puede exceder 200 caracteres" }, { status: 400 });
  }
  if (descripcion && descripcion.length > 2000) {
    return NextResponse.json({ error: "La descripción no puede exceder 2000 caracteres" }, { status: 400 });
  }

  // Resolver center_id: si hay case_id, validar ownership y heredar centro.
  // Si no, usar el center_id de la parte.
  let centerId: string | null = guard.centerId;
  if (caseId) {
    const { data: caseParty } = await supabaseAdmin
      .from("sgcc_case_parties")
      .select("id, caso:sgcc_cases!inner(id, center_id)")
      .eq("case_id", caseId)
      .eq("party_id", guard.userId)
      .maybeSingle();
    if (!caseParty) {
      return NextResponse.json({ error: "No tiene acceso a este caso" }, { status: 403 });
    }
    centerId = (caseParty as any).caso.center_id;
  }
  if (!centerId) {
    return NextResponse.json(
      { error: "No se pudo determinar el centro. Contacte al centro o adjunte un caso." },
      { status: 400 }
    );
  }

  const ticketId = randomUUID();
  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("sgcc_tickets")
    .insert({
      id: ticketId,
      center_id: centerId,
      case_id: caseId,
      titulo,
      descripcion,
      categoria: "consulta_parte",
      prioridad,
      estado: "Pendiente",
      solicitante_party_id: guard.userId,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notificar a admins del centro (Q5)
  try {
    const { data: admins } = await supabaseAdmin
      .from("sgcc_staff")
      .select("id, email")
      .eq("center_id", centerId)
      .eq("activo", true)
      .eq("rol", "admin");

    const recipients = (admins ?? []).map((a) => ({
      staffId: a.id,
      email: a.email ?? undefined,
    }));

    if (recipients.length > 0) {
      const { data: parte } = await supabaseAdmin
        .from("sgcc_parties")
        .select("nombres, apellidos, razon_social, email")
        .eq("id", guard.userId)
        .maybeSingle();
      const nombreParte =
        [parte?.nombres, parte?.apellidos].filter(Boolean).join(" ") ||
        parte?.razon_social ||
        parte?.email ||
        "una parte";

      await notify({
        centerId,
        caseId: caseId ?? undefined,
        tipo: "ticket_nuevo",
        titulo: `🎫 Nuevo ticket de parte — ${titulo}`,
        mensaje: `${nombreParte} ha abierto un ticket con prioridad ${prioridad}.${
          descripcion ? `\n\n${descripcion}` : ""
        }`,
        recipients,
        canal: "both",
      });
    }
  } catch (e) {
    console.error("[partes/tickets] Error notificando ticket nuevo:", e);
  }

  return NextResponse.json(data, { status: 201 });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/partes/tickets/route.ts
git commit -m "feat(sgcc): GET/POST /api/partes/tickets — lista y creación de tickets de partes"
```

---

## Task 4: API `GET/PATCH /api/partes/tickets/[id]`

**Files:**
- Create: `src/app/api/partes/tickets/[id]/route.ts`

- [ ] **Step 1: Crear archivo con GET (detalle con adjuntos) y PATCH (solo cerrar)**

Contenido completo de `src/app/api/partes/tickets/[id]/route.ts`:

```ts
// src/app/api/partes/tickets/[id]/route.ts
// GET: detalle del ticket de la parte (con adjuntos) — verifica ownership.
// PATCH: solo permite cambiar estado a 'Cerrado'. Cualquier otro cambio → 403.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireParte } from "@/lib/partes/auth-guard";
import { notify } from "@/lib/notifications";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireParte();
  if ("error" in guard) return guard.error;
  const { id } = await params;

  const { data: ticket, error } = await supabaseAdmin
    .from("sgcc_tickets")
    .select(`
      *,
      caso:sgcc_cases(id, numero_radicado),
      respondedor:sgcc_staff!sgcc_tickets_respondido_por_fkey(id, nombre)
    `)
    .eq("id", id)
    .eq("solicitante_party_id", guard.userId)
    .maybeSingle();

  if (error || !ticket) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }

  // Cargar adjuntos en paralelo con info del uploader
  const { data: adjuntos } = await supabaseAdmin
    .from("sgcc_ticket_adjuntos")
    .select("*")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });

  return NextResponse.json({ ...ticket, adjuntos: adjuntos ?? [] });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireParte();
  if ("error" in guard) return guard.error;
  const { id } = await params;
  const body = await req.json();

  // Solo se permite cerrar el ticket: cualquier otro campo → 403
  const keys = Object.keys(body);
  if (keys.length !== 1 || keys[0] !== "estado" || body.estado !== "Cerrado") {
    return NextResponse.json(
      { error: "Las partes solo pueden cerrar el ticket" },
      { status: 403 }
    );
  }

  // Verificar ownership
  const { data: ticket } = await supabaseAdmin
    .from("sgcc_tickets")
    .select("id, center_id, titulo, estado")
    .eq("id", id)
    .eq("solicitante_party_id", guard.userId)
    .maybeSingle();
  if (!ticket) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }
  if (ticket.estado === "Cerrado") {
    return NextResponse.json({ error: "El ticket ya está cerrado" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("sgcc_tickets")
    .update({ estado: "Cerrado", updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notificación informativa a admins del centro (Q4)
  try {
    const { data: admins } = await supabaseAdmin
      .from("sgcc_staff")
      .select("id, email")
      .eq("center_id", ticket.center_id)
      .eq("activo", true)
      .eq("rol", "admin");
    const recipients = (admins ?? []).map((a) => ({
      staffId: a.id,
      email: a.email ?? undefined,
    }));
    if (recipients.length > 0) {
      await notify({
        centerId: ticket.center_id,
        tipo: "ticket_respondido",
        titulo: `✅ Ticket cerrado por la parte — ${ticket.titulo}`,
        mensaje: `La parte cerró el ticket "${ticket.titulo}".`,
        recipients,
        canal: "in_app",
      });
    }
  } catch (e) {
    console.error("[partes/tickets PATCH] Error notificando cierre:", e);
  }

  return NextResponse.json(data);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/partes/tickets/[id]/route.ts
git commit -m "feat(sgcc): GET/PATCH /api/partes/tickets/[id] — detalle y cierre por la parte"
```

---

## Task 5: API `POST /api/partes/tickets/[id]/adjuntos`

**Files:**
- Create: `src/app/api/partes/tickets/[id]/adjuntos/route.ts`

- [ ] **Step 1: Crear archivo con POST (subir adjunto, máx 5 por ticket)**

Contenido completo de `src/app/api/partes/tickets/[id]/adjuntos/route.ts`:

```ts
// src/app/api/partes/tickets/[id]/adjuntos/route.ts
// POST: sube un adjunto al ticket. Verifica ownership, ticket no cerrado y
// límite de 5 adjuntos por ticket. Storage: bucket sgcc-documents.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, uploadFile } from "@/lib/supabase";
import { requireParte } from "@/lib/partes/auth-guard";
import { randomUUID } from "crypto";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_ADJUNTOS = 5;
const MIME_PERMITIDOS = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireParte();
  if ("error" in guard) return guard.error;
  const { id: ticketId } = await params;

  // Ownership + estado
  const { data: ticket } = await supabaseAdmin
    .from("sgcc_tickets")
    .select("id, center_id, estado")
    .eq("id", ticketId)
    .eq("solicitante_party_id", guard.userId)
    .maybeSingle();
  if (!ticket) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }
  if (ticket.estado === "Cerrado") {
    return NextResponse.json(
      { error: "No puede subir adjuntos a un ticket cerrado" },
      { status: 400 }
    );
  }

  // Límite de adjuntos
  const { count } = await supabaseAdmin
    .from("sgcc_ticket_adjuntos")
    .select("id", { count: "exact", head: true })
    .eq("ticket_id", ticketId);
  if ((count ?? 0) >= MAX_ADJUNTOS) {
    return NextResponse.json(
      { error: `Máximo ${MAX_ADJUNTOS} adjuntos por ticket` },
      { status: 400 }
    );
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Archivo excede 10 MB" }, { status: 413 });
  }
  if (!MIME_PERMITIDOS.has(file.type)) {
    return NextResponse.json(
      { error: "Tipo no permitido (PDF, JPG, PNG, WebP)" },
      { status: 415 }
    );
  }

  // Subir a Storage
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const storagePath = `tickets/${ticket.center_id}/${ticketId}/${randomUUID()}.${ext}`;
  let url: string;
  try {
    url = await uploadFile(file, "sgcc-documents", storagePath, file.type);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error subiendo archivo" },
      { status: 500 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("sgcc_ticket_adjuntos")
    .insert({
      ticket_id: ticketId,
      nombre_archivo: file.name,
      storage_path: storagePath,
      url,
      mime_type: file.type,
      tamano_bytes: file.size,
      subido_por_party: guard.userId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/partes/tickets/[id]/adjuntos/route.ts
git commit -m "feat(sgcc): POST /api/partes/tickets/[id]/adjuntos — subir adjunto a ticket"
```

---

## Task 6: API `DELETE /api/partes/tickets/[id]/adjuntos/[adjuntoId]`

**Files:**
- Create: `src/app/api/partes/tickets/[id]/adjuntos/[adjuntoId]/route.ts`

- [ ] **Step 1: Crear archivo con DELETE (solo uploader puede borrar)**

Contenido completo:

```ts
// src/app/api/partes/tickets/[id]/adjuntos/[adjuntoId]/route.ts
// DELETE: elimina un adjunto del ticket. Solo si el uploader es la parte
// autenticada y el ticket no está cerrado.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, deleteFile } from "@/lib/supabase";
import { requireParte } from "@/lib/partes/auth-guard";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; adjuntoId: string }> }
) {
  const guard = await requireParte();
  if ("error" in guard) return guard.error;
  const { id: ticketId, adjuntoId } = await params;

  // Verificar que el ticket es de la parte y no está cerrado
  const { data: ticket } = await supabaseAdmin
    .from("sgcc_tickets")
    .select("id, estado")
    .eq("id", ticketId)
    .eq("solicitante_party_id", guard.userId)
    .maybeSingle();
  if (!ticket) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }
  if (ticket.estado === "Cerrado") {
    return NextResponse.json(
      { error: "No puede borrar adjuntos de un ticket cerrado" },
      { status: 400 }
    );
  }

  // Verificar ownership del adjunto
  const { data: adjunto } = await supabaseAdmin
    .from("sgcc_ticket_adjuntos")
    .select("id, ticket_id, storage_path, subido_por_party")
    .eq("id", adjuntoId)
    .eq("ticket_id", ticketId)
    .maybeSingle();
  if (!adjunto || adjunto.subido_por_party !== guard.userId) {
    return NextResponse.json({ error: "Adjunto no encontrado" }, { status: 404 });
  }

  // Borrar de storage (mejor effort) y luego de BD
  try {
    await deleteFile("sgcc-documents", adjunto.storage_path);
  } catch (e) {
    console.error("[adjuntos DELETE] storage:", e);
  }

  await supabaseAdmin.from("sgcc_ticket_adjuntos").delete().eq("id", adjuntoId);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/partes/tickets/[id]/adjuntos/[adjuntoId]/route.ts
git commit -m "feat(sgcc): DELETE /api/partes/tickets/[id]/adjuntos/[adjuntoId]"
```

---

## Task 7: Ajustar `GET /api/tickets` (staff) para incluir solicitante_party + filtro origen

**Files:**
- Modify: `src/app/api/tickets/route.ts`

- [ ] **Step 1: Editar GET para incluir join a parties + filtro `?origen=`**

Reemplazar el bloque desde la línea 19 (declaración de `searchParams`) hasta la línea 38 (cierre del `if (caseId)`) por el siguiente bloque ampliado:

```ts
  const { searchParams } = new URL(req.url);
  const estado = searchParams.get("estado");
  const categoria = searchParams.get("categoria");
  const caseId = searchParams.get("case_id");
  const origen = searchParams.get("origen"); // 'parte' | 'staff' | 'todos' (default todos)

  let query = supabaseAdmin
    .from("sgcc_tickets")
    .select(`
      *,
      solicitante:sgcc_staff!sgcc_tickets_solicitante_staff_id_fkey(id, nombre, email),
      solicitante_party:sgcc_parties!sgcc_tickets_solicitante_party_id_fkey(id, nombres, apellidos, razon_social, email),
      asignado:sgcc_staff!sgcc_tickets_asignado_staff_id_fkey(id, nombre, email),
      respondedor:sgcc_staff!sgcc_tickets_respondido_por_fkey(id, nombre, email),
      caso:sgcc_cases(id, numero_radicado)
    `)
    .eq("center_id", centerId)
    .order("created_at", { ascending: false });

  if (estado) query = query.eq("estado", estado);
  if (categoria) query = query.eq("categoria", categoria);
  if (caseId) query = query.eq("case_id", caseId);
  if (origen === "parte") query = query.not("solicitante_party_id", "is", null);
  else if (origen === "staff") query = query.not("solicitante_staff_id", "is", null);
```

- [ ] **Step 2: Verificar que el archivo compila**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "src/app/api/tickets/route.ts" | head -5
```

Expected: sin output (sin errores en este archivo).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/tickets/route.ts
git commit -m "feat(sgcc): GET /api/tickets incluye solicitante_party + filtro ?origen="
```

---

## Task 8: Ajustar `PATCH /api/tickets/[id]` (staff) para notificar a parte solicitante

**Files:**
- Modify: `src/app/api/tickets/[id]/route.ts`

- [ ] **Step 1: Cargar también `solicitante_party_id` al buscar el ticket**

En `src/app/api/tickets/[id]/route.ts` línea 51 (el `select` del ticket en PATCH), cambiar:

```ts
    .select("id, solicitante_staff_id, asignado_staff_id, titulo")
```

por:

```ts
    .select("id, solicitante_staff_id, solicitante_party_id, asignado_staff_id, titulo, center_id")
```

- [ ] **Step 2: Reemplazar el bloque de notificación al solicitante (líneas ~107-128) para soportar parte**

Reemplazar el bloque completo `if (respuestaNueva && ticket.solicitante_staff_id && ...)` por:

```ts
  // Notificar al solicitante cuando se responde (staff o parte)
  if (respuestaNueva) {
    try {
      // Caso A: solicitante es staff
      if (ticket.solicitante_staff_id && ticket.solicitante_staff_id !== staffId) {
        const { data: solicitante } = await supabaseAdmin
          .from("sgcc_staff")
          .select("id, email")
          .eq("id", ticket.solicitante_staff_id)
          .single();
        if (solicitante) {
          await notify({
            centerId,
            tipo: "ticket_respondido",
            titulo: `💬 Respuesta a tu ticket — ${ticket.titulo}`,
            mensaje: `Tu ticket ha sido respondido.\n\n${respuestaNueva}`,
            recipients: [{ staffId: solicitante.id, email: solicitante.email ?? undefined }],
            canal: "both",
          });
        }
      }

      // Caso B: solicitante es parte
      if (ticket.solicitante_party_id) {
        const { data: parte } = await supabaseAdmin
          .from("sgcc_parties")
          .select("id, email")
          .eq("id", ticket.solicitante_party_id)
          .single();
        if (parte) {
          await notify({
            centerId,
            tipo: "ticket_respondido",
            titulo: `💬 Respuesta a tu ticket — ${ticket.titulo}`,
            mensaje: `El centro respondió tu ticket.\n\n${respuestaNueva}`,
            recipients: [{ partyId: parte.id, email: parte.email ?? undefined }],
            canal: "both",
          });
        }
      }
    } catch (e) {
      console.error("[TICKETS] Error notificando respuesta:", e);
    }
  }
```

- [ ] **Step 3: Verificar typecheck**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "src/app/api/tickets/\[id\]" | head -5
```

Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/tickets/[id]/route.ts
git commit -m "feat(sgcc): PATCH /api/tickets/[id] notifica también a parte solicitante"
```

---

## Task 9: API `POST /api/tickets/[id]/adjuntos` (staff sube adjunto en respuesta)

**Files:**
- Create: `src/app/api/tickets/[id]/adjuntos/route.ts`

- [ ] **Step 1: Crear archivo (espejo del de partes con auth de staff)**

Contenido completo:

```ts
// src/app/api/tickets/[id]/adjuntos/route.ts
// POST: el staff sube un adjunto a un ticket (típicamente al responder).
// Mismo patrón que el endpoint de partes pero con auth de staff.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin, uploadFile } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { randomUUID } from "crypto";

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_ADJUNTOS = 5;
const MIME_PERMITIDOS = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const staffId = (session.user as any)?.id as string | undefined;
  if (!staffId) return NextResponse.json({ error: "Sin staff id" }, { status: 400 });

  const { id: ticketId } = await params;

  const { data: ticket } = await supabaseAdmin
    .from("sgcc_tickets")
    .select("id, center_id, estado")
    .eq("id", ticketId)
    .eq("center_id", centerId)
    .maybeSingle();
  if (!ticket) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }
  if (ticket.estado === "Cerrado") {
    return NextResponse.json(
      { error: "No puede subir adjuntos a un ticket cerrado" },
      { status: 400 }
    );
  }

  const { count } = await supabaseAdmin
    .from("sgcc_ticket_adjuntos")
    .select("id", { count: "exact", head: true })
    .eq("ticket_id", ticketId);
  if ((count ?? 0) >= MAX_ADJUNTOS) {
    return NextResponse.json(
      { error: `Máximo ${MAX_ADJUNTOS} adjuntos por ticket` },
      { status: 400 }
    );
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Archivo excede 10 MB" }, { status: 413 });
  }
  if (!MIME_PERMITIDOS.has(file.type)) {
    return NextResponse.json(
      { error: "Tipo no permitido (PDF, JPG, PNG, WebP)" },
      { status: 415 }
    );
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const storagePath = `tickets/${centerId}/${ticketId}/${randomUUID()}.${ext}`;
  let url: string;
  try {
    url = await uploadFile(file, "sgcc-documents", storagePath, file.type);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error subiendo archivo" },
      { status: 500 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("sgcc_ticket_adjuntos")
    .insert({
      ticket_id: ticketId,
      nombre_archivo: file.name,
      storage_path: storagePath,
      url,
      mime_type: file.type,
      tamano_bytes: file.size,
      subido_por_staff: staffId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/tickets/[id]/adjuntos/route.ts
git commit -m "feat(sgcc): POST /api/tickets/[id]/adjuntos — staff sube adjunto a ticket"
```

---

## Task 10: Componentes reutilizables (badges + uploader)

**Files:**
- Create: `src/components/tickets/TicketEstadoBadge.tsx`
- Create: `src/components/tickets/TicketPrioridadBadge.tsx`
- Create: `src/components/tickets/AdjuntosUpload.tsx`

- [ ] **Step 1: Crear `TicketEstadoBadge.tsx`**

```tsx
// src/components/tickets/TicketEstadoBadge.tsx
import type { TicketEstado } from "@/types";

const STYLES: Record<TicketEstado, string> = {
  Pendiente: "bg-gray-100 text-gray-700 border-gray-200",
  EnRevision: "bg-blue-100 text-blue-700 border-blue-200",
  Respondido: "bg-green-100 text-green-700 border-green-200",
  Cerrado: "bg-zinc-100 text-zinc-500 border-zinc-200",
};

const LABELS: Record<TicketEstado, string> = {
  Pendiente: "Pendiente",
  EnRevision: "En revisión",
  Respondido: "Respondido",
  Cerrado: "Cerrado",
};

export function TicketEstadoBadge({ estado }: { estado: TicketEstado }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${STYLES[estado]}`}
    >
      {LABELS[estado]}
    </span>
  );
}
```

- [ ] **Step 2: Crear `TicketPrioridadBadge.tsx`**

```tsx
// src/components/tickets/TicketPrioridadBadge.tsx
import type { TicketPrioridad } from "@/types";

const STYLES: Record<TicketPrioridad, string> = {
  Normal: "bg-slate-100 text-slate-600 border-slate-200",
  Media: "bg-amber-100 text-amber-700 border-amber-200",
  Alta: "bg-red-100 text-red-700 border-red-200",
};

export function TicketPrioridadBadge({ prioridad }: { prioridad: TicketPrioridad }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${STYLES[prioridad]}`}
    >
      {prioridad}
    </span>
  );
}
```

- [ ] **Step 3: Crear `AdjuntosUpload.tsx`** — wrapper sobre `<input type="file" multiple>` que sube uno a uno al endpoint provisto

```tsx
// src/components/tickets/AdjuntosUpload.tsx
"use client";

import { useRef, useState } from "react";
import { Upload, Loader2, AlertCircle } from "lucide-react";

interface Props {
  endpoint: string;       // ej: /api/partes/tickets/abc/adjuntos
  onUploaded: () => void; // callback al terminar (refresca lista)
  disabled?: boolean;
  maxFiles?: number;      // default 5
}

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp";

export function AdjuntosUpload({ endpoint, onUploaded, disabled, maxFiles = 5 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>("");

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    if (files.length > maxFiles) {
      setError(`Máximo ${maxFiles} archivos a la vez`);
      return;
    }

    setError("");
    setUploading(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(endpoint, { method: "POST", body: fd });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? `Error subiendo ${file.name}`);
          break;
        }
      }
      onUploaded();
    } catch {
      setError("Error de conexión");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading || disabled}
        className="flex items-center gap-2 px-4 py-2 bg-[#0D2340] text-white rounded-lg text-sm font-medium hover:bg-[#0D2340]/90 disabled:opacity-50 transition-colors"
      >
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {uploading ? "Subiendo..." : "Adjuntar archivo"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        onChange={handleChange}
        className="hidden"
      />
      <p className="text-xs text-gray-400">PDF, JPG, PNG o WebP. Máx 10 MB c/u, hasta {maxFiles}.</p>
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/tickets/
git commit -m "feat(sgcc): componentes reutilizables tickets — badges + AdjuntosUpload"
```

---

## Task 11: Link "Tickets" en header del portal de partes

**Files:**
- Modify: `src/app/(partes)/layout.tsx`

- [ ] **Step 1: Agregar link "Tickets" en navegación desktop (después de "Mis Solicitudes")**

En `src/app/(partes)/layout.tsx`, dentro de `<nav className="hidden sm:flex ...">` (línea ~33), después del Link a `/mis-solicitudes` (cierra en línea 45), insertar:

```tsx
                <Link
                  href="/mis-tickets"
                  className="text-gray-300 hover:text-white transition-colors text-sm font-medium"
                >
                  Tickets
                </Link>
```

- [ ] **Step 2: Agregar el mismo link en navegación móvil (línea ~80)**

Dentro del `<nav className="sm:hidden ...">`, después del Link móvil a `/mis-solicitudes` (cierra en línea 92), insertar:

```tsx
        <Link
          href="/mis-tickets"
          className="text-gray-300 hover:text-white text-sm"
        >
          Tickets
        </Link>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(partes)/layout.tsx
git commit -m "feat(sgcc): link 'Tickets' en navegación del portal de partes"
```

---

## Task 12: Página `/mis-tickets` (lista)

**Files:**
- Create: `src/app/(partes)/mis-tickets/page.tsx`
- Create: `src/app/(partes)/mis-tickets/MisTicketsClient.tsx`

- [ ] **Step 1: Crear `page.tsx` (server component)**

```tsx
// src/app/(partes)/mis-tickets/page.tsx
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { MisTicketsClient } from "./MisTicketsClient";

export default async function MisTicketsPage() {
  const session = await auth();
  if (!session || (session.user as any)?.userType !== "party") redirect("/login");

  const userId = (session.user as any).id as string;

  const { data: tickets } = await supabaseAdmin
    .from("sgcc_tickets")
    .select(`
      id, titulo, estado, prioridad, created_at, updated_at, case_id,
      caso:sgcc_cases(numero_radicado)
    `)
    .eq("solicitante_party_id", userId)
    .order("created_at", { ascending: false });

  return <MisTicketsClient ticketsIniciales={(tickets ?? []) as any[]} />;
}
```

- [ ] **Step 2: Crear `MisTicketsClient.tsx`** (filtro pills + tabla + empty state + botón crear)

```tsx
// src/app/(partes)/mis-tickets/MisTicketsClient.tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, LifeBuoy } from "lucide-react";
import { TicketEstadoBadge } from "@/components/tickets/TicketEstadoBadge";
import type { TicketEstado } from "@/types";

interface TicketRow {
  id: string;
  titulo: string;
  estado: TicketEstado;
  prioridad: string;
  created_at: string;
  updated_at: string;
  case_id: string | null;
  caso: { numero_radicado: string } | null;
}

type Filtro = "todos" | "abiertos" | "cerrados";

export function MisTicketsClient({ ticketsIniciales }: { ticketsIniciales: TicketRow[] }) {
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const filtrados = useMemo(() => {
    if (filtro === "todos") return ticketsIniciales;
    if (filtro === "abiertos")
      return ticketsIniciales.filter((t) => t.estado !== "Cerrado");
    return ticketsIniciales.filter((t) => t.estado === "Cerrado");
  }, [filtro, ticketsIniciales]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0D2340] flex items-center gap-2">
            <LifeBuoy className="w-6 h-6" /> Mis tickets
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Solicita ayuda al centro sobre un trámite o consulta general.
          </p>
        </div>
        <Link
          href="/mis-tickets/nuevo"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#0D2340] text-white rounded-lg text-sm font-medium hover:bg-[#0D2340]/90"
        >
          <Plus className="w-4 h-4" /> Nuevo ticket
        </Link>
      </div>

      <div className="flex gap-2">
        {(["todos", "abiertos", "cerrados"] as Filtro[]).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-3 py-1 rounded-full text-sm border ${
              filtro === f
                ? "bg-[#0D2340] text-white border-[#0D2340]"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {filtrados.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <LifeBuoy className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">
            {ticketsIniciales.length === 0
              ? "Aún no has abierto ningún ticket. Si necesitas ayuda con un trámite, abre uno aquí."
              : "No hay tickets que coincidan con el filtro."}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Título</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">Caso</th>
                <th className="text-left px-4 py-3">Estado</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Actualizado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtrados.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-3" colSpan={1}>
                    <Link href={`/mis-tickets/${t.id}`} className="block font-medium text-[#0D2340]">
                      {t.titulo}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                    {t.caso?.numero_radicado ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <TicketEstadoBadge estado={t.estado} />
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                    {new Date(t.updated_at).toLocaleDateString("es-CO")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(partes)/mis-tickets/page.tsx src/app/(partes)/mis-tickets/MisTicketsClient.tsx
git commit -m "feat(sgcc): página /mis-tickets — lista con filtros para partes"
```

---

## Task 13: Página `/mis-tickets/nuevo` (crear)

**Files:**
- Create: `src/app/(partes)/mis-tickets/nuevo/page.tsx`
- Create: `src/app/(partes)/mis-tickets/nuevo/NuevoTicketForm.tsx`

- [ ] **Step 1: Crear `page.tsx` que carga los casos del usuario**

```tsx
// src/app/(partes)/mis-tickets/nuevo/page.tsx
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { NuevoTicketForm } from "./NuevoTicketForm";

export default async function NuevoTicketPage() {
  const session = await auth();
  if (!session || (session.user as any)?.userType !== "party") redirect("/login");

  const userId = (session.user as any).id as string;

  // Casos donde la parte está vinculada
  const { data: caseParties } = await supabaseAdmin
    .from("sgcc_case_parties")
    .select("case_id, caso:sgcc_cases(id, numero_radicado, tipo_tramite)")
    .eq("party_id", userId);

  const casos = (caseParties ?? [])
    .map((cp: any) => cp.caso)
    .filter(Boolean) as Array<{ id: string; numero_radicado: string; tipo_tramite: string }>;

  return <NuevoTicketForm casos={casos} />;
}
```

- [ ] **Step 2: Crear `NuevoTicketForm.tsx`** (form + redirección a detalle al crear)

```tsx
// src/app/(partes)/mis-tickets/nuevo/NuevoTicketForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";

interface CasoOpcion {
  id: string;
  numero_radicado: string;
  tipo_tramite: string;
}

export function NuevoTicketForm({ casos }: { casos: CasoOpcion[] }) {
  const router = useRouter();
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [caseId, setCaseId] = useState("");
  const [prioridad, setPrioridad] = useState<"Normal" | "Media" | "Alta">("Normal");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!titulo.trim()) {
      setError("El título es requerido");
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch("/api/partes/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: titulo.trim(),
          descripcion: descripcion.trim() || null,
          case_id: caseId || null,
          prioridad,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Error al crear el ticket");
        return;
      }
      const data = await res.json();
      router.push(`/mis-tickets/${data.id}`);
    } catch {
      setError("Error de conexión");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        href="/mis-tickets"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="w-4 h-4" /> Volver
      </Link>

      <h1 className="text-2xl font-bold text-[#0D2340]">Nuevo ticket</h1>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Título <span className="text-red-500">*</span>
          </label>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={200}
            placeholder="Ej: Necesito ayuda con la audiencia"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1B4F9B]/30 focus:border-[#1B4F9B] outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            maxLength={2000}
            rows={5}
            placeholder="Cuéntanos en detalle…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1B4F9B]/30 focus:border-[#1B4F9B] outline-none"
          />
          <p className="text-[10px] text-gray-400 mt-1">{descripcion.length}/2000</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Caso relacionado</label>
            <select
              value={caseId}
              onChange={(e) => setCaseId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Sin caso específico</option>
              {casos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.numero_radicado} ({c.tipo_tramite})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Prioridad</label>
            <select
              value={prioridad}
              onChange={(e) => setPrioridad(e.target.value as any)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="Normal">Normal</option>
              <option value="Media">Media</option>
              <option value="Alta">Alta</option>
            </select>
          </div>
        </div>

        <p className="text-xs text-gray-400">
          Podrás adjuntar archivos después de crear el ticket.
        </p>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={enviando}
            className="flex items-center gap-2 px-4 py-2 bg-[#0D2340] text-white rounded-lg text-sm font-medium hover:bg-[#0D2340]/90 disabled:opacity-50"
          >
            {enviando && <Loader2 className="w-4 h-4 animate-spin" />}
            Crear ticket
          </button>
          <Link
            href="/mis-tickets"
            className="px-4 py-2 text-gray-600 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(partes)/mis-tickets/nuevo/
git commit -m "feat(sgcc): página /mis-tickets/nuevo — crear ticket desde portal partes"
```

---

## Task 14: Página `/mis-tickets/[id]` (detalle + cierre + adjuntos)

**Files:**
- Create: `src/app/(partes)/mis-tickets/[id]/page.tsx`
- Create: `src/app/(partes)/mis-tickets/[id]/TicketDetalleClient.tsx`

- [ ] **Step 1: Crear `page.tsx` que carga el ticket con adjuntos**

```tsx
// src/app/(partes)/mis-tickets/[id]/page.tsx
export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { TicketDetalleClient } from "./TicketDetalleClient";

export default async function MiTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session || (session.user as any)?.userType !== "party") redirect("/login");

  const userId = (session.user as any).id as string;
  const { id } = await params;

  const { data: ticket } = await supabaseAdmin
    .from("sgcc_tickets")
    .select(`
      *,
      caso:sgcc_cases(id, numero_radicado),
      respondedor:sgcc_staff!sgcc_tickets_respondido_por_fkey(id, nombre)
    `)
    .eq("id", id)
    .eq("solicitante_party_id", userId)
    .maybeSingle();

  if (!ticket) notFound();

  const { data: adjuntos } = await supabaseAdmin
    .from("sgcc_ticket_adjuntos")
    .select("*")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });

  return (
    <TicketDetalleClient
      ticket={ticket as any}
      adjuntosIniciales={(adjuntos ?? []) as any[]}
      userId={userId}
    />
  );
}
```

- [ ] **Step 2: Crear `TicketDetalleClient.tsx`** (cabecera + thread + acciones + adjuntos)

```tsx
// src/app/(partes)/mis-tickets/[id]/TicketDetalleClient.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Paperclip, Trash2, CheckCircle2, Loader2 } from "lucide-react";
import { TicketEstadoBadge } from "@/components/tickets/TicketEstadoBadge";
import { TicketPrioridadBadge } from "@/components/tickets/TicketPrioridadBadge";
import { AdjuntosUpload } from "@/components/tickets/AdjuntosUpload";
import type { TicketEstado, TicketPrioridad, SgccTicketAdjunto } from "@/types";

interface TicketDetalle {
  id: string;
  titulo: string;
  descripcion: string | null;
  estado: TicketEstado;
  prioridad: TicketPrioridad;
  case_id: string | null;
  caso: { id: string; numero_radicado: string } | null;
  respuesta: string | null;
  respondido_at: string | null;
  respondedor: { id: string; nombre: string } | null;
  created_at: string;
}

export function TicketDetalleClient({
  ticket,
  adjuntosIniciales,
  userId,
}: {
  ticket: TicketDetalle;
  adjuntosIniciales: SgccTicketAdjunto[];
  userId: string;
}) {
  const router = useRouter();
  const [adjuntos, setAdjuntos] = useState<SgccTicketAdjunto[]>(adjuntosIniciales);
  const [cerrando, setCerrando] = useState(false);
  const [error, setError] = useState("");

  const cerrado = ticket.estado === "Cerrado";

  async function recargarAdjuntos() {
    const res = await fetch(`/api/partes/tickets/${ticket.id}`);
    if (res.ok) {
      const data = await res.json();
      setAdjuntos(data.adjuntos ?? []);
    }
  }

  async function handleCerrar() {
    if (!confirm("¿Marcar este ticket como resuelto? No podrás reabrirlo.")) return;
    setCerrando(true);
    setError("");
    try {
      const res = await fetch(`/api/partes/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "Cerrado" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Error al cerrar");
        return;
      }
      router.refresh();
    } catch {
      setError("Error de conexión");
    } finally {
      setCerrando(false);
    }
  }

  async function handleBorrarAdjunto(adjuntoId: string) {
    if (!confirm("¿Eliminar este adjunto?")) return;
    const res = await fetch(`/api/partes/tickets/${ticket.id}/adjuntos/${adjuntoId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setAdjuntos((prev) => prev.filter((a) => a.id !== adjuntoId));
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Error al eliminar");
    }
  }

  const adjuntosParte = adjuntos.filter((a) => a.subido_por_party);
  const adjuntosStaff = adjuntos.filter((a) => a.subido_por_staff);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        href="/mis-tickets"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="w-4 h-4" /> Mis tickets
      </Link>

      <header className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold text-[#0D2340]">{ticket.titulo}</h1>
          <div className="flex flex-col gap-1 items-end">
            <TicketEstadoBadge estado={ticket.estado} />
            <TicketPrioridadBadge prioridad={ticket.prioridad} />
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
          <span>Creado: {new Date(ticket.created_at).toLocaleString("es-CO")}</span>
          {ticket.caso && (
            <span>
              Caso: <Link href={`/mis-casos/${ticket.caso.id}`} className="text-[#1B4F9B] hover:underline">
                {ticket.caso.numero_radicado}
              </Link>
            </span>
          )}
        </div>
      </header>

      <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Mi mensaje</h2>
        <p className="text-sm text-gray-700 whitespace-pre-line">
          {ticket.descripcion || "(sin descripción)"}
        </p>
        {adjuntosParte.length > 0 && (
          <ul className="space-y-1 pt-3 border-t border-gray-100">
            {adjuntosParte.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-[#1B4F9B] hover:underline"
                >
                  <Paperclip className="w-4 h-4" /> {a.nombre_archivo}
                </a>
                {!cerrado && a.subido_por_party === userId && (
                  <button
                    onClick={() => handleBorrarAdjunto(a.id)}
                    className="text-red-500 hover:text-red-700"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Respuesta del centro</h2>
        {ticket.respuesta ? (
          <>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {ticket.respondedor?.nombre ? `${ticket.respondedor.nombre} • ` : ""}
              {ticket.respondido_at && new Date(ticket.respondido_at).toLocaleString("es-CO")}
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-line">{ticket.respuesta}</p>
            {adjuntosStaff.length > 0 && (
              <ul className="space-y-1 pt-3 border-t border-gray-100">
                {adjuntosStaff.map((a) => (
                  <li key={a.id} className="text-sm">
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-[#1B4F9B] hover:underline"
                    >
                      <Paperclip className="w-4 h-4" /> {a.nombre_archivo}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400 italic">Esperando respuesta del centro…</p>
        )}
      </section>

      {!cerrado && adjuntos.length < 5 && (
        <section className="bg-gray-50 border border-gray-200 rounded-xl p-6 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Adjuntar archivo adicional</h2>
          <AdjuntosUpload
            endpoint={`/api/partes/tickets/${ticket.id}/adjuntos`}
            onUploaded={recargarAdjuntos}
            maxFiles={5 - adjuntos.length}
          />
        </section>
      )}

      {error && (
        <div className="text-sm text-red-600">{error}</div>
      )}

      {!cerrado ? (
        <div className="flex justify-end">
          <button
            onClick={handleCerrar}
            disabled={cerrando}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {cerrando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Marcar como resuelto
          </button>
        </div>
      ) : (
        <div className="text-sm text-gray-500 italic text-center">
          Este ticket fue cerrado.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(partes)/mis-tickets/[id]/
git commit -m "feat(sgcc): página /mis-tickets/[id] — detalle + cerrar + adjuntos"
```

---

## Task 15: UI staff — badge origen + filtro + KPI + adjuntos en respuesta

**Files:**
- Modify: `src/app/(staff)/tickets/TicketsClient.tsx`

> **Importante:** este es el archivo más grande de modificar. Antes de tocarlo, leer el contenido actual completo. Los pasos abajo son cambios incrementales.

- [ ] **Step 1: Leer el archivo actual y mapear secciones**

```bash
wc -l src/app/\(staff\)/tickets/TicketsClient.tsx
```

Identificar:
- Donde se renderiza la fila de cada ticket en la tabla → para mostrar nombre de la parte cuando el solicitante es party.
- Donde está el grupo de filtros (estado/categoría) → agregar pills de origen.
- Donde están los KPIs en la cabecera → agregar tarjeta "Tickets de partes abiertos".
- El modal de respuesta → agregar `<AdjuntosUpload>` y listar adjuntos de la parte.

- [ ] **Step 2: Importar componentes nuevos al inicio del archivo**

Agregar al import block:

```tsx
import { AdjuntosUpload } from "@/components/tickets/AdjuntosUpload";
```

(Los badges `TicketEstadoBadge`/`TicketPrioridadBadge` solo se importan si la versión actual no usa render inline; revisar antes de duplicar.)

- [ ] **Step 3: Renderizar nombre del solicitante con badge de origen**

Localizar la celda de "Solicitante" en la tabla. Reemplazar el render actual por una expresión que distinga staff vs parte. El JSON del API ahora incluye `solicitante_party` (con `nombres`/`apellidos`/`razon_social`/`email`). Patrón:

```tsx
{ticket.solicitante_party_id ? (
  <span className="flex items-center gap-2">
    {ticket.solicitante_party
      ? [ticket.solicitante_party.nombres, ticket.solicitante_party.apellidos]
          .filter(Boolean)
          .join(" ") ||
        ticket.solicitante_party.razon_social ||
        ticket.solicitante_party.email
      : "Parte"}
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-violet-100 text-violet-700 border border-violet-200">
      Parte
    </span>
  </span>
) : (
  ticket.solicitante?.nombre ?? "—"
)}
```

- [ ] **Step 4: Agregar filtro "origen" arriba de la tabla**

Después de los pills de estado/categoría existentes, agregar:

```tsx
<div className="flex gap-2">
  {(["todos", "parte", "staff"] as const).map((o) => (
    <button
      key={o}
      onClick={() => setOrigen(o)}
      className={`px-3 py-1 rounded-full text-sm border ${
        origen === o
          ? "bg-[#0D2340] text-white border-[#0D2340]"
          : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
      }`}
    >
      {o === "todos" ? "Todos" : o === "parte" ? "De partes" : "Internos"}
    </button>
  ))}
</div>
```

Donde:
- `origen` es nuevo state: `const [origen, setOrigen] = useState<"todos" | "parte" | "staff">("todos");`
- El fetch de tickets debe incluir `?origen=${origen}` cuando `origen !== "todos"`.

- [ ] **Step 5: Agregar KPI "Tickets de partes abiertos"**

En el bloque donde se renderizan KPIs (Pendientes/En revisión/etc.), agregar tarjeta extra:

```tsx
<div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
  <div className="text-xs text-violet-700 font-medium uppercase">Tickets de partes</div>
  <div className="text-2xl font-bold text-violet-900 mt-1">
    {tickets.filter((t) => t.solicitante_party_id && t.estado !== "Cerrado").length}
  </div>
</div>
```

- [ ] **Step 6: En el modal de respuesta, agregar uploader y listar adjuntos de la parte**

En el bloque del modal "Responder ticket", debajo del textarea de respuesta, agregar:

```tsx
<div className="pt-3 border-t border-gray-100 space-y-2">
  <h4 className="text-xs font-semibold text-gray-600">Adjuntos en mi respuesta</h4>
  <AdjuntosUpload
    endpoint={`/api/tickets/${ticketSeleccionado.id}/adjuntos`}
    onUploaded={() => recargarAdjuntos(ticketSeleccionado.id)}
  />
  {adjuntos.filter((a) => a.subido_por_staff).map((a) => (
    <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="block text-sm text-[#1B4F9B] hover:underline">
      📎 {a.nombre_archivo}
    </a>
  ))}
</div>

{adjuntos.filter((a) => a.subido_por_party).length > 0 && (
  <div className="pt-3 border-t border-gray-100 space-y-2">
    <h4 className="text-xs font-semibold text-gray-600">Adjuntos de la parte</h4>
    {adjuntos.filter((a) => a.subido_por_party).map((a) => (
      <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="block text-sm text-[#1B4F9B] hover:underline">
        📎 {a.nombre_archivo}
      </a>
    ))}
  </div>
)}
```

Donde `adjuntos` y `recargarAdjuntos` se agregan al state del componente:

```tsx
const [adjuntos, setAdjuntos] = useState<any[]>([]);
async function recargarAdjuntos(ticketId: string) {
  const res = await fetch(`/api/tickets/${ticketId}`);
  if (res.ok) {
    const data = await res.json();
    setAdjuntos(data.adjuntos ?? []);
  }
}
```

Y al abrir el modal (donde se hace `setTicketSeleccionado(ticket)`), llamar `recargarAdjuntos(ticket.id)`.

> **Nota:** el endpoint `GET /api/tickets/[id]` actualmente NO devuelve adjuntos. Dado que esa ruta es trivial de extender (mismo patrón que el de partes), agregar al return el campo `adjuntos`. Si el archivo modificado en Task 8 no lo incluye, agregar este snippet al final del GET de `src/app/api/tickets/[id]/route.ts`:

```ts
  // Cargar adjuntos
  const { data: adjuntos } = await supabaseAdmin
    .from("sgcc_ticket_adjuntos")
    .select("*")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });

  return NextResponse.json({ ...data, adjuntos: adjuntos ?? [] });
```

(Reemplazando el `return NextResponse.json(data)` actual.) Si esto se hace, agregar a `git add` también `src/app/api/tickets/[id]/route.ts`.

- [ ] **Step 7: Verificar build**

```bash
npm run build 2>&1 | tail -30
```

Expected: build exitoso o solo warnings de lint en archivos no relacionados. Si aparecen errores TS en `TicketsClient.tsx`, revisar tipos importados (probablemente `solicitante_party` no estaba en el tipo local del componente — ampliar el tipo local para incluirlo).

- [ ] **Step 8: Commit**

```bash
git add src/app/(staff)/tickets/TicketsClient.tsx src/app/api/tickets/[id]/route.ts
git commit -m "feat(sgcc): UI staff tickets — badge origen, filtro, KPI partes, adjuntos en respuesta"
```

---

## Task 16: Build final + smoke manual + PR

- [ ] **Step 1: Lint completo**

```bash
npm run lint 2>&1 | tail -30
```

Expected: sin errores. Warnings tolerables si son del codebase pre-existente.

- [ ] **Step 2: Build de producción**

```bash
npm run build 2>&1 | tail -50
```

Expected: `✓ Compiled successfully` y output de páginas que incluya `/mis-tickets`, `/mis-tickets/nuevo`, `/mis-tickets/[id]` y `/api/partes/tickets/...`. Si falla, leer el error y corregir antes de seguir.

- [ ] **Step 3: Smoke test manual (con Vercel preview o localmente)**

Pruebas mínimas (resto en sec 10 del spec):
- [ ] Login como tercero → ver link "Tickets" en header.
- [ ] `/mis-tickets` muestra empty state.
- [ ] Crear ticket sin caso → admin del centro recibe email.
- [ ] Subir 2 adjuntos → quedan listados; borrar 1 → solo borra el propio.
- [ ] Como admin: ver ticket en `/tickets` con badge "Parte"; responder con adjunto → la parte recibe email.
- [ ] La parte cierra el ticket → admin recibe in-app; uploader queda oculto.

- [ ] **Step 4: Push y abrir PR**

```bash
git push -u origin feature/portal-tickets-partes
```

```bash
gh pr create --title "feat(sgcc): portal de tickets para partes" --body "$(cat <<'EOF'
## Summary
Permite a las partes (convocantes, convocados, apoderados) abrir tickets desde el portal `/mis-tickets`, atados o no a un caso, con adjuntos múltiples. El staff los recibe en su bandeja existente con badges de origen.

Spec aprobado: `docs/superpowers/specs/2026-04-27-portal-tickets-partes-design.md`

## Cambios
- Migración `029_tickets_partes.sql` (extiende `sgcc_tickets` + tabla `sgcc_ticket_adjuntos`)
- 6 endpoints nuevos `/api/partes/tickets/*` + 1 nuevo `/api/tickets/[id]/adjuntos` + 2 modificados
- 3 páginas nuevas en portal partes (`/mis-tickets`, `/mis-tickets/nuevo`, `/mis-tickets/[id]`)
- Componentes reutilizables: `TicketEstadoBadge`, `TicketPrioridadBadge`, `AdjuntosUpload`
- UI staff: badge origen + filtro `?origen=` + KPI + adjuntos en modal respuesta

## Pasos manuales tras merge
1. Aplicar `supabase/migrations/029_tickets_partes.sql` en SQL Editor de prod (`vciifcfppebjpqdawwzh`).
2. Esperar deploy de Vercel.
3. Smoke test sección 10.1 del spec.

## Test plan
- [x] `npm run build` exitoso
- [ ] Tercero abre ticket sin caso → admins reciben email
- [ ] Tercero sube 5 adjuntos → 6º falla con 400
- [ ] Tercero intenta cambiar título via PATCH → 403
- [ ] Staff responde con adjunto → parte recibe email + ve adjunto
- [ ] Tercero cierra → admin recibe in-app

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Guardar memoria del módulo**

Crear archivo `C:\Users\SD21\.claude\projects\C--Users-SD21\memory\project_sgcc_tickets_partes.md` con resumen del feature, PR mergeado, migración aplicada, y agregar entrada al MEMORY.md.

---

## Spec coverage check

| Spec § | Implementado en task |
|---|---|
| 3.1 Extender `sgcc_tickets` | Task 1 |
| 3.2 Tabla `sgcc_ticket_adjuntos` | Task 1 |
| 4.1 Rutas partes (6 endpoints) | Tasks 3-6 |
| 4.2 Cambios staff (GET + PATCH + POST adjuntos) | Tasks 7-9 |
| 4.3 Validaciones (MIME, 10MB, 5 archivos) | Tasks 5, 9 |
| 4.3 Anti-bypass case_id | Task 3 |
| 5.1 Sidebar/header link | Task 11 |
| 5.2 `/mis-tickets` lista | Task 12 |
| 5.3 `/mis-tickets/nuevo` | Task 13 |
| 5.4 `/mis-tickets/[id]` detalle | Task 14 |
| 5.5 Componentes reutilizables | Task 10 |
| 6.1 TicketsClient: badge + filtro + KPI | Task 15 |
| 6.2 Modal respuesta + adjuntos | Task 15 |
| 7. Notificaciones (4 eventos) | Tasks 3, 4, 8 |
| 8. Permisos | Tasks 3, 4, 5, 6 |
| 9. Tipos TS | Task 2 |
| 10. Pruebas manuales | Task 16 |

**Sin gaps detectados.**
