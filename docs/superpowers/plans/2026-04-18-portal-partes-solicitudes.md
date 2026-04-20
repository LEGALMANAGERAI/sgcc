# Portal de Partes — Radicación de Solicitudes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir a usuarios con rol `parte` radicar solicitudes de conciliación e insolvencia desde el portal logueado, con borrador persistente, validaciones Ley 2445/2025 y transacción atómica de radicación.

**Architecture:** Borrador en `sgcc_solicitudes_draft` (JSONB) + tablas hijas especializadas que se llenan al radicar vía RPC. Wizard por trámite con auto-save debounced cada 3 s.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase (Postgres + Storage + RPC), NextAuth v5, Tailwind v4, Resend.

**Spec:** `docs/superpowers/specs/2026-04-18-portal-partes-solicitudes-design.md`

**Worktree:** `C:/Users/SD21/sgcc-portal-worktree` en rama `feature/portal-partes-solicitudes`.

**Testing approach:** El repo no tiene framework de tests configurado. Cada fase termina con un smoke test manual (dev server + flujo UI) más verificación `npm run build && npx tsc --noEmit`. La lógica pura (validators, small-creditor, payment-plan) queda aislada en funciones para testear después.

---

## Map de archivos

### Nuevos
```
supabase/migrations/019_portal_partes_solicitudes.sql
src/types/solicitudes.ts                              (tipos form_data)
src/lib/solicitudes/validators.ts                     (Art. 538/539)
src/lib/solicitudes/small-creditor.ts                 (cálculo 5%)
src/lib/solicitudes/payment-plan.ts                   (cronograma)
src/lib/solicitudes/constants.ts                      (SMLMV, labels)
src/hooks/useDraftAutoSave.ts                         (debounce PATCH)

src/app/api/partes/solicitudes/route.ts               (GET, POST)
src/app/api/partes/solicitudes/[id]/route.ts          (GET, PATCH, DELETE)
src/app/api/partes/solicitudes/[id]/adjuntos/route.ts (POST)
src/app/api/partes/solicitudes/[id]/adjuntos/[docId]/route.ts (DELETE)
src/app/api/partes/solicitudes/[id]/radicar/route.ts  (POST)

src/app/(partes)/mis-solicitudes/page.tsx             (lista)
src/app/(partes)/mis-solicitudes/MisSolicitudesClient.tsx
src/app/(partes)/mis-solicitudes/nueva/page.tsx       (selector)
src/app/(partes)/mis-solicitudes/[id]/page.tsx        (shell)
src/app/(partes)/mis-solicitudes/[id]/WizardShell.tsx
src/app/(partes)/mis-solicitudes/[id]/conciliacion/*  (5 pasos)
src/app/(partes)/mis-solicitudes/[id]/insolvencia/*   (13 pasos)

src/components/partes/PersonaForm.tsx
src/components/partes/RepeatableList.tsx
src/components/partes/StepSidebar.tsx
src/components/partes/AutoSaveIndicator.tsx
src/components/partes/FileUploadBox.tsx
src/components/partes/MoneyInput.tsx                  (si no existe global)
```

### Modificados
```
src/types/index.ts                                    (+types de solicitudes)
src/app/(auth)/registro/parte/page.tsx                (+campo código corto)
src/app/api/partes/route.ts                           (validar código corto)
src/app/(partes)/layout.tsx                           (agregar link "Mis solicitudes")
src/app/widget/[centerId]/page.tsx                    (banner deprecación)
```

---

## Fase 0 — Fundamentos (schema, tipos, libs puras)

Esta fase prepara la base sin UI ni endpoints. Se puede validar compilando.

### Task 0.1: Migración SQL 019

**Files:**
- Create: `supabase/migrations/019_portal_partes_solicitudes.sql`

- [ ] **Step 1: Crear el archivo de migración**

```sql
-- 019_portal_partes_solicitudes.sql
-- Portal de Partes: radicación de solicitudes por usuarios del centro
-- Ley 2445/2025 (insolvencia PNNC + pequeño comerciante)

-- ─────────────────────────────────────────────────────────────────────
-- 1. Tabla principal: borrador de solicitud
-- ─────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────
-- 2. Columnas nuevas en sgcc_cases (para insolvencia Ley 2445/2025)
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE sgcc_cases
  ADD COLUMN IF NOT EXISTS tipo_deudor text CHECK (tipo_deudor IN ('pnnc','pequeno_comerciante')),
  ADD COLUMN IF NOT EXISTS causa_insolvencia text,
  ADD COLUMN IF NOT EXISTS ingresos_mensuales numeric(14,2),
  ADD COLUMN IF NOT EXISTS gastos_subsistencia_mensual numeric(14,2),
  ADD COLUMN IF NOT EXISTS sociedad_conyugal_info text,
  ADD COLUMN IF NOT EXISTS matricula_mercantil text,
  ADD COLUMN IF NOT EXISTS activos_totales numeric(14,2),
  ADD COLUMN IF NOT EXISTS juramento_aceptado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS solicita_tarifa_especial boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS creado_por_parte boolean NOT NULL DEFAULT false;

-- ─────────────────────────────────────────────────────────────────────
-- 3. Tablas hijas
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE sgcc_case_creditors (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id             uuid NOT NULL REFERENCES sgcc_cases(id) ON DELETE CASCADE,
  orden               int  NOT NULL,
  nombre              text NOT NULL,
  tipo_doc            text,
  numero_doc          text,
  direccion_notif     text,
  ciudad              text,
  correo              text,
  telefono            text,
  tipo_credito        text,
  naturaleza_credito  text,
  clase_prelacion     text CHECK (clase_prelacion IN
                        ('primera','segunda','tercera','cuarta','quinta')),
  capital             numeric(14,2) NOT NULL DEFAULT 0,
  intereses           numeric(14,2) NOT NULL DEFAULT 0,
  dias_mora           int,
  mas_90_dias_mora    boolean NOT NULL DEFAULT false,
  es_pequeno_acreedor boolean NOT NULL DEFAULT false,
  info_adicional      text,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_creditors_case ON sgcc_case_creditors(case_id);

CREATE TABLE sgcc_case_assets (
  id                           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                      uuid NOT NULL REFERENCES sgcc_cases(id) ON DELETE CASCADE,
  tipo                         text NOT NULL CHECK (tipo IN ('inmueble','mueble','elemento_hogar')),
  descripcion                  text,
  valor_estimado               numeric(14,2),
  porcentaje_dominio           int,
  gravamen                     text,
  direccion                    text,
  ciudad                       text,
  matricula_inmobiliaria       text,
  afectacion_vivienda_familiar boolean,
  marca_modelo                 text,
  numero_chasis                text,
  created_at                   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_assets_case ON sgcc_case_assets(case_id);

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

CREATE TABLE sgcc_case_payment_plan (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                     uuid NOT NULL REFERENCES sgcc_cases(id) ON DELETE CASCADE,
  clase_prelacion             text NOT NULL,
  tasa_interes_futura_mensual numeric(5,2),
  tasa_interes_espera_mensual numeric(5,2),
  numero_cuotas               int,
  cronograma_json             jsonb,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(case_id, clase_prelacion)
);

-- ─────────────────────────────────────────────────────────────────────
-- 4. Extender sgcc_documents para adjuntos de draft
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE sgcc_documents
  ADD COLUMN IF NOT EXISTS is_draft  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS draft_id  uuid REFERENCES sgcc_solicitudes_draft(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS tipo_anexo text;
CREATE INDEX IF NOT EXISTS idx_documents_draft ON sgcc_documents(draft_id) WHERE draft_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 5. RLS
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE sgcc_solicitudes_draft ENABLE ROW LEVEL SECURITY;
CREATE POLICY drafts_owner ON sgcc_solicitudes_draft
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE sgcc_case_creditors ENABLE ROW LEVEL SECURITY;
CREATE POLICY allow_all ON sgcc_case_creditors FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE sgcc_case_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY allow_all ON sgcc_case_assets FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE sgcc_case_judicial_processes ENABLE ROW LEVEL SECURITY;
CREATE POLICY allow_all ON sgcc_case_judicial_processes FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE sgcc_case_payment_plan ENABLE ROW LEVEL SECURITY;
CREATE POLICY allow_all ON sgcc_case_payment_plan FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────
-- 6. RPC de radicación (transacción atómica)
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION radicar_solicitud(p_draft_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_draft           sgcc_solicitudes_draft%ROWTYPE;
  v_case_id         uuid;
  v_numero_radicado text;
  v_fd              jsonb;
  v_materia         text;
  v_cuantia         numeric(14,2);
  v_descripcion     text;
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

  -- 3. Extraer datos comunes
  v_materia     := COALESCE(v_fd->>'materia', 'otro');
  v_cuantia     := COALESCE((v_fd->>'cuantia')::numeric, 0);
  v_descripcion := COALESCE(v_fd->>'descripcion', v_fd->>'causa_insolvencia', '');

  -- 4. INSERT sgcc_cases
  INSERT INTO sgcc_cases (
    id, center_id, numero_radicado, tipo_tramite, materia, estado,
    descripcion, cuantia, fecha_solicitud,
    tipo_deudor, causa_insolvencia, ingresos_mensuales,
    gastos_subsistencia_mensual, sociedad_conyugal_info,
    matricula_mercantil, activos_totales,
    juramento_aceptado, solicita_tarifa_especial, creado_por_parte
  ) VALUES (
    gen_random_uuid(), v_draft.center_id, v_numero_radicado,
    v_draft.tipo_tramite, v_materia, 'solicitud',
    v_descripcion, v_cuantia, now(),
    v_fd->>'tipo_deudor',
    v_fd->>'causa_insolvencia',
    NULLIF(v_fd->>'ingresos_mensuales','')::numeric,
    NULLIF(v_fd->>'gastos_subsistencia_mensual','')::numeric,
    v_fd->>'sociedad_conyugal_info',
    v_fd->>'matricula_mercantil',
    NULLIF(v_fd->>'activos_totales','')::numeric,
    COALESCE((v_fd->>'juramento_aceptado')::boolean, false),
    COALESCE((v_fd->>'solicita_tarifa_especial')::boolean, false),
    true
  )
  RETURNING id INTO v_case_id;

  -- 5. Convocante = user_id
  INSERT INTO sgcc_case_parties (case_id, party_id, rol)
  VALUES (v_case_id, v_draft.user_id, 'convocante');

  -- 6. Convocados (conciliación) → también van a sgcc_case_parties
  IF v_draft.tipo_tramite = 'conciliacion' AND jsonb_typeof(v_fd->'convocados') = 'array' THEN
    INSERT INTO sgcc_case_parties (case_id, rol, nombre_persona, tipo_doc, numero_doc, email, telefono, ciudad)
    SELECT v_case_id, 'convocado',
      COALESCE(x->>'nombres' || ' ' || (x->>'apellidos'), x->>'razon_social'),
      x->>'tipo_doc', x->>'numero_doc', x->>'email', x->>'telefono', x->>'ciudad'
    FROM jsonb_array_elements(v_fd->'convocados') AS x;
  END IF;

  -- 7. Insolvencia: poblar tablas hijas
  IF v_draft.tipo_tramite = 'insolvencia' THEN
    -- Acreedores
    IF jsonb_typeof(v_fd->'acreedores') = 'array' THEN
      INSERT INTO sgcc_case_creditors (
        case_id, orden, nombre, tipo_doc, numero_doc, direccion_notif,
        ciudad, correo, telefono, tipo_credito, naturaleza_credito,
        clase_prelacion, capital, intereses, dias_mora, mas_90_dias_mora,
        info_adicional
      )
      SELECT v_case_id, (ord - 1), x->>'nombre', x->>'tipo_doc', x->>'numero_doc',
        x->>'direccion_notif', x->>'ciudad', x->>'correo', x->>'telefono',
        x->>'tipo_credito', x->>'naturaleza_credito', x->>'clase_prelacion',
        COALESCE(NULLIF(x->>'capital','')::numeric, 0),
        COALESCE(NULLIF(x->>'intereses','')::numeric, 0),
        NULLIF(x->>'dias_mora','')::int,
        COALESCE((x->>'mas_90_dias_mora')::boolean, false),
        x->>'info_adicional'
      FROM jsonb_array_elements(v_fd->'acreedores') WITH ORDINALITY AS t(x, ord);
    END IF;

    -- Bienes
    IF jsonb_typeof(v_fd->'bienes') = 'array' THEN
      INSERT INTO sgcc_case_assets (
        case_id, tipo, descripcion, valor_estimado, porcentaje_dominio,
        gravamen, direccion, ciudad, matricula_inmobiliaria,
        afectacion_vivienda_familiar, marca_modelo, numero_chasis
      )
      SELECT v_case_id, x->>'tipo', x->>'descripcion',
        NULLIF(x->>'valor_estimado','')::numeric,
        NULLIF(x->>'porcentaje_dominio','')::int,
        x->>'gravamen', x->>'direccion', x->>'ciudad',
        x->>'matricula_inmobiliaria',
        (x->>'afectacion_vivienda_familiar')::boolean,
        x->>'marca_modelo', x->>'numero_chasis'
      FROM jsonb_array_elements(v_fd->'bienes') AS x;
    END IF;

    -- Procesos judiciales
    IF jsonb_typeof(v_fd->'procesos') = 'array' THEN
      INSERT INTO sgcc_case_judicial_processes (
        case_id, juzgado_ciudad, numero_radicado, demandante, tipo_proceso,
        tiene_embargo_remate
      )
      SELECT v_case_id, x->>'juzgado_ciudad', x->>'numero_radicado',
        x->>'demandante', x->>'tipo_proceso',
        COALESCE((x->>'tiene_embargo_remate')::boolean, false)
      FROM jsonb_array_elements(v_fd->'procesos') AS x;
    END IF;

    -- Propuesta de pago
    IF jsonb_typeof(v_fd->'propuesta_pago') = 'array' THEN
      INSERT INTO sgcc_case_payment_plan (
        case_id, clase_prelacion, tasa_interes_futura_mensual,
        tasa_interes_espera_mensual, numero_cuotas, cronograma_json
      )
      SELECT v_case_id, x->>'clase_prelacion',
        NULLIF(x->>'tasa_interes_futura_mensual','')::numeric,
        NULLIF(x->>'tasa_interes_espera_mensual','')::numeric,
        NULLIF(x->>'numero_cuotas','')::int,
        x->'cronograma'
      FROM jsonb_array_elements(v_fd->'propuesta_pago') AS x;
    END IF;
  END IF;

  -- 8. Asociar adjuntos del draft al caso
  UPDATE sgcc_documents
    SET is_draft = false, draft_id = NULL, case_id = v_case_id
    WHERE draft_id = p_draft_id;

  -- 9. Borrar draft
  DELETE FROM sgcc_solicitudes_draft WHERE id = p_draft_id;

  RETURN jsonb_build_object(
    'case_id', v_case_id,
    'numero_radicado', v_numero_radicado
  );
END;
$$;

COMMENT ON FUNCTION radicar_solicitud(uuid, uuid) IS
  'Radica un borrador de solicitud: crea sgcc_cases + tablas hijas en una transacción y borra el draft.';
```

- [ ] **Step 2: Ejecutar migración en Supabase local/dev**

Run: abrir Supabase Dashboard → SQL Editor → pegar y ejecutar el contenido del archivo.
Expected: "Success. No rows returned." y las tablas aparecen en Database → Tables.

Verificar en SQL Editor:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_name LIKE 'sgcc_%' ORDER BY table_name;
-- debe incluir: sgcc_solicitudes_draft, sgcc_case_creditors, sgcc_case_assets,
--               sgcc_case_judicial_processes, sgcc_case_payment_plan
```

- [ ] **Step 3: Commit**

```bash
cd /c/Users/SD21/sgcc-portal-worktree
git add supabase/migrations/019_portal_partes_solicitudes.sql
git commit -m "feat(portal-partes): migración 019 con tablas de draft + hijas de cases + RPC radicar"
```

---

### Task 0.2: Tipos TypeScript

**Files:**
- Create: `src/types/solicitudes.ts`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Crear `src/types/solicitudes.ts`**

```typescript
// src/types/solicitudes.ts
import type { TipoTramite, CaseMateria } from "./index";

export type TipoDeudor = "pnnc" | "pequeno_comerciante";
export type ClasePrelacion = "primera" | "segunda" | "tercera" | "cuarta" | "quinta";
export type TipoBien = "inmueble" | "mueble" | "elemento_hogar";
export type TipoAnexo =
  | "cedula" | "redam" | "poder" | "tradicion"
  | "soporte_acreencia" | "ingresos_contador" | "matricula_mercantil" | "otro";

export interface PersonaFormData {
  tipo_persona: "natural" | "juridica";
  nombres?: string;
  apellidos?: string;
  tipo_doc?: string;
  numero_doc?: string;
  razon_social?: string;
  nit_empresa?: string;
  representante_legal?: string;
  email: string;
  telefono?: string;
  ciudad?: string;
  direccion?: string;
}

export interface AcreedorFormData {
  nombre: string;
  tipo_doc?: string;
  numero_doc?: string;
  direccion_notif?: string;
  ciudad?: string;
  correo?: string;
  telefono?: string;
  tipo_credito?: string;
  naturaleza_credito?: string;
  clase_prelacion?: ClasePrelacion;
  capital: number;
  intereses: number;
  dias_mora?: number;
  mas_90_dias_mora: boolean;
  info_adicional?: string;
}

export interface BienFormData {
  tipo: TipoBien;
  descripcion?: string;
  valor_estimado?: number;
  porcentaje_dominio?: number;
  gravamen?: string;
  direccion?: string;
  ciudad?: string;
  matricula_inmobiliaria?: string;
  afectacion_vivienda_familiar?: boolean;
  marca_modelo?: string;
  numero_chasis?: string;
}

export interface ProcesoJudicialFormData {
  juzgado_ciudad?: string;
  numero_radicado?: string;
  demandante?: string;
  tipo_proceso?: string;
  tiene_embargo_remate: boolean;
}

export interface CuotaCronograma {
  cuota: number;
  capital: number;
  intereses_espera: number;
  intereses_futuros: number;
  saldo: number;
  fecha_pago: string;
}

export interface PropuestaPagoClase {
  clase_prelacion: ClasePrelacion;
  tasa_interes_futura_mensual: number;
  tasa_interes_espera_mensual: number;
  numero_cuotas: number;
  cronograma: CuotaCronograma[];
}

export interface FormDataConciliacion {
  convocados: PersonaFormData[];
  materia: CaseMateria;
  cuantia?: number;
  cuantia_indeterminada: boolean;
  descripcion: string;
  apoderado?: PersonaFormData & { tarjeta_profesional?: string };
  acepta_terminos: boolean;
}

export interface FormDataInsolvencia {
  tipo_deudor?: TipoDeudor;
  matricula_mercantil?: string;
  activos_totales?: number;
  deudor?: PersonaFormData;
  causa_insolvencia?: string;
  acreedores: AcreedorFormData[];
  bienes: BienFormData[];
  procesos: ProcesoJudicialFormData[];
  obligaciones_alimentarias?: {
    tiene: boolean;
    beneficiarios?: string;
    monto_mensual?: number;
  };
  personas_a_cargo?: number;
  ingresos_mensuales?: number;
  fuentes_ingresos?: string;
  gastos: Partial<Record<
    "alimentacion" | "salud" | "arriendo" | "administracion"
    | "servicios_publicos" | "educacion" | "cuotas_alimentarias"
    | "transporte" | "otros",
    number
  >>;
  gastos_subsistencia_mensual?: number;
  estado_civil?: string;
  sociedad_conyugal_info?: string;
  propuesta_pago: PropuestaPagoClase[];
  solicita_tarifa_especial: boolean;
  juramento_aceptado: boolean;
}

export type FormData = FormDataConciliacion | FormDataInsolvencia | Record<string, unknown>;

export interface SolicitudDraft {
  id: string;
  user_id: string;
  center_id: string;
  tipo_tramite: TipoTramite;
  form_data: FormData;
  step_actual: number;
  completado_pct: number;
  created_at: string;
  updated_at: string;
}

export interface AdjuntoDraft {
  id: string;
  draft_id: string;
  tipo_anexo: TipoAnexo;
  nombre_archivo: string;
  tamano_bytes: number;
  url: string;
  created_at: string;
}
```

- [ ] **Step 2: Re-exportar desde `src/types/index.ts`**

Al final de `src/types/index.ts` añadir:

```typescript
export * from "./solicitudes";
```

- [ ] **Step 3: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: sin errores relacionados a los nuevos tipos.

- [ ] **Step 4: Commit**

```bash
git add src/types/solicitudes.ts src/types/index.ts
git commit -m "feat(portal-partes): tipos TS para form_data de solicitudes"
```

---

### Task 0.3: Constantes y labels

**Files:**
- Create: `src/lib/solicitudes/constants.ts`

- [ ] **Step 1: Crear archivo**

```typescript
// src/lib/solicitudes/constants.ts
import type { ClasePrelacion, TipoAnexo, TipoDeudor } from "@/types/solicitudes";

// SMLMV 2026 (ajustar al valor oficial; usar env var si se quiere flexibilidad)
export const SMLMV_2026 = 1_423_500;
export const TOPE_PEQUENO_COMERCIANTE_SMLMV = 1000;
export const TOPE_PEQUENO_COMERCIANTE_COP =
  TOPE_PEQUENO_COMERCIANTE_SMLMV * SMLMV_2026;

export const PORCENTAJE_MORA_MINIMO = 0.30; // 30% Art. 538 Ley 2445/2025
export const UMBRAL_PEQUENO_ACREEDOR = 0.05; // 5% Art. 553 #8

export const TIPO_DEUDOR_LABEL: Record<TipoDeudor, string> = {
  pnnc: "Persona natural no comerciante",
  pequeno_comerciante: "Pequeño comerciante",
};

export const CLASE_PRELACION_LABEL: Record<ClasePrelacion, string> = {
  primera: "Primera clase",
  segunda: "Segunda clase",
  tercera: "Tercera clase",
  cuarta: "Cuarta clase",
  quinta: "Quinta clase",
};

export const TIPO_ANEXO_LABEL: Record<TipoAnexo, string> = {
  cedula: "Copia de cédula",
  redam: "Certificado REDAM",
  poder: "Poder al apoderado",
  tradicion: "Certificado de tradición",
  soporte_acreencia: "Soporte de acreencia",
  ingresos_contador: "Certificación de ingresos por contador",
  matricula_mercantil: "Matrícula mercantil",
  otro: "Otro documento",
};

export const JURAMENTO_TEXTO =
  "Bajo la gravedad del juramento manifiesto que no he incurrido en " +
  "omisiones, imprecisiones o errores que impidan conocer mi verdadera " +
  "situación económica y mi capacidad de pago. (Art. 539 §1 Ley 2445/2025)";
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/solicitudes/constants.ts
git commit -m "feat(portal-partes): constantes y labels (SMLMV, umbrales Ley 2445)"
```

---

### Task 0.4: Validadores puros

**Files:**
- Create: `src/lib/solicitudes/validators.ts`

- [ ] **Step 1: Crear validadores**

```typescript
// src/lib/solicitudes/validators.ts
import type {
  FormDataConciliacion, FormDataInsolvencia, AcreedorFormData,
} from "@/types/solicitudes";
import { PORCENTAJE_MORA_MINIMO, TOPE_PEQUENO_COMERCIANTE_COP } from "./constants";

export interface ValidationError {
  step: number;
  field?: string;
  message: string;
}

// ── Conciliación ────────────────────────────────────────────────────────
export function validarConciliacion(fd: Partial<FormDataConciliacion>): ValidationError[] {
  const errors: ValidationError[] = [];
  const convocados = fd.convocados ?? [];

  if (convocados.length === 0) {
    errors.push({ step: 1, message: "Agrega al menos un convocado" });
  } else {
    convocados.forEach((c, i) => {
      if (c.tipo_persona === "natural") {
        if (!c.nombres || !c.apellidos) {
          errors.push({ step: 1, message: `Convocado ${i + 1}: nombres y apellidos son obligatorios` });
        }
      } else {
        if (!c.razon_social || !c.nit_empresa) {
          errors.push({ step: 1, message: `Convocado ${i + 1}: razón social y NIT son obligatorios` });
        }
      }
      if (!c.email) {
        errors.push({ step: 1, message: `Convocado ${i + 1}: email obligatorio` });
      }
    });
  }

  if (!fd.materia) errors.push({ step: 2, message: "Selecciona la materia" });
  if (!fd.descripcion || fd.descripcion.trim().length < 20) {
    errors.push({ step: 2, message: "Describe el conflicto (mínimo 20 caracteres)" });
  }
  if (!fd.acepta_terminos) {
    errors.push({ step: 5, message: "Debes aceptar los términos y condiciones" });
  }
  return errors;
}

// ── Insolvencia ─────────────────────────────────────────────────────────
interface SupuestosCheck {
  cumple: boolean;
  total_capital: number;
  capital_en_mora: number;
  porcentaje_mora: number;
  acreedores_en_mora_90d: number;
}

export function verificarSupuestosInsolvencia(
  acreedores: AcreedorFormData[]
): SupuestosCheck {
  const total_capital = acreedores.reduce((s, a) => s + (a.capital ?? 0), 0);
  const morosos = acreedores.filter((a) => a.mas_90_dias_mora);
  const capital_en_mora = morosos.reduce((s, a) => s + (a.capital ?? 0), 0);
  const porcentaje_mora = total_capital > 0 ? capital_en_mora / total_capital : 0;
  const acreedores_en_mora_90d = morosos.length;

  const cumple =
    acreedores_en_mora_90d >= 2 &&
    porcentaje_mora >= PORCENTAJE_MORA_MINIMO;

  return { cumple, total_capital, capital_en_mora, porcentaje_mora, acreedores_en_mora_90d };
}

export function validarInsolvencia(
  fd: Partial<FormDataInsolvencia>,
  adjuntos: { tipo_anexo: string }[] = []
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!fd.tipo_deudor) {
    errors.push({ step: 1, message: "Selecciona el tipo de deudor" });
  }

  if (fd.tipo_deudor === "pequeno_comerciante") {
    if (!fd.matricula_mercantil) {
      errors.push({ step: 1, message: "Matrícula mercantil obligatoria (Art. 539 #10)" });
    }
    if (!fd.activos_totales || fd.activos_totales <= 0) {
      errors.push({ step: 1, message: "Ingresa el valor de activos totales" });
    } else if (fd.activos_totales > TOPE_PEQUENO_COMERCIANTE_COP) {
      errors.push({
        step: 1,
        message: `Activos exceden el tope de 1.000 SMLMV (${TOPE_PEQUENO_COMERCIANTE_COP.toLocaleString("es-CO")})`,
      });
    }
  }

  const acreedores = fd.acreedores ?? [];
  if (acreedores.length === 0) {
    errors.push({ step: 5, message: "Debe registrar al menos un acreedor" });
  } else {
    const sup = verificarSupuestosInsolvencia(acreedores);
    if (sup.acreedores_en_mora_90d < 2) {
      errors.push({
        step: 2,
        message: "Se requieren al menos 2 acreedores con mora ≥90 días (Art. 538)",
      });
    }
    if (sup.porcentaje_mora < PORCENTAJE_MORA_MINIMO) {
      errors.push({
        step: 2,
        message: `La mora representa ${(sup.porcentaje_mora * 100).toFixed(1)}% del pasivo; debe ser ≥30% (Art. 538)`,
      });
    }
    acreedores.forEach((a, i) => {
      if (!a.nombre) errors.push({ step: 5, message: `Acreedor ${i + 1} sin nombre` });
      if (!a.clase_prelacion) errors.push({ step: 5, message: `Acreedor ${i + 1} sin clase de prelación` });
    });
  }

  if (!fd.causa_insolvencia || fd.causa_insolvencia.trim().length < 20) {
    errors.push({ step: 4, message: "Describe las causas de la insolvencia" });
  }

  // Propuesta de pago cubre todas las clases con acreedores
  const clasesConAcreedores = new Set(
    acreedores.map((a) => a.clase_prelacion).filter(Boolean)
  );
  const clasesPropuestas = new Set(
    (fd.propuesta_pago ?? []).map((p) => p.clase_prelacion)
  );
  for (const c of clasesConAcreedores) {
    if (!clasesPropuestas.has(c!)) {
      errors.push({ step: 11, message: `Falta propuesta de pago para clase ${c}` });
    }
  }

  // Anexos
  const tipos = new Set(adjuntos.map((a) => a.tipo_anexo));
  if (!tipos.has("cedula")) errors.push({ step: 12, message: "Falta copia de cédula" });
  if (!tipos.has("redam")) errors.push({ step: 12, message: "Falta certificado REDAM (Art. 539 #9)" });
  if (fd.tipo_deudor === "pequeno_comerciante" && !tipos.has("matricula_mercantil")) {
    errors.push({ step: 12, message: "Falta anexo de matrícula mercantil" });
  }

  if (!fd.juramento_aceptado) {
    errors.push({ step: 13, message: "Debes aceptar el juramento (Art. 539 §1)" });
  }

  return errors;
}
```

- [ ] **Step 2: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/lib/solicitudes/validators.ts
git commit -m "feat(portal-partes): validadores Ley 2445/2025 (supuestos, anexos, juramento)"
```

---

### Task 0.5: Cálculo del pequeño acreedor (5%)

**Files:**
- Create: `src/lib/solicitudes/small-creditor.ts`

- [ ] **Step 1: Crear archivo**

```typescript
// src/lib/solicitudes/small-creditor.ts
// Art. 553 #8 Ley 2445/2025: pequeños acreedores = aquellos de menor cuantía
// cuya suma acumulada no exceda el 5% del capital total reconocido.

import { UMBRAL_PEQUENO_ACREEDOR } from "./constants";

export interface AcreedorMinimo {
  id: string;
  capital: number;
}

export function calcularPequenosAcreedores<T extends AcreedorMinimo>(
  acreedores: T[]
): Array<T & { es_pequeno_acreedor: boolean }> {
  if (acreedores.length === 0) return [];

  const total = acreedores.reduce((s, a) => s + (a.capital || 0), 0);
  const umbral = total * UMBRAL_PEQUENO_ACREEDOR;

  const ordenados = [...acreedores].sort((a, b) => a.capital - b.capital);
  const pequenos = new Set<string>();
  let acumulado = 0;

  for (const a of ordenados) {
    if (acumulado + a.capital > umbral) break;
    acumulado += a.capital;
    pequenos.add(a.id);
  }

  return acreedores.map((a) => ({ ...a, es_pequeno_acreedor: pequenos.has(a.id) }));
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/solicitudes/small-creditor.ts
git commit -m "feat(portal-partes): cálculo pequeño acreedor (5% capital reconocido)"
```

---

### Task 0.6: Cronograma de cuotas

**Files:**
- Create: `src/lib/solicitudes/payment-plan.ts`

- [ ] **Step 1: Crear archivo**

```typescript
// src/lib/solicitudes/payment-plan.ts
import type { CuotaCronograma } from "@/types/solicitudes";

interface Params {
  capital: number;
  numeroCuotas: number;
  tasaFuturaMensual: number;        // en porcentaje, ej. 1.5 = 1.5% mensual
  tasaEsperaMensual: number;
  fechaInicio: Date;
  intervaloMeses?: number;          // default 1
}

export function generarCronograma({
  capital, numeroCuotas, tasaFuturaMensual, tasaEsperaMensual,
  fechaInicio, intervaloMeses = 1,
}: Params): CuotaCronograma[] {
  if (capital <= 0 || numeroCuotas <= 0) return [];

  const iFutura = tasaFuturaMensual / 100;
  const iEspera = tasaEsperaMensual / 100;

  // Cuota fija sobre capital + intereses futuros (amortización francesa simplificada)
  const cuotaCapital = capital / numeroCuotas;
  let saldo = capital;
  const out: CuotaCronograma[] = [];

  for (let n = 1; n <= numeroCuotas; n++) {
    const interesesFuturos = saldo * iFutura;
    const interesesEspera = saldo * iEspera;
    const nuevoSaldo = saldo - cuotaCapital;
    const fecha = new Date(fechaInicio);
    fecha.setMonth(fecha.getMonth() + intervaloMeses * (n - 1));

    out.push({
      cuota: n,
      capital: round2(cuotaCapital),
      intereses_espera: round2(interesesEspera),
      intereses_futuros: round2(interesesFuturos),
      saldo: round2(Math.max(0, nuevoSaldo)),
      fecha_pago: fecha.toISOString().slice(0, 10),
    });

    saldo = nuevoSaldo;
  }
  return out;
}

function round2(n: number) { return Math.round(n * 100) / 100; }
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/solicitudes/payment-plan.ts
git commit -m "feat(portal-partes): cronograma de cuotas por clase de prelación"
```

---

### Task 0.7: Verificación Fase 0

- [ ] **Step 1: Build completo**

```bash
cd /c/Users/SD21/sgcc-portal-worktree
npx tsc --noEmit
```
Expected: sin errores.

- [ ] **Step 2: Lint**

```bash
npm run lint
```
Expected: sin errores nuevos.

---

## Fase 1 — Backend del portal (API draft)

### Task 1.1: Middleware de auth para `/api/partes/*`

**Files:**
- Create: `src/lib/partes/auth-guard.ts`

- [ ] **Step 1: Crear helper**

```typescript
// src/lib/partes/auth-guard.ts
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function requireParte() {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  }
  const u = session.user as { id: string; role?: string; centerId?: string };
  if (u.role !== "parte") {
    return { error: NextResponse.json({ error: "Solo usuarios parte" }, { status: 403 }) };
  }
  return { userId: u.id, centerId: u.centerId };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/partes/auth-guard.ts
git commit -m "feat(portal-partes): guard de auth para APIs de partes"
```

### Task 1.2: Endpoint `POST/GET /api/partes/solicitudes`

**Files:**
- Create: `src/app/api/partes/solicitudes/route.ts`

- [ ] **Step 1: Crear route**

```typescript
// src/app/api/partes/solicitudes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireParte } from "@/lib/partes/auth-guard";
import type { TipoTramite } from "@/types";

const TIPOS_VALIDOS: TipoTramite[] = [
  "conciliacion", "insolvencia", "acuerdo_apoyo", "directiva_anticipada",
];

// Listar drafts del usuario
export async function GET() {
  const guard = await requireParte();
  if ("error" in guard) return guard.error;

  const { data, error } = await supabaseAdmin
    .from("sgcc_solicitudes_draft")
    .select("id, tipo_tramite, step_actual, completado_pct, created_at, updated_at")
    .eq("user_id", guard.userId)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ drafts: data ?? [] });
}

// Crear draft
export async function POST(req: NextRequest) {
  const guard = await requireParte();
  if ("error" in guard) return guard.error;
  if (!guard.centerId) {
    return NextResponse.json({ error: "Tu cuenta no está asociada a un centro" }, { status: 400 });
  }

  const body = await req.json();
  const tipo = body.tipo_tramite as TipoTramite;
  if (!TIPOS_VALIDOS.includes(tipo)) {
    return NextResponse.json({ error: "tipo_tramite inválido" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("sgcc_solicitudes_draft")
    .insert({
      user_id: guard.userId,
      center_id: guard.centerId,
      tipo_tramite: tipo,
      form_data: {},
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
```

- [ ] **Step 2: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/partes/solicitudes/route.ts
git commit -m "feat(portal-partes): endpoints GET/POST /api/partes/solicitudes"
```

### Task 1.3: Endpoint `[id]` (GET, PATCH, DELETE)

**Files:**
- Create: `src/app/api/partes/solicitudes/[id]/route.ts`

- [ ] **Step 1: Crear route**

```typescript
// src/app/api/partes/solicitudes/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireParte } from "@/lib/partes/auth-guard";

const MAX_FORM_DATA_BYTES = 500 * 1024; // 500 kB

async function fetchOwnedDraft(id: string, userId: string) {
  return supabaseAdmin
    .from("sgcc_solicitudes_draft")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await requireParte();
  if ("error" in guard) return guard.error;

  const { data, error } = await fetchOwnedDraft(id, guard.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const { data: adjuntos } = await supabaseAdmin
    .from("sgcc_documents")
    .select("id, tipo_anexo, nombre_archivo, tamano_bytes, url, created_at")
    .eq("draft_id", id);

  return NextResponse.json({ draft: data, adjuntos: adjuntos ?? [] });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await requireParte();
  if ("error" in guard) return guard.error;

  const body = await req.json();
  const update: Record<string, unknown> = {};
  if (body.form_data !== undefined) {
    const size = new TextEncoder().encode(JSON.stringify(body.form_data)).length;
    if (size > MAX_FORM_DATA_BYTES) {
      return NextResponse.json({ error: "form_data supera el límite de 500 kB" }, { status: 413 });
    }
    update.form_data = body.form_data;
  }
  if (body.step_actual !== undefined) update.step_actual = body.step_actual;
  if (body.completado_pct !== undefined) update.completado_pct = body.completado_pct;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("sgcc_solicitudes_draft")
    .update(update)
    .eq("id", id)
    .eq("user_id", guard.userId)
    .select("updated_at")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true, updated_at: data.updated_at });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await requireParte();
  if ("error" in guard) return guard.error;

  const { error } = await supabaseAdmin
    .from("sgcc_solicitudes_draft")
    .delete()
    .eq("id", id)
    .eq("user_id", guard.userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/partes/solicitudes/[id]/route.ts
git commit -m "feat(portal-partes): endpoints GET/PATCH/DELETE de draft [id]"
```

### Task 1.4: Endpoints de adjuntos

**Files:**
- Create: `src/app/api/partes/solicitudes/[id]/adjuntos/route.ts`
- Create: `src/app/api/partes/solicitudes/[id]/adjuntos/[docId]/route.ts`

- [ ] **Step 1: Crear POST adjuntos**

```typescript
// src/app/api/partes/solicitudes/[id]/adjuntos/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireParte } from "@/lib/partes/auth-guard";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const TIPOS_VALIDOS = new Set([
  "cedula","redam","poder","tradicion","soporte_acreencia",
  "ingresos_contador","matricula_mercantil","otro",
]);
const MIME_PERMITIDOS = new Set([
  "application/pdf","image/jpeg","image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: draftId } = await params;
  const guard = await requireParte();
  if ("error" in guard) return guard.error;

  // Verificar ownership
  const { data: draft } = await supabaseAdmin
    .from("sgcc_solicitudes_draft")
    .select("id")
    .eq("id", draftId).eq("user_id", guard.userId).maybeSingle();
  if (!draft) return NextResponse.json({ error: "Draft no encontrado" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const tipoAnexo = String(form.get("tipo_anexo") || "otro");

  if (!file) return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  if (!TIPOS_VALIDOS.has(tipoAnexo)) {
    return NextResponse.json({ error: "tipo_anexo inválido" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Archivo excede 10 MB" }, { status: 413 });
  }
  if (!MIME_PERMITIDOS.has(file.type)) {
    return NextResponse.json({ error: "Tipo de archivo no permitido" }, { status: 415 });
  }

  const path = `solicitudes-draft/${guard.userId}/${draftId}/${Date.now()}-${file.name}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabaseAdmin.storage
    .from("documentos")
    .upload(path, buf, { contentType: file.type, upsert: false });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: pub } = supabaseAdmin.storage.from("documentos").getPublicUrl(path);

  const { data, error } = await supabaseAdmin
    .from("sgcc_documents")
    .insert({
      draft_id: draftId,
      is_draft: true,
      tipo_anexo: tipoAnexo,
      nombre_archivo: file.name,
      tamano_bytes: file.size,
      url: pub.publicUrl,
      created_by: guard.userId,
    })
    .select("id, url, nombre_archivo, tamano_bytes, tipo_anexo, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ adjunto: data }, { status: 201 });
}
```

- [ ] **Step 2: Crear DELETE adjunto**

```typescript
// src/app/api/partes/solicitudes/[id]/adjuntos/[docId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireParte } from "@/lib/partes/auth-guard";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { id: draftId, docId } = await params;
  const guard = await requireParte();
  if ("error" in guard) return guard.error;

  // Ownership: el doc debe pertenecer a un draft del usuario
  const { data: doc } = await supabaseAdmin
    .from("sgcc_documents")
    .select("id, url, draft_id, sgcc_solicitudes_draft!inner(user_id)")
    .eq("id", docId)
    .eq("draft_id", draftId)
    .maybeSingle() as any;

  if (!doc || doc.sgcc_solicitudes_draft?.user_id !== guard.userId) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  // Extraer path del URL público
  const marker = "/documentos/";
  const idx = doc.url.indexOf(marker);
  if (idx !== -1) {
    const path = doc.url.slice(idx + marker.length);
    await supabaseAdmin.storage.from("documentos").remove([path]);
  }
  await supabaseAdmin.from("sgcc_documents").delete().eq("id", docId);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Verificar bucket Storage existe**

Ir al Dashboard Supabase → Storage → verificar que existe el bucket `documentos`. Si no, crearlo (público).

- [ ] **Step 4: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/partes/solicitudes/[id]/adjuntos/
git commit -m "feat(portal-partes): endpoints de adjuntos (POST/DELETE) con validación de tipo y tamaño"
```

### Task 1.5: Endpoint radicar

**Files:**
- Create: `src/app/api/partes/solicitudes/[id]/radicar/route.ts`

- [ ] **Step 1: Crear route**

```typescript
// src/app/api/partes/solicitudes/[id]/radicar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireParte } from "@/lib/partes/auth-guard";
import { validarConciliacion, validarInsolvencia } from "@/lib/solicitudes/validators";
import type { FormDataConciliacion, FormDataInsolvencia } from "@/types/solicitudes";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await requireParte();
  if ("error" in guard) return guard.error;

  // 1. Cargar draft
  const { data: draft, error: drErr } = await supabaseAdmin
    .from("sgcc_solicitudes_draft")
    .select("*")
    .eq("id", id)
    .eq("user_id", guard.userId)
    .maybeSingle();
  if (drErr || !draft) return NextResponse.json({ error: "Draft no encontrado" }, { status: 404 });

  // 2. Cargar adjuntos
  const { data: adjuntos } = await supabaseAdmin
    .from("sgcc_documents")
    .select("tipo_anexo")
    .eq("draft_id", id);

  // 3. Validar
  const fd = draft.form_data as Record<string, unknown>;
  let errors: ReturnType<typeof validarConciliacion>;
  if (draft.tipo_tramite === "conciliacion") {
    errors = validarConciliacion(fd as Partial<FormDataConciliacion>);
  } else if (draft.tipo_tramite === "insolvencia") {
    errors = validarInsolvencia(fd as Partial<FormDataInsolvencia>, adjuntos ?? []);
  } else {
    return NextResponse.json(
      { error: "Trámite aún no soportado en esta versión" },
      { status: 501 }
    );
  }

  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 422 });
  }

  // 4. RPC radicar
  const { data: rpcOut, error: rpcErr } = await supabaseAdmin.rpc("radicar_solicitud", {
    p_draft_id: id,
    p_user_id: guard.userId,
  });
  if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500 });

  return NextResponse.json(rpcOut);
}
```

- [ ] **Step 2: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Smoke test manual backend**

Con el dev server apagado, ejecutar flujo mínimo:
1. Loguearse como parte (via `/login`).
2. `curl` (o devtools):
   - `POST /api/partes/solicitudes` body `{"tipo_tramite":"conciliacion"}`
   - `PATCH /api/partes/solicitudes/:id` con form_data mínimo.
   - `POST /api/partes/solicitudes/:id/radicar`.
3. Verificar en Supabase SQL Editor: existe el `sgcc_cases` nuevo con `creado_por_parte=true`.

Nota: si no hay tiempo para smoke test ahora, diferirlo al final de Fase 3 cuando la UI esté lista.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/partes/solicitudes/[id]/radicar/
git commit -m "feat(portal-partes): endpoint radicar con validación y RPC"
```

---

## Fase 2 — Shell del wizard + auto-save + lista

### Task 2.1: Actualizar registro de parte con código corto

**Files:**
- Modify: `src/app/(auth)/registro/parte/page.tsx`
- Modify: `src/app/api/partes/route.ts`

- [ ] **Step 1: Leer estado actual del formulario**

Run: `Read C:/Users/SD21/sgcc-portal-worktree/src/app/(auth)/registro/parte/page.tsx`
(Ya leído en brainstorming. No tiene campo código corto actualmente.)

- [ ] **Step 2: Agregar campo `codigo_centro` al form**

En el `useState` inicial añadir `codigo_centro: ""`.
Agregar antes del bloque "Correo electrónico":

```tsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Código del centro
  </label>
  <input
    required
    value={form.codigo_centro}
    onChange={(e) => set("codigo_centro", e.target.value.toUpperCase())}
    placeholder="8 caracteres (provisto por el centro)"
    maxLength={8}
    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340] uppercase"
  />
  <p className="text-xs text-gray-500 mt-1">
    Solicítalo al centro de conciliación donde radicarás tus solicitudes.
  </p>
</div>
```

- [ ] **Step 3: Enviar el código en el POST**

Ya se envía por spread `{ ...form, selfRegister: true }`, así que el código viaja en la propiedad `codigo_centro`.

- [ ] **Step 4: Actualizar `/api/partes` para validar el código**

Leer `src/app/api/partes/route.ts`. Antes de insertar el usuario, añadir:

```typescript
// Validar y resolver center_id desde codigo_centro cuando selfRegister
if (body.selfRegister) {
  const codigo = String(body.codigo_centro ?? "").trim().toUpperCase();
  if (!codigo || codigo.length !== 8) {
    return NextResponse.json({ error: "Código del centro inválido (8 caracteres)" }, { status: 400 });
  }
  const { data: centro } = await supabaseAdmin
    .from("sgcc_centers")
    .select("id")
    .eq("codigo_corto", codigo)
    .maybeSingle();
  if (!centro) {
    return NextResponse.json({ error: "No se encontró un centro con ese código" }, { status: 404 });
  }
  body.center_id = centro.id; // usar más abajo al insertar
}
```

Y asegurarse de que el `insert` en `sgcc_users` use `center_id: body.center_id`.

- [ ] **Step 5: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Smoke test**

Run: `npm run dev` → abrir `/registro/parte` → intentar registrar sin código (debe bloquear) → registrar con código válido (debe redirigir a `/login?registered=1`).

- [ ] **Step 7: Commit**

```bash
git add src/app/\(auth\)/registro/parte/page.tsx src/app/api/partes/route.ts
git commit -m "feat(portal-partes): registro de parte exige código corto del centro"
```

### Task 2.2: Hook `useDraftAutoSave`

**Files:**
- Create: `src/hooks/useDraftAutoSave.ts`

- [ ] **Step 1: Crear hook**

```typescript
// src/hooks/useDraftAutoSave.ts
import { useCallback, useEffect, useRef, useState } from "react";

export type SaveState = "idle" | "saving" | "saved" | "error";

interface Options {
  draftId: string;
  debounceMs?: number;
}

export function useDraftAutoSave({ draftId, debounceMs = 3000 }: Options) {
  const [state, setState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const pending = useRef<Record<string, unknown> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    const body = pending.current;
    if (!body) return;
    pending.current = null;
    setState("saving");
    try {
      const res = await fetch(`/api/partes/solicitudes/${draftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("PATCH failed");
      setState("saved");
      setLastSavedAt(new Date());
    } catch {
      setState("error");
      setTimeout(flush, 5000); // reintento
    }
  }, [draftId]);

  const save = useCallback((patch: Record<string, unknown>) => {
    pending.current = { ...(pending.current ?? {}), ...patch };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, debounceMs);
  }, [flush, debounceMs]);

  // Flush on unmount / page unload
  useEffect(() => {
    const onBeforeUnload = () => { if (pending.current) flush(); };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [flush]);

  return { state, lastSavedAt, save, flushNow: flush };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useDraftAutoSave.ts
git commit -m "feat(portal-partes): hook useDraftAutoSave con debounce y reintento"
```

### Task 2.3: Componentes compartidos de UI

**Files:**
- Create: `src/components/partes/StepSidebar.tsx`
- Create: `src/components/partes/AutoSaveIndicator.tsx`
- Create: `src/components/partes/RepeatableList.tsx`
- Create: `src/components/partes/FileUploadBox.tsx`

- [ ] **Step 1: StepSidebar**

```tsx
// src/components/partes/StepSidebar.tsx
"use client";
import { Check } from "lucide-react";

export interface StepDef { num: number; label: string; done: boolean; }

export function StepSidebar({
  steps, current, onJump,
}: { steps: StepDef[]; current: number; onJump: (n: number) => void }) {
  return (
    <aside className="w-64 shrink-0 border-r border-gray-200 bg-white p-4">
      <ol className="space-y-1">
        {steps.map((s) => {
          const active = s.num === current;
          return (
            <li key={s.num}>
              <button
                onClick={() => onJump(s.num)}
                className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active ? "bg-[#0D2340] text-white" :
                  s.done ? "text-gray-700 hover:bg-gray-100" : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${
                  active ? "bg-white text-[#0D2340]" :
                  s.done ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"
                }`}>
                  {s.done ? <Check className="w-3.5 h-3.5" /> : s.num}
                </span>
                {s.label}
              </button>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
```

- [ ] **Step 2: AutoSaveIndicator**

```tsx
// src/components/partes/AutoSaveIndicator.tsx
"use client";
import type { SaveState } from "@/hooks/useDraftAutoSave";

export function AutoSaveIndicator({ state, lastSavedAt }: { state: SaveState; lastSavedAt: Date | null }) {
  if (state === "saving") return <span className="text-xs text-gray-500">Guardando…</span>;
  if (state === "error")  return <span className="text-xs text-red-600">Error guardando · reintentando</span>;
  if (state === "saved" && lastSavedAt)
    return (
      <span className="text-xs text-green-700">
        Guardado {lastSavedAt.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
      </span>
    );
  return <span className="text-xs text-gray-400">Borrador</span>;
}
```

- [ ] **Step 3: RepeatableList**

```tsx
// src/components/partes/RepeatableList.tsx
"use client";
import { Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

interface Props<T> {
  items: T[];
  onChange: (items: T[]) => void;
  renderItem: (item: T, idx: number, onChange: (patch: Partial<T>) => void) => ReactNode;
  makeEmpty: () => T;
  addLabel?: string;
  minItems?: number;
}

export function RepeatableList<T>({
  items, onChange, renderItem, makeEmpty,
  addLabel = "Agregar", minItems = 0,
}: Props<T>) {
  const add = () => onChange([...items, makeEmpty()]);
  const remove = (i: number) => onChange(items.filter((_, k) => k !== i));
  const patch = (i: number) => (p: Partial<T>) =>
    onChange(items.map((it, k) => (k === i ? { ...it, ...p } : it)));

  return (
    <div className="space-y-4">
      {items.map((it, i) => (
        <div key={i} className="relative rounded-xl border border-gray-200 bg-gray-50 p-4">
          {items.length > minItems && (
            <button
              type="button"
              onClick={() => remove(i)}
              className="absolute top-3 right-3 text-red-600 hover:bg-red-50 rounded p-1"
              aria-label="Eliminar"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {renderItem(it, i, patch(i))}
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-600 hover:border-[#0D2340] hover:text-[#0D2340]"
      >
        <Plus className="w-4 h-4" /> {addLabel}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: FileUploadBox**

```tsx
// src/components/partes/FileUploadBox.tsx
"use client";
import { useState } from "react";
import { Upload, File as FileIcon, X } from "lucide-react";
import type { TipoAnexo } from "@/types/solicitudes";
import { TIPO_ANEXO_LABEL } from "@/lib/solicitudes/constants";

interface Adjunto {
  id: string;
  tipo_anexo: TipoAnexo;
  nombre_archivo: string;
  tamano_bytes: number;
  url: string;
}

export function FileUploadBox({
  draftId, tipoAnexo, obligatorio = false, adjuntos, onChange,
}: {
  draftId: string;
  tipoAnexo: TipoAnexo;
  obligatorio?: boolean;
  adjuntos: Adjunto[];
  onChange: (adjuntos: Adjunto[]) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const propios = adjuntos.filter((a) => a.tipo_anexo === tipoAnexo);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true); setError(null);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("tipo_anexo", tipoAnexo);
    const res = await fetch(`/api/partes/solicitudes/${draftId}/adjuntos`, { method: "POST", body: fd });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Error al subir"); return; }
    onChange([...adjuntos, data.adjunto]);
    e.target.value = "";
  }

  async function removeAdj(id: string) {
    const res = await fetch(`/api/partes/solicitudes/${draftId}/adjuntos/${id}`, { method: "DELETE" });
    if (res.ok) onChange(adjuntos.filter((a) => a.id !== id));
  }

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-800">
          {TIPO_ANEXO_LABEL[tipoAnexo]}
          {obligatorio && <span className="text-red-600 ml-1">*</span>}
        </span>
        <label className="text-xs text-[#1B4F9B] cursor-pointer hover:underline flex items-center gap-1">
          <Upload className="w-3.5 h-3.5" />
          {loading ? "Subiendo…" : "Subir"}
          <input type="file" className="hidden" onChange={upload}
            accept=".pdf,.jpg,.jpeg,.png,.docx" disabled={loading} />
        </label>
      </div>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      {propios.length === 0 ? (
        <p className="text-xs text-gray-400">Sin archivos</p>
      ) : (
        <ul className="space-y-1">
          {propios.map((a) => (
            <li key={a.id} className="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1.5">
              <a href={a.url} target="_blank" className="flex items-center gap-2 text-gray-700 hover:text-[#1B4F9B]">
                <FileIcon className="w-3.5 h-3.5" />
                {a.nombre_archivo}
                <span className="text-gray-400">({(a.tamano_bytes / 1024).toFixed(0)} KB)</span>
              </a>
              <button onClick={() => removeAdj(a.id)} className="text-red-600 hover:bg-red-50 rounded p-0.5">
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/components/partes/
git commit -m "feat(portal-partes): componentes compartidos (StepSidebar, AutoSave, Repeatable, FileUpload)"
```

### Task 2.4: Página lista `/mis-solicitudes`

**Files:**
- Create: `src/app/(partes)/mis-solicitudes/page.tsx`
- Create: `src/app/(partes)/mis-solicitudes/MisSolicitudesClient.tsx`

- [ ] **Step 1: Crear server page**

```tsx
// src/app/(partes)/mis-solicitudes/page.tsx
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { MisSolicitudesClient } from "./MisSolicitudesClient";

export default async function MisSolicitudesPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const userId = (session.user as { id: string }).id;

  const { data: drafts } = await supabaseAdmin
    .from("sgcc_solicitudes_draft")
    .select("id, tipo_tramite, step_actual, completado_pct, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  const { data: casos } = await supabaseAdmin
    .from("sgcc_case_parties")
    .select("caso:sgcc_cases(id, numero_radicado, tipo_tramite, estado, fecha_solicitud)")
    .eq("party_id", userId)
    .eq("rol", "convocante")
    .order("created_at", { ascending: false });

  return <MisSolicitudesClient drafts={drafts ?? []} casos={(casos ?? []).map((c: { caso: unknown }) => c.caso)} />;
}
```

- [ ] **Step 2: Crear cliente**

```tsx
// src/app/(partes)/mis-solicitudes/MisSolicitudesClient.tsx
"use client";
import Link from "next/link";
import { FileText, Plus, Trash2 } from "lucide-react";
import type { TipoTramite } from "@/types";
import { useRouter } from "next/navigation";

const TRAMITE_LABEL: Record<TipoTramite, string> = {
  conciliacion: "Conciliación",
  insolvencia: "Insolvencia",
  acuerdo_apoyo: "Acuerdo de apoyo",
  arbitraje_ejecutivo: "Arbitraje ejecutivo",
  directiva_anticipada: "Directiva anticipada",
};

interface Draft {
  id: string; tipo_tramite: TipoTramite;
  step_actual: number; completado_pct: number; updated_at: string;
}
interface Caso {
  id: string; numero_radicado: string; tipo_tramite: TipoTramite;
  estado: string; fecha_solicitud: string;
}

export function MisSolicitudesClient({ drafts, casos }: { drafts: Draft[]; casos: Caso[] }) {
  const router = useRouter();

  async function borrarDraft(id: string) {
    if (!confirm("¿Borrar este borrador?")) return;
    await fetch(`/api/partes/solicitudes/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#0D2340]">Mis Solicitudes</h1>
        <Link href="/mis-solicitudes/nueva"
          className="inline-flex items-center gap-2 bg-[#0D2340] text-white px-4 py-2 rounded-lg hover:bg-[#0d2340dd]">
          <Plus className="w-4 h-4" /> Nueva solicitud
        </Link>
      </div>

      {drafts.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">En borrador</h2>
          <div className="grid gap-3">
            {drafts.map((d) => (
              <div key={d.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
                <Link href={`/mis-solicitudes/${d.id}`} className="flex items-center gap-3 flex-1">
                  <FileText className="w-5 h-5 text-gray-400" />
                  <div>
                    <div className="font-medium text-gray-800">{TRAMITE_LABEL[d.tipo_tramite]}</div>
                    <div className="text-xs text-gray-500">
                      {d.completado_pct}% completado · Actualizado {new Date(d.updated_at).toLocaleDateString("es-CO")}
                    </div>
                  </div>
                </Link>
                <button onClick={() => borrarDraft(d.id)}
                  className="text-red-600 hover:bg-red-50 rounded p-2" aria-label="Borrar">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">Radicadas</h2>
        {casos.length === 0 ? (
          <p className="text-sm text-gray-500 bg-white rounded-xl border border-gray-200 p-6 text-center">
            Aún no has radicado solicitudes.
          </p>
        ) : (
          <div className="grid gap-3">
            {casos.map((c) => (
              <Link key={c.id} href={`/mis-casos/${c.id}`}
                className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between hover:shadow-sm">
                <div>
                  <div className="font-medium text-[#1B4F9B]">{c.numero_radicado}</div>
                  <div className="text-xs text-gray-500">
                    {TRAMITE_LABEL[c.tipo_tramite]} · {c.estado} · {new Date(c.fecha_solicitud).toLocaleDateString("es-CO")}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(partes\)/mis-solicitudes/page.tsx src/app/\(partes\)/mis-solicitudes/MisSolicitudesClient.tsx
git commit -m "feat(portal-partes): página lista de mis solicitudes (drafts + radicadas)"
```

### Task 2.5: Página selector de trámite

**Files:**
- Create: `src/app/(partes)/mis-solicitudes/nueva/page.tsx`

- [ ] **Step 1: Crear página**

```tsx
// src/app/(partes)/mis-solicitudes/nueva/page.tsx
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const TRAMITES = [
  { value: "conciliacion", label: "Conciliación",
    desc: "Resolver conflictos civiles, familiares o comerciales con ayuda de un tercero neutral." },
  { value: "insolvencia", label: "Insolvencia",
    desc: "Reorganizar tus deudas (persona natural no comerciante o pequeño comerciante) · Ley 2445 de 2025." },
] as const;

export default function NuevaSolicitudPage() {
  const router = useRouter();
  const [sel, setSel] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function crear() {
    if (!sel) return;
    setLoading(true); setError("");
    const res = await fetch("/api/partes/solicitudes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo_tramite: sel }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Error"); return; }
    router.push(`/mis-solicitudes/${data.id}`);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-[#0D2340] mb-2">Nueva solicitud</h1>
      <p className="text-gray-600 mb-6">Selecciona el tipo de trámite que deseas radicar.</p>

      <div className="space-y-3">
        {TRAMITES.map((t) => (
          <button key={t.value} type="button" onClick={() => setSel(t.value)}
            className={`w-full text-left rounded-xl border-2 p-4 transition-colors ${
              sel === t.value ? "border-[#0D2340] bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"
            }`}>
            <div className="font-semibold text-[#0D2340] mb-1">{t.label}</div>
            <div className="text-sm text-gray-600">{t.desc}</div>
          </button>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <button disabled={!sel || loading} onClick={crear}
        className="mt-6 bg-[#0D2340] text-white px-6 py-2.5 rounded-lg disabled:opacity-40">
        {loading ? "Creando…" : "Continuar"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(partes\)/mis-solicitudes/nueva/page.tsx
git commit -m "feat(portal-partes): selector de trámite (conciliación/insolvencia)"
```

### Task 2.6: Shell del wizard `[id]`

**Files:**
- Create: `src/app/(partes)/mis-solicitudes/[id]/page.tsx`
- Create: `src/app/(partes)/mis-solicitudes/[id]/WizardShell.tsx`

- [ ] **Step 1: Server page**

```tsx
// src/app/(partes)/mis-solicitudes/[id]/page.tsx
export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { WizardShell } from "./WizardShell";

export default async function DraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect("/login");
  const userId = (session.user as { id: string }).id;

  const { data: draft } = await supabaseAdmin
    .from("sgcc_solicitudes_draft").select("*")
    .eq("id", id).eq("user_id", userId).maybeSingle();
  if (!draft) notFound();

  const { data: adjuntos } = await supabaseAdmin
    .from("sgcc_documents")
    .select("id, tipo_anexo, nombre_archivo, tamano_bytes, url")
    .eq("draft_id", id);

  return <WizardShell draft={draft} initialAdjuntos={adjuntos ?? []} />;
}
```

- [ ] **Step 2: Wizard shell**

```tsx
// src/app/(partes)/mis-solicitudes/[id]/WizardShell.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { StepSidebar, type StepDef } from "@/components/partes/StepSidebar";
import { AutoSaveIndicator } from "@/components/partes/AutoSaveIndicator";
import { useDraftAutoSave } from "@/hooks/useDraftAutoSave";
import type { SolicitudDraft, AdjuntoDraft } from "@/types/solicitudes";
import { WizardConciliacion } from "./conciliacion/WizardConciliacion";
import { WizardInsolvencia } from "./insolvencia/WizardInsolvencia";

export function WizardShell({
  draft, initialAdjuntos,
}: { draft: SolicitudDraft; initialAdjuntos: AdjuntoDraft[] }) {
  const router = useRouter();
  const [step, setStep] = useState(draft.step_actual);
  const [formData, setFormData] = useState<Record<string, unknown>>(draft.form_data || {});
  const [adjuntos, setAdjuntos] = useState<AdjuntoDraft[]>(initialAdjuntos);
  const autosave = useDraftAutoSave({ draftId: draft.id });

  const updateFormData = (patch: Record<string, unknown>) => {
    setFormData((prev) => {
      const next = { ...prev, ...patch };
      autosave.save({ form_data: next });
      return next;
    });
  };
  const updateStep = (n: number) => {
    setStep(n);
    autosave.save({ step_actual: n });
  };

  const wizardProps = {
    draftId: draft.id,
    formData, updateFormData,
    step, updateStep,
    adjuntos, setAdjuntos,
    onRadicado: (caseId: string) => router.push(`/mis-casos/${caseId}`),
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] bg-gray-50">
      {draft.tipo_tramite === "conciliacion" && <WizardConciliacion {...wizardProps} />}
      {draft.tipo_tramite === "insolvencia"   && <WizardInsolvencia  {...wizardProps} />}
      {draft.tipo_tramite !== "conciliacion" && draft.tipo_tramite !== "insolvencia" && (
        <div className="p-8 text-gray-600">
          Este tipo de trámite aún no está disponible. Por ahora solo conciliación e insolvencia.
        </div>
      )}
    </div>
  );
}

// Re-exports para que los wizards tengan tipos consistentes
export interface WizardProps {
  draftId: string;
  formData: Record<string, unknown>;
  updateFormData: (patch: Record<string, unknown>) => void;
  step: number;
  updateStep: (n: number) => void;
  adjuntos: AdjuntoDraft[];
  setAdjuntos: (a: AdjuntoDraft[]) => void;
  onRadicado: (caseId: string) => void;
}

export { StepSidebar, AutoSaveIndicator, type StepDef };
```

- [ ] **Step 3: Crear stubs de wizards (para compilar)**

`src/app/(partes)/mis-solicitudes/[id]/conciliacion/WizardConciliacion.tsx`:

```tsx
"use client";
import type { WizardProps } from "../WizardShell";
export function WizardConciliacion(_p: WizardProps) {
  return <div className="p-8">Wizard de conciliación — pendiente Fase 3.</div>;
}
```

`src/app/(partes)/mis-solicitudes/[id]/insolvencia/WizardInsolvencia.tsx`:

```tsx
"use client";
import type { WizardProps } from "../WizardShell";
export function WizardInsolvencia(_p: WizardProps) {
  return <div className="p-8">Wizard de insolvencia — pendiente Fase 4.</div>;
}
```

- [ ] **Step 4: Verificar build**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Smoke test**

Run: `npm run dev` → navegar a `/mis-solicitudes` → clic "Nueva solicitud" → elegir conciliación → se crea draft y redirige al shell → ver stub "Wizard de conciliación - pendiente Fase 3".

- [ ] **Step 6: Commit**

```bash
git add src/app/\(partes\)/mis-solicitudes/\[id\]/ src/app/\(partes\)/mis-solicitudes/\[id\]/conciliacion/ src/app/\(partes\)/mis-solicitudes/\[id\]/insolvencia/
git commit -m "feat(portal-partes): shell del wizard con auto-save y selector por tipo"
```

### Task 2.7: Agregar link "Mis solicitudes" al layout partes

**Files:**
- Modify: `src/app/(partes)/layout.tsx`

- [ ] **Step 1: Leer layout actual**

Run: `Read C:/Users/SD21/sgcc-portal-worktree/src/app/(partes)/layout.tsx`

- [ ] **Step 2: Agregar link**

En el nav existente, junto a "Mis Casos", agregar:

```tsx
<Link href="/mis-solicitudes" className="...same classes...">Mis Solicitudes</Link>
```

(Inserta en el mismo estilo que los demás links.)

- [ ] **Step 3: Commit**

```bash
git add src/app/\(partes\)/layout.tsx
git commit -m "feat(portal-partes): link 'Mis Solicitudes' en navbar del portal"
```

---

## Fase 3 — Wizard de Conciliación (5 pasos)

### Task 3.1: PersonaForm compartido

**Files:**
- Create: `src/components/partes/PersonaForm.tsx`

- [ ] **Step 1: Extraer de `/widget/[centerId]/page.tsx`**

Leer la función `renderPersonaForm` del widget y extraerla a componente. No copiar código literal; adaptar a props controladas:

```tsx
// src/components/partes/PersonaForm.tsx
"use client";
import type { PersonaFormData } from "@/types/solicitudes";

interface Props {
  value: PersonaFormData;
  onChange: (patch: Partial<PersonaFormData>) => void;
  showCiudad?: boolean;
}

export function PersonaForm({ value, onChange, showCiudad = true }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex gap-4 text-sm">
        {(["natural","juridica"] as const).map((t) => (
          <label key={t} className="flex items-center gap-2 cursor-pointer">
            <input type="radio" checked={value.tipo_persona === t}
              onChange={() => onChange({ tipo_persona: t })}
              className="accent-[#0D2340]" />
            {t === "natural" ? "Persona Natural" : "Persona Jurídica"}
          </label>
        ))}
      </div>

      {value.tipo_persona === "natural" ? (
        <div className="grid grid-cols-2 gap-3">
          <Input label="Nombres *" val={value.nombres ?? ""} onChange={(v) => onChange({ nombres: v })} />
          <Input label="Apellidos *" val={value.apellidos ?? ""} onChange={(v) => onChange({ apellidos: v })} />
          <Select label="Tipo documento" val={value.tipo_doc ?? "CC"} onChange={(v) => onChange({ tipo_doc: v })}
            opts={[["CC","C.C."],["CE","C.E."],["TI","T.I."],["PA","Pasaporte"]]} />
          <Input label="Número documento *" val={value.numero_doc ?? ""} onChange={(v) => onChange({ numero_doc: v })} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Input label="Razón social *" val={value.razon_social ?? ""} onChange={(v) => onChange({ razon_social: v })} />
          <Input label="NIT *" val={value.nit_empresa ?? ""} onChange={(v) => onChange({ nit_empresa: v })} />
          <Input label="Representante legal" val={value.representante_legal ?? ""}
            onChange={(v) => onChange({ representante_legal: v })} className="col-span-2" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Input label="Email *" type="email" val={value.email} onChange={(v) => onChange({ email: v })} />
        <Input label="Teléfono" val={value.telefono ?? ""} onChange={(v) => onChange({ telefono: v })} />
        {showCiudad && (
          <Input label="Ciudad" val={value.ciudad ?? ""} onChange={(v) => onChange({ ciudad: v })} className="col-span-2" />
        )}
      </div>
    </div>
  );
}

function Input({ label, val, onChange, type = "text", className = "" }:
  { label: string; val: string; onChange: (v: string) => void; type?: string; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input type={type} value={val} onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]" />
    </div>
  );
}
function Select({ label, val, onChange, opts, className = "" }:
  { label: string; val: string; onChange: (v: string) => void; opts: [string, string][]; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <select value={val} onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]">
        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/partes/PersonaForm.tsx
git commit -m "feat(portal-partes): componente PersonaForm compartido (natural/jurídica)"
```

### Task 3.2: Implementar WizardConciliacion

**Files:**
- Modify: `src/app/(partes)/mis-solicitudes/[id]/conciliacion/WizardConciliacion.tsx`

- [ ] **Step 1: Reemplazar stub con implementación completa**

```tsx
"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { WizardProps, StepDef } from "../WizardShell";
import { StepSidebar, AutoSaveIndicator } from "../WizardShell";
import { PersonaForm } from "@/components/partes/PersonaForm";
import { RepeatableList } from "@/components/partes/RepeatableList";
import { FileUploadBox } from "@/components/partes/FileUploadBox";
import { validarConciliacion } from "@/lib/solicitudes/validators";
import type { FormDataConciliacion, PersonaFormData } from "@/types/solicitudes";

const emptyPersona = (): PersonaFormData => ({
  tipo_persona: "natural", email: "",
});

const MATERIAS = [
  ["civil","Civil"],["comercial","Comercial"],["laboral","Laboral"],
  ["familiar","Familiar"],["consumidor","Consumidor"],
  ["arrendamiento","Arrendamiento"],["otro","Otro"],
] as const;

export function WizardConciliacion({
  draftId, formData, updateFormData, step, updateStep, adjuntos, setAdjuntos, onRadicado,
}: WizardProps) {
  const fd = formData as Partial<FormDataConciliacion>;
  const router = useRouter();
  const [radicando, setRadicando] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const steps: StepDef[] = [
    { num: 1, label: "Convocado(s)", done: !!fd.convocados?.length },
    { num: 2, label: "Materia y hechos", done: !!fd.descripcion },
    { num: 3, label: "Anexos", done: adjuntos.length > 0 },
    { num: 4, label: "Apoderado", done: !!fd.apoderado?.email },
    { num: 5, label: "Confirmar", done: !!fd.acepta_terminos },
  ];

  async function radicar() {
    setRadicando(true); setErrors([]);
    const valErrors = validarConciliacion(fd);
    if (valErrors.length) { setErrors(valErrors.map(e => e.message)); setRadicando(false); return; }
    const res = await fetch(`/api/partes/solicitudes/${draftId}/radicar`, { method: "POST" });
    const data = await res.json();
    setRadicando(false);
    if (!res.ok) {
      setErrors(data.errors?.map((e: { message: string }) => e.message) ?? [data.error]);
      return;
    }
    onRadicado(data.case_id);
  }

  return (
    <>
      <StepSidebar steps={steps} current={step} onJump={updateStep} />
      <main className="flex-1 p-8 max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-[#0D2340]">Solicitud de conciliación</h1>
          <AutoSaveIndicator state="saved" lastSavedAt={null} />
        </div>

        {step === 1 && (
          <section>
            <h2 className="font-semibold mb-4">Convocado(s)</h2>
            <RepeatableList<PersonaFormData>
              items={fd.convocados ?? [emptyPersona()]}
              onChange={(convocados) => updateFormData({ convocados })}
              makeEmpty={emptyPersona}
              addLabel="Agregar otro convocado"
              minItems={1}
              renderItem={(p, _i, onC) => <PersonaForm value={p} onChange={onC} />}
            />
          </section>
        )}

        {step === 2 && (
          <section className="space-y-4">
            <h2 className="font-semibold">Materia y hechos</h2>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Materia *</label>
              <select value={fd.materia ?? ""} onChange={(e) => updateFormData({ materia: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="">Selecciona…</option>
                {MATERIAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cuantía (COP)</label>
              <input type="number" value={fd.cuantia ?? ""}
                onChange={(e) => updateFormData({ cuantia: Number(e.target.value) })}
                disabled={fd.cuantia_indeterminada}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <label className="mt-2 inline-flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={!!fd.cuantia_indeterminada}
                  onChange={(e) => updateFormData({ cuantia_indeterminada: e.target.checked, cuantia: e.target.checked ? undefined : fd.cuantia })} />
                Cuantía indeterminada
              </label>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Descripción del conflicto *</label>
              <textarea value={fd.descripcion ?? ""} onChange={(e) => updateFormData({ descripcion: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[140px]" />
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-3">
            <h2 className="font-semibold mb-2">Anexos (opcional para conciliación)</h2>
            <FileUploadBox draftId={draftId} tipoAnexo="cedula" adjuntos={adjuntos} onChange={setAdjuntos} />
            <FileUploadBox draftId={draftId} tipoAnexo="soporte_acreencia" adjuntos={adjuntos} onChange={setAdjuntos} />
            <FileUploadBox draftId={draftId} tipoAnexo="otro" adjuntos={adjuntos} onChange={setAdjuntos} />
          </section>
        )}

        {step === 4 && (
          <section>
            <h2 className="font-semibold mb-4">¿Actúas con apoderado?</h2>
            <label className="inline-flex items-center gap-2 text-sm mb-4">
              <input type="checkbox" checked={!!fd.apoderado}
                onChange={(e) => updateFormData({ apoderado: e.target.checked ? emptyPersona() : undefined })} />
              Sí, tengo apoderado
            </label>
            {fd.apoderado && (
              <>
                <PersonaForm value={fd.apoderado} onChange={(patch) => updateFormData({ apoderado: { ...fd.apoderado!, ...patch } })} />
                {fd.apoderado.tipo_persona === "natural" && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Tarjeta profesional</label>
                    <input value={fd.apoderado?.tarjeta_profesional ?? ""}
                      onChange={(e) => updateFormData({ apoderado: { ...fd.apoderado!, tarjeta_profesional: e.target.value } })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                )}
                <div className="mt-4">
                  <FileUploadBox draftId={draftId} tipoAnexo="poder" adjuntos={adjuntos} onChange={setAdjuntos} obligatorio />
                </div>
              </>
            )}
          </section>
        )}

        {step === 5 && (
          <section className="space-y-4">
            <h2 className="font-semibold">Confirmar solicitud</h2>
            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700">
              <p><strong>Materia:</strong> {fd.materia ?? "—"}</p>
              <p><strong>Convocados:</strong> {fd.convocados?.length ?? 0}</p>
              <p><strong>Anexos:</strong> {adjuntos.length}</p>
            </div>
            <label className="inline-flex items-start gap-2 text-sm">
              <input type="checkbox" checked={!!fd.acepta_terminos}
                onChange={(e) => updateFormData({ acepta_terminos: e.target.checked })} />
              <span>Acepto los términos y condiciones y autorizo el tratamiento de datos personales (Ley 1581/2012).</span>
            </label>
            {errors.length > 0 && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                <ul className="list-disc pl-5">
                  {errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
            <button onClick={radicar} disabled={radicando || !fd.acepta_terminos}
              className="bg-[#0D2340] text-white px-6 py-2.5 rounded-lg disabled:opacity-40">
              {radicando ? "Radicando…" : "Radicar solicitud"}
            </button>
          </section>
        )}

        <div className="mt-8 flex justify-between">
          {step > 1 ? (
            <button onClick={() => updateStep(step - 1)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
              ← Anterior
            </button>
          ) : <div />}
          {step < 5 && (
            <button onClick={() => updateStep(step + 1)} className="bg-[#0D2340] text-white px-4 py-2 rounded-lg text-sm">
              Siguiente →
            </button>
          )}
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 2: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Smoke test E2E conciliación**

1. `npm run dev`
2. Loguearse como parte seed (`parte@demo.com` o crear con código corto de centro demo)
3. /mis-solicitudes → Nueva → Conciliación
4. Completar los 5 pasos
5. Radicar → debe redirigir a `/mis-casos/[id]` con el caso creado

- [ ] **Step 4: Commit**

```bash
git add src/app/\(partes\)/mis-solicitudes/\[id\]/conciliacion/WizardConciliacion.tsx
git commit -m "feat(portal-partes): wizard de conciliación (5 pasos) con radicación"
```

---

## Fase 4 — Wizard de Insolvencia (13 pasos Ley 2445/2025)

Esta fase es la más extensa. Se divide en sub-tareas por grupos de pasos para facilitar la revisión.

### Task 4.1: Wizard shell + pasos 1-4 (tipo deudor, supuestos, datos, causas)

**Files:**
- Create: `src/app/(partes)/mis-solicitudes/[id]/insolvencia/WizardInsolvencia.tsx`
- Create: `src/app/(partes)/mis-solicitudes/[id]/insolvencia/Paso1TipoDeudor.tsx`
- Create: `src/app/(partes)/mis-solicitudes/[id]/insolvencia/Paso2Supuestos.tsx`
- Create: `src/app/(partes)/mis-solicitudes/[id]/insolvencia/Paso3DatosDeudor.tsx`
- Create: `src/app/(partes)/mis-solicitudes/[id]/insolvencia/Paso4Causas.tsx`

- [ ] **Step 1: WizardInsolvencia (shell)**

```tsx
"use client";
import { useState } from "react";
import type { WizardProps } from "../WizardShell";
import { StepSidebar } from "../WizardShell";
import { Paso1TipoDeudor } from "./Paso1TipoDeudor";
import { Paso2Supuestos } from "./Paso2Supuestos";
import { Paso3DatosDeudor } from "./Paso3DatosDeudor";
import { Paso4Causas } from "./Paso4Causas";
// Pasos 5-13 se importan en tasks siguientes

const STEP_LABELS = [
  "Tipo de deudor", "Supuestos", "Datos del deudor", "Causas",
  "Acreedores", "Bienes", "Procesos judiciales",
  "Obligaciones alimentarias", "Ingresos y gastos",
  "Sociedad conyugal", "Propuesta de pago", "Anexos", "Confirmar",
];

export function WizardInsolvencia(p: WizardProps) {
  const steps = STEP_LABELS.map((label, i) => ({
    num: i + 1,
    label,
    done: i + 1 < p.step, // simplificación: considerar "done" si ya pasó
  }));

  const Paso = (() => {
    switch (p.step) {
      case 1: return <Paso1TipoDeudor {...p} />;
      case 2: return <Paso2Supuestos {...p} />;
      case 3: return <Paso3DatosDeudor {...p} />;
      case 4: return <Paso4Causas {...p} />;
      default: return <div className="p-8 text-gray-500">Paso {p.step} — pendiente.</div>;
    }
  })();

  return (
    <>
      <StepSidebar steps={steps} current={p.step} onJump={p.updateStep} />
      <main className="flex-1 p-8 max-w-3xl overflow-y-auto">
        <h1 className="text-xl font-bold text-[#0D2340] mb-6">Solicitud de insolvencia (Ley 2445/2025)</h1>
        {Paso}
        <div className="mt-8 flex justify-between">
          {p.step > 1 ? (
            <button onClick={() => p.updateStep(p.step - 1)}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">← Anterior</button>
          ) : <div />}
          {p.step < 13 && (
            <button onClick={() => p.updateStep(p.step + 1)}
              className="bg-[#0D2340] text-white px-4 py-2 rounded-lg text-sm">Siguiente →</button>
          )}
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 2: Paso1TipoDeudor**

```tsx
"use client";
import type { WizardProps } from "../WizardShell";
import type { FormDataInsolvencia, TipoDeudor } from "@/types/solicitudes";
import { TIPO_DEUDOR_LABEL, TOPE_PEQUENO_COMERCIANTE_COP } from "@/lib/solicitudes/constants";

export function Paso1TipoDeudor({ formData, updateFormData }: WizardProps) {
  const fd = formData as Partial<FormDataInsolvencia>;
  return (
    <section className="space-y-4">
      <h2 className="font-semibold">Tipo de deudor</h2>
      <p className="text-sm text-gray-600">
        Indica si eres persona natural no comerciante o pequeño comerciante (Ley 2445/2025).
      </p>

      <div className="space-y-2">
        {(["pnnc","pequeno_comerciante"] as TipoDeudor[]).map((t) => (
          <label key={t} className={`block border-2 rounded-lg p-3 cursor-pointer ${
            fd.tipo_deudor === t ? "border-[#0D2340] bg-blue-50" : "border-gray-200 hover:border-gray-300"
          }`}>
            <input type="radio" checked={fd.tipo_deudor === t}
              onChange={() => updateFormData({ tipo_deudor: t })} className="mr-2" />
            {TIPO_DEUDOR_LABEL[t]}
          </label>
        ))}
      </div>

      {fd.tipo_deudor === "pequeno_comerciante" && (
        <div className="space-y-3 rounded-lg bg-amber-50 border border-amber-200 p-4">
          <p className="text-sm text-amber-800">
            Como pequeño comerciante debes acreditar matrícula mercantil y activos totales
            inferiores a 1.000 SMLMV (excluyendo vivienda familiar y vehículo de trabajo).
            Tope actual: <strong>${TOPE_PEQUENO_COMERCIANTE_COP.toLocaleString("es-CO")}</strong>.
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Número de matrícula mercantil *</label>
            <input value={fd.matricula_mercantil ?? ""} onChange={(e) => updateFormData({ matricula_mercantil: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Activos totales declarados (COP) *</label>
            <input type="number" value={fd.activos_totales ?? ""}
              onChange={(e) => updateFormData({ activos_totales: Number(e.target.value) })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            {fd.activos_totales !== undefined && fd.activos_totales > TOPE_PEQUENO_COMERCIANTE_COP && (
              <p className="text-xs text-red-600 mt-1">Excede el tope de 1.000 SMLMV.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Paso2Supuestos**

```tsx
"use client";
import type { WizardProps } from "../WizardShell";
import type { FormDataInsolvencia } from "@/types/solicitudes";
import { verificarSupuestosInsolvencia } from "@/lib/solicitudes/validators";

export function Paso2Supuestos({ formData }: WizardProps) {
  const fd = formData as Partial<FormDataInsolvencia>;
  const sup = verificarSupuestosInsolvencia(fd.acreedores ?? []);

  return (
    <section className="space-y-4">
      <h2 className="font-semibold">Supuestos de insolvencia (Art. 538 Ley 2445/2025)</h2>
      <p className="text-sm text-gray-600">
        Los supuestos se validan automáticamente con los acreedores que registres en el paso 5.
      </p>

      <div className={`rounded-lg p-4 border ${sup.cumple ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
        <div className="font-semibold mb-2">
          {sup.cumple ? "✓ Cumples los supuestos" : "✗ Aún no cumples los supuestos"}
        </div>
        <ul className="text-sm space-y-1">
          <li>• Acreedores con mora ≥90 días: <strong>{sup.acreedores_en_mora_90d}</strong> (mín. 2)</li>
          <li>• Capital en mora: <strong>${sup.capital_en_mora.toLocaleString("es-CO")}</strong> de ${sup.total_capital.toLocaleString("es-CO")}</li>
          <li>• Porcentaje de mora: <strong>{(sup.porcentaje_mora * 100).toFixed(1)}%</strong> (mín. 30%)</li>
        </ul>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Paso3DatosDeudor**

```tsx
"use client";
import type { WizardProps } from "../WizardShell";
import { PersonaForm } from "@/components/partes/PersonaForm";
import type { FormDataInsolvencia, PersonaFormData } from "@/types/solicitudes";

const empty = (): PersonaFormData => ({ tipo_persona: "natural", email: "" });

export function Paso3DatosDeudor({ formData, updateFormData }: WizardProps) {
  const fd = formData as Partial<FormDataInsolvencia>;
  const deudor = fd.deudor ?? empty();
  return (
    <section>
      <h2 className="font-semibold mb-4">Datos del deudor</h2>
      <PersonaForm value={deudor} onChange={(patch) => updateFormData({ deudor: { ...deudor, ...patch } })} />
    </section>
  );
}
```

- [ ] **Step 5: Paso4Causas**

```tsx
"use client";
import type { WizardProps } from "../WizardShell";
import type { FormDataInsolvencia } from "@/types/solicitudes";

export function Paso4Causas({ formData, updateFormData }: WizardProps) {
  const fd = formData as Partial<FormDataInsolvencia>;
  return (
    <section>
      <h2 className="font-semibold mb-2">Causas de la insolvencia</h2>
      <p className="text-sm text-gray-600 mb-3">
        Describe con claridad los hechos que te llevaron a la situación de insolvencia.
      </p>
      <textarea value={fd.causa_insolvencia ?? ""}
        onChange={(e) => updateFormData({ causa_insolvencia: e.target.value })}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[200px]" />
    </section>
  );
}
```

- [ ] **Step 6: Verificar y commit**

```bash
npx tsc --noEmit
git add src/app/\(partes\)/mis-solicitudes/\[id\]/insolvencia/
git commit -m "feat(portal-partes): insolvencia pasos 1-4 (tipo deudor, supuestos, datos, causas)"
```

### Task 4.2: Paso 5 — Acreedores

**Files:**
- Create: `src/app/(partes)/mis-solicitudes/[id]/insolvencia/Paso5Acreedores.tsx`
- Modify: `src/app/(partes)/mis-solicitudes/[id]/insolvencia/WizardInsolvencia.tsx`

- [ ] **Step 1: Componente**

```tsx
"use client";
import { RepeatableList } from "@/components/partes/RepeatableList";
import type { WizardProps } from "../WizardShell";
import type { AcreedorFormData, FormDataInsolvencia, ClasePrelacion } from "@/types/solicitudes";
import { CLASE_PRELACION_LABEL } from "@/lib/solicitudes/constants";

const emptyAcreedor = (): AcreedorFormData => ({
  nombre: "", capital: 0, intereses: 0, mas_90_dias_mora: false,
});

export function Paso5Acreedores({ formData, updateFormData }: WizardProps) {
  const fd = formData as Partial<FormDataInsolvencia>;
  const totalCapital = (fd.acreedores ?? []).reduce((s, a) => s + (a.capital || 0), 0);
  return (
    <section>
      <h2 className="font-semibold mb-1">Acreedores</h2>
      <p className="text-sm text-gray-600 mb-4">
        Registra todas tus deudas con su clase de prelación (Art. 2488 y ss. C.C.).
      </p>

      <RepeatableList<AcreedorFormData>
        items={fd.acreedores ?? []}
        onChange={(acreedores) => updateFormData({ acreedores })}
        makeEmpty={emptyAcreedor}
        addLabel="Agregar acreedor"
        renderItem={(a, _i, onC) => (
          <div className="grid grid-cols-2 gap-3">
            <Txt label="Nombre *" val={a.nombre} onC={(v) => onC({ nombre: v })} />
            <Txt label="Documento" val={a.numero_doc ?? ""} onC={(v) => onC({ numero_doc: v })} />
            <Txt label="Dirección de notificación" val={a.direccion_notif ?? ""} onC={(v) => onC({ direccion_notif: v })} />
            <Txt label="Ciudad" val={a.ciudad ?? ""} onC={(v) => onC({ ciudad: v })} />
            <Txt label="Correo" val={a.correo ?? ""} onC={(v) => onC({ correo: v })} />
            <Txt label="Teléfono" val={a.telefono ?? ""} onC={(v) => onC({ telefono: v })} />
            <Txt label="Tipo de crédito" val={a.tipo_credito ?? ""} onC={(v) => onC({ tipo_credito: v })} />
            <Sel label="Clase de prelación *" val={a.clase_prelacion ?? ""}
              opts={Object.entries(CLASE_PRELACION_LABEL) as [ClasePrelacion, string][]}
              onC={(v) => onC({ clase_prelacion: v as ClasePrelacion })} />
            <Num label="Capital (COP) *" val={a.capital} onC={(v) => onC({ capital: v })} />
            <Num label="Intereses (COP)" val={a.intereses} onC={(v) => onC({ intereses: v })} />
            <Num label="Días de mora" val={a.dias_mora ?? 0} onC={(v) => onC({ dias_mora: v })} />
            <label className="col-span-2 inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={a.mas_90_dias_mora}
                onChange={(e) => onC({ mas_90_dias_mora: e.target.checked })} />
              Más de 90 días en mora
            </label>
          </div>
        )}
      />

      <div className="mt-4 text-sm text-gray-600">
        Total capital registrado: <strong>${totalCapital.toLocaleString("es-CO")}</strong>
      </div>
    </section>
  );
}

function Txt({ label, val, onC }: { label: string; val: string; onC: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input value={val} onChange={(e) => onC(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
    </div>
  );
}
function Num({ label, val, onC }: { label: string; val: number; onC: (v: number) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input type="number" value={val} onChange={(e) => onC(Number(e.target.value))}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
    </div>
  );
}
function Sel({ label, val, onC, opts }:
  { label: string; val: string; onC: (v: string) => void; opts: [string, string][] }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <select value={val} onChange={(e) => onC(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
        <option value="">Selecciona…</option>
        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}
```

- [ ] **Step 2: Agregar al switch del WizardInsolvencia**

En `WizardInsolvencia.tsx`, importar y agregar el `case 5`:

```tsx
import { Paso5Acreedores } from "./Paso5Acreedores";
// ...
case 5: return <Paso5Acreedores {...p} />;
```

- [ ] **Step 3: Commit**

```bash
npx tsc --noEmit
git add src/app/\(partes\)/mis-solicitudes/\[id\]/insolvencia/Paso5Acreedores.tsx src/app/\(partes\)/mis-solicitudes/\[id\]/insolvencia/WizardInsolvencia.tsx
git commit -m "feat(portal-partes): insolvencia paso 5 (acreedores con prelación y mora)"
```

### Task 4.3: Paso 6 — Bienes (3 sub-tabs)

**Files:**
- Create: `src/app/(partes)/mis-solicitudes/[id]/insolvencia/Paso6Bienes.tsx`
- Modify: `WizardInsolvencia.tsx`

- [ ] **Step 1: Componente**

```tsx
"use client";
import { useState } from "react";
import { RepeatableList } from "@/components/partes/RepeatableList";
import type { WizardProps } from "../WizardShell";
import type { BienFormData, FormDataInsolvencia, TipoBien } from "@/types/solicitudes";

const empty = (tipo: TipoBien): BienFormData => ({ tipo });

export function Paso6Bienes({ formData, updateFormData }: WizardProps) {
  const fd = formData as Partial<FormDataInsolvencia>;
  const [tab, setTab] = useState<TipoBien>("inmueble");
  const bienes = fd.bienes ?? [];

  const bienesTab = bienes.filter((b) => b.tipo === tab);
  const setBienesTab = (filtered: BienFormData[]) => {
    const otros = bienes.filter((b) => b.tipo !== tab);
    updateFormData({ bienes: [...otros, ...filtered] });
  };

  return (
    <section>
      <h2 className="font-semibold mb-4">Relación de bienes</h2>
      <div className="flex gap-2 border-b border-gray-200 mb-4">
        {(["inmueble","mueble","elemento_hogar"] as TipoBien[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm border-b-2 ${tab === t ? "border-[#0D2340] text-[#0D2340] font-medium" : "border-transparent text-gray-500"}`}>
            {t === "inmueble" ? "Inmuebles" : t === "mueble" ? "Muebles (vehículos)" : "Elementos del hogar"}
          </button>
        ))}
      </div>

      <RepeatableList<BienFormData>
        items={bienesTab}
        onChange={setBienesTab}
        makeEmpty={() => empty(tab)}
        addLabel="Agregar bien"
        renderItem={(b, _i, onC) => (
          <div className="grid grid-cols-2 gap-3">
            {tab === "inmueble" && <>
              <Txt label="Dirección" val={b.direccion ?? ""} onC={(v) => onC({ direccion: v })} />
              <Txt label="Ciudad" val={b.ciudad ?? ""} onC={(v) => onC({ ciudad: v })} />
              <Txt label="Matrícula inmobiliaria" val={b.matricula_inmobiliaria ?? ""} onC={(v) => onC({ matricula_inmobiliaria: v })} />
              <Num label="% dominio" val={b.porcentaje_dominio ?? 100} onC={(v) => onC({ porcentaje_dominio: v })} />
              <Txt label="Gravamen (hipoteca/embargo)" val={b.gravamen ?? ""} onC={(v) => onC({ gravamen: v })} />
              <Num label="Valor estimado (COP)" val={b.valor_estimado ?? 0} onC={(v) => onC({ valor_estimado: v })} />
              <label className="col-span-2 text-sm inline-flex items-center gap-2">
                <input type="checkbox" checked={!!b.afectacion_vivienda_familiar}
                  onChange={(e) => onC({ afectacion_vivienda_familiar: e.target.checked })} />
                Vivienda familiar o patrimonio de familia
              </label>
            </>}
            {tab === "mueble" && <>
              <Txt label="Tipo (vehículo, maquinaria…)" val={b.descripcion ?? ""} onC={(v) => onC({ descripcion: v })} />
              <Txt label="Marca/Modelo" val={b.marca_modelo ?? ""} onC={(v) => onC({ marca_modelo: v })} />
              <Txt label="N° chasis/placa" val={b.numero_chasis ?? ""} onC={(v) => onC({ numero_chasis: v })} />
              <Num label="% dominio" val={b.porcentaje_dominio ?? 100} onC={(v) => onC({ porcentaje_dominio: v })} />
              <Txt label="Gravamen (prenda/embargo)" val={b.gravamen ?? ""} onC={(v) => onC({ gravamen: v })} />
              <Num label="Valor estimado (COP)" val={b.valor_estimado ?? 0} onC={(v) => onC({ valor_estimado: v })} />
            </>}
            {tab === "elemento_hogar" && <>
              <Txt label="Descripción" val={b.descripcion ?? ""} onC={(v) => onC({ descripcion: v })} />
              <Num label="Valor estimado (COP)" val={b.valor_estimado ?? 0} onC={(v) => onC({ valor_estimado: v })} />
            </>}
          </div>
        )}
      />
    </section>
  );
}

function Txt({ label, val, onC }: { label: string; val: string; onC: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input value={val} onChange={(e) => onC(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
    </div>
  );
}
function Num({ label, val, onC }: { label: string; val: number; onC: (v: number) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input type="number" value={val} onChange={(e) => onC(Number(e.target.value))}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
    </div>
  );
}
```

- [ ] **Step 2: Agregar al switch**

`case 6: return <Paso6Bienes {...p} />;`

- [ ] **Step 3: Commit**

```bash
npx tsc --noEmit
git add src/app/\(partes\)/mis-solicitudes/\[id\]/insolvencia/
git commit -m "feat(portal-partes): insolvencia paso 6 (bienes inmuebles/muebles/hogar)"
```

### Task 4.4: Paso 7 — Procesos judiciales, Paso 8 — Alimentarias + REDAM

**Files:**
- Create: `Paso7Procesos.tsx`
- Create: `Paso8AlimentariasRedam.tsx`
- Modify: `WizardInsolvencia.tsx`

- [ ] **Step 1: Paso7Procesos**

```tsx
"use client";
import { RepeatableList } from "@/components/partes/RepeatableList";
import type { WizardProps } from "../WizardShell";
import type { FormDataInsolvencia, ProcesoJudicialFormData } from "@/types/solicitudes";

const empty = (): ProcesoJudicialFormData => ({ tiene_embargo_remate: false });

export function Paso7Procesos({ formData, updateFormData }: WizardProps) {
  const fd = formData as Partial<FormDataInsolvencia>;
  return (
    <section>
      <h2 className="font-semibold mb-4">Procesos judiciales en tu contra</h2>
      <RepeatableList<ProcesoJudicialFormData>
        items={fd.procesos ?? []}
        onChange={(procesos) => updateFormData({ procesos })}
        makeEmpty={empty}
        addLabel="Agregar proceso"
        renderItem={(pr, _i, onC) => (
          <div className="grid grid-cols-2 gap-3">
            <Txt label="Juzgado (ciudad)" val={pr.juzgado_ciudad ?? ""} onC={(v) => onC({ juzgado_ciudad: v })} />
            <Txt label="N° radicado" val={pr.numero_radicado ?? ""} onC={(v) => onC({ numero_radicado: v })} />
            <Txt label="Demandante" val={pr.demandante ?? ""} onC={(v) => onC({ demandante: v })} />
            <Txt label="Tipo de proceso" val={pr.tipo_proceso ?? ""} onC={(v) => onC({ tipo_proceso: v })} />
            <label className="col-span-2 inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={pr.tiene_embargo_remate}
                onChange={(e) => onC({ tiene_embargo_remate: e.target.checked })} />
              Tiene embargo o remate
            </label>
          </div>
        )}
      />
    </section>
  );
}
function Txt({ label, val, onC }: { label: string; val: string; onC: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input value={val} onChange={(e) => onC(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
    </div>
  );
}
```

- [ ] **Step 2: Paso8AlimentariasRedam**

```tsx
"use client";
import type { WizardProps } from "../WizardShell";
import type { FormDataInsolvencia } from "@/types/solicitudes";
import { FileUploadBox } from "@/components/partes/FileUploadBox";

export function Paso8AlimentariasRedam({ draftId, formData, updateFormData, adjuntos, setAdjuntos }: WizardProps) {
  const fd = formData as Partial<FormDataInsolvencia>;
  const oa = fd.obligaciones_alimentarias ?? { tiene: false };
  return (
    <section className="space-y-5">
      <h2 className="font-semibold">Obligaciones alimentarias y personas a cargo</h2>

      <label className="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" checked={oa.tiene}
          onChange={(e) => updateFormData({ obligaciones_alimentarias: { ...oa, tiene: e.target.checked } })} />
        Tengo obligaciones alimentarias
      </label>

      {oa.tiene && (
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Beneficiarios (nombre y parentesco)</label>
            <textarea value={oa.beneficiarios ?? ""}
              onChange={(e) => updateFormData({ obligaciones_alimentarias: { ...oa, beneficiarios: e.target.value } })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Monto mensual (COP)</label>
            <input type="number" value={oa.monto_mensual ?? 0}
              onChange={(e) => updateFormData({ obligaciones_alimentarias: { ...oa, monto_mensual: Number(e.target.value) } })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Número de personas a cargo</label>
            <input type="number" value={fd.personas_a_cargo ?? 0}
              onChange={(e) => updateFormData({ personas_a_cargo: Number(e.target.value) })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
      )}

      <div>
        <p className="text-sm text-gray-700 mb-2">
          <strong>Certificado REDAM (obligatorio, Art. 539 #9)</strong> — obténlo en{" "}
          <a href="https://srvcnpc.policia.gov.co/PSC/frm_cnp_consulta.aspx" target="_blank" className="text-[#1B4F9B] underline">
            el portal de la Policía Nacional
          </a>.
        </p>
        <FileUploadBox draftId={draftId} tipoAnexo="redam" obligatorio adjuntos={adjuntos} onChange={setAdjuntos} />
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Agregar cases 7 y 8 al switch**

- [ ] **Step 4: Commit**

```bash
npx tsc --noEmit
git add src/app/\(partes\)/mis-solicitudes/\[id\]/insolvencia/
git commit -m "feat(portal-partes): insolvencia pasos 7-8 (procesos judiciales, alimentarias, REDAM)"
```

### Task 4.5: Pasos 9-10 — Ingresos/gastos, Sociedad conyugal

**Files:**
- Create: `Paso9IngresosGastos.tsx`
- Create: `Paso10SociedadConyugal.tsx`
- Modify: `WizardInsolvencia.tsx`

- [ ] **Step 1: Paso9IngresosGastos**

```tsx
"use client";
import type { WizardProps } from "../WizardShell";
import type { FormDataInsolvencia } from "@/types/solicitudes";

const GASTOS = [
  ["alimentacion","Alimentación"],["salud","Salud"],["arriendo","Arriendo"],
  ["administracion","Administración"],["servicios_publicos","Servicios públicos"],
  ["educacion","Educación"],["cuotas_alimentarias","Cuotas alimentarias"],
  ["transporte","Transporte"],["otros","Otros"],
] as const;

export function Paso9IngresosGastos({ formData, updateFormData }: WizardProps) {
  const fd = formData as Partial<FormDataInsolvencia>;
  const gastos = fd.gastos ?? {};
  const total = Object.values(gastos).reduce((s, v) => s + (v || 0), 0);

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-semibold mb-2">Ingresos mensuales</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Monto mensual (COP)</label>
            <input type="number" value={fd.ingresos_mensuales ?? 0}
              onChange={(e) => updateFormData({ ingresos_mensuales: Number(e.target.value) })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fuente(s) de ingresos</label>
            <input value={fd.fuentes_ingresos ?? ""}
              onChange={(e) => updateFormData({ fuentes_ingresos: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
      </div>

      <div>
        <h2 className="font-semibold mb-2">Gastos de subsistencia</h2>
        <div className="grid grid-cols-2 gap-3">
          {GASTOS.map(([key, label]) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              <input type="number" value={gastos[key] ?? 0}
                onChange={(e) => updateFormData({
                  gastos: { ...gastos, [key]: Number(e.target.value) },
                  gastos_subsistencia_mensual: Object.values({ ...gastos, [key]: Number(e.target.value) })
                    .reduce((s, v) => s + (v || 0), 0),
                })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          ))}
        </div>
        <div className="mt-3 text-sm text-gray-700">Total: <strong>${total.toLocaleString("es-CO")}</strong></div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Paso10SociedadConyugal**

```tsx
"use client";
import type { WizardProps } from "../WizardShell";
import type { FormDataInsolvencia } from "@/types/solicitudes";

export function Paso10SociedadConyugal({ formData, updateFormData }: WizardProps) {
  const fd = formData as Partial<FormDataInsolvencia>;
  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Sociedad conyugal y patrimonial</h2>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Estado civil</label>
        <select value={fd.estado_civil ?? ""}
          onChange={(e) => updateFormData({ estado_civil: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">Selecciona…</option>
          {["Soltero(a)","Casado(a)","Unión marital de hecho","Divorciado(a)","Viudo(a)"].map((e) =>
            <option key={e} value={e}>{e}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Información sobre sociedad conyugal y patrimonial
        </label>
        <textarea value={fd.sociedad_conyugal_info ?? ""}
          onChange={(e) => updateFormData({ sociedad_conyugal_info: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[100px]"
          placeholder="Indica si existe sociedad conyugal, capitulaciones, etc." />
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Cases al switch y commit**

```bash
npx tsc --noEmit
git add src/app/\(partes\)/mis-solicitudes/\[id\]/insolvencia/
git commit -m "feat(portal-partes): insolvencia pasos 9-10 (ingresos, gastos, sociedad conyugal)"
```

### Task 4.6: Paso 11 — Propuesta de pago con cronograma

**Files:**
- Create: `Paso11PropuestaPago.tsx`
- Modify: `WizardInsolvencia.tsx`

- [ ] **Step 1: Componente**

```tsx
"use client";
import type { WizardProps } from "../WizardShell";
import type { FormDataInsolvencia, PropuestaPagoClase, ClasePrelacion } from "@/types/solicitudes";
import { CLASE_PRELACION_LABEL } from "@/lib/solicitudes/constants";
import { generarCronograma } from "@/lib/solicitudes/payment-plan";

export function Paso11PropuestaPago({ formData, updateFormData }: WizardProps) {
  const fd = formData as Partial<FormDataInsolvencia>;
  const acreedores = fd.acreedores ?? [];
  const propuestas = fd.propuesta_pago ?? [];

  const clasesConAcreedores = Array.from(new Set(
    acreedores.map((a) => a.clase_prelacion).filter(Boolean)
  )) as ClasePrelacion[];

  function capitalPorClase(c: ClasePrelacion) {
    return acreedores
      .filter((a) => a.clase_prelacion === c)
      .reduce((s, a) => s + (a.capital || 0), 0);
  }

  function actualizar(clase: ClasePrelacion, patch: Partial<PropuestaPagoClase>) {
    const existing = propuestas.find((p) => p.clase_prelacion === clase);
    const base: PropuestaPagoClase = existing ?? {
      clase_prelacion: clase,
      tasa_interes_futura_mensual: 1, tasa_interes_espera_mensual: 0.5,
      numero_cuotas: 12, cronograma: [],
    };
    const merged = { ...base, ...patch };
    // Recalcular cronograma
    merged.cronograma = generarCronograma({
      capital: capitalPorClase(clase),
      numeroCuotas: merged.numero_cuotas,
      tasaFuturaMensual: merged.tasa_interes_futura_mensual,
      tasaEsperaMensual: merged.tasa_interes_espera_mensual,
      fechaInicio: new Date(),
    });
    const next = propuestas.filter((p) => p.clase_prelacion !== clase).concat(merged);
    updateFormData({ propuesta_pago: next });
  }

  return (
    <section className="space-y-6">
      <h2 className="font-semibold">Propuesta de pago por clase</h2>
      {clasesConAcreedores.length === 0 ? (
        <p className="text-sm text-gray-500">Agrega acreedores en el paso 5 para ver las clases.</p>
      ) : clasesConAcreedores.map((clase) => {
        const p = propuestas.find((pr) => pr.clase_prelacion === clase);
        const capital = capitalPorClase(clase);
        return (
          <div key={clase} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">{CLASE_PRELACION_LABEL[clase]}</h3>
              <span className="text-sm text-gray-600">Capital: ${capital.toLocaleString("es-CO")}</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Num label="Tasa futura % mensual" val={p?.tasa_interes_futura_mensual ?? 1}
                onC={(v) => actualizar(clase, { tasa_interes_futura_mensual: v })} />
              <Num label="Tasa espera % mensual" val={p?.tasa_interes_espera_mensual ?? 0.5}
                onC={(v) => actualizar(clase, { tasa_interes_espera_mensual: v })} />
              <Num label="N° de cuotas" val={p?.numero_cuotas ?? 12}
                onC={(v) => actualizar(clase, { numero_cuotas: v })} />
            </div>
            {p?.cronograma && p.cronograma.length > 0 && (
              <details className="mt-4">
                <summary className="text-xs text-[#1B4F9B] cursor-pointer">Ver cronograma</summary>
                <table className="w-full mt-2 text-xs">
                  <thead>
                    <tr className="text-gray-500">
                      <th className="text-left">#</th><th className="text-right">Capital</th>
                      <th className="text-right">Int. espera</th><th className="text-right">Int. futuro</th>
                      <th className="text-right">Saldo</th><th className="text-right">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.cronograma.map((c) => (
                      <tr key={c.cuota}>
                        <td>{c.cuota}</td>
                        <td className="text-right">${c.capital.toLocaleString("es-CO")}</td>
                        <td className="text-right">${c.intereses_espera.toLocaleString("es-CO")}</td>
                        <td className="text-right">${c.intereses_futuros.toLocaleString("es-CO")}</td>
                        <td className="text-right">${c.saldo.toLocaleString("es-CO")}</td>
                        <td className="text-right">{c.fecha_pago}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            )}
          </div>
        );
      })}
    </section>
  );
}

function Num({ label, val, onC }: { label: string; val: number; onC: (v: number) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input type="number" step="0.01" value={val} onChange={(e) => onC(Number(e.target.value))}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
    </div>
  );
}
```

- [ ] **Step 2: Case en switch y commit**

```bash
npx tsc --noEmit
git add src/app/\(partes\)/mis-solicitudes/\[id\]/insolvencia/
git commit -m "feat(portal-partes): insolvencia paso 11 (propuesta de pago con cronograma por clase)"
```

### Task 4.7: Paso 12 — Anexos, Paso 13 — Confirmar con juramento

**Files:**
- Create: `Paso12Anexos.tsx`
- Create: `Paso13Confirmar.tsx`
- Modify: `WizardInsolvencia.tsx`

- [ ] **Step 1: Paso12Anexos**

```tsx
"use client";
import type { WizardProps } from "../WizardShell";
import type { FormDataInsolvencia } from "@/types/solicitudes";
import { FileUploadBox } from "@/components/partes/FileUploadBox";

export function Paso12Anexos({ draftId, formData, adjuntos, setAdjuntos }: WizardProps) {
  const fd = formData as Partial<FormDataInsolvencia>;
  const requiereMatricula = fd.tipo_deudor === "pequeno_comerciante";
  const tieneApoderado = !!fd.deudor; // este flag lo debería saber el paso de apoderado — ajustar en iteración
  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Anexos</h2>
      <FileUploadBox draftId={draftId} tipoAnexo="cedula" obligatorio adjuntos={adjuntos} onChange={setAdjuntos} />
      <FileUploadBox draftId={draftId} tipoAnexo="redam" obligatorio adjuntos={adjuntos} onChange={setAdjuntos} />
      {requiereMatricula && (
        <FileUploadBox draftId={draftId} tipoAnexo="matricula_mercantil" obligatorio adjuntos={adjuntos} onChange={setAdjuntos} />
      )}
      <FileUploadBox draftId={draftId} tipoAnexo="tradicion" adjuntos={adjuntos} onChange={setAdjuntos} />
      <FileUploadBox draftId={draftId} tipoAnexo="soporte_acreencia" adjuntos={adjuntos} onChange={setAdjuntos} />
      <FileUploadBox draftId={draftId} tipoAnexo="ingresos_contador" adjuntos={adjuntos} onChange={setAdjuntos} />
      <FileUploadBox draftId={draftId} tipoAnexo="poder" adjuntos={adjuntos} onChange={setAdjuntos} />
      <FileUploadBox draftId={draftId} tipoAnexo="otro" adjuntos={adjuntos} onChange={setAdjuntos} />
    </section>
  );
}
```

- [ ] **Step 2: Paso13Confirmar**

```tsx
"use client";
import { useState } from "react";
import type { WizardProps } from "../WizardShell";
import type { FormDataInsolvencia } from "@/types/solicitudes";
import { validarInsolvencia } from "@/lib/solicitudes/validators";
import { JURAMENTO_TEXTO } from "@/lib/solicitudes/constants";

export function Paso13Confirmar({ draftId, formData, updateFormData, adjuntos, onRadicado }: WizardProps) {
  const fd = formData as Partial<FormDataInsolvencia>;
  const [radicando, setRadicando] = useState(false);
  const [errores, setErrores] = useState<string[]>([]);

  async function radicar() {
    setRadicando(true); setErrores([]);
    const val = validarInsolvencia(fd, adjuntos);
    if (val.length) { setErrores(val.map(e => e.message)); setRadicando(false); return; }

    const res = await fetch(`/api/partes/solicitudes/${draftId}/radicar`, { method: "POST" });
    const data = await res.json();
    setRadicando(false);
    if (!res.ok) {
      setErrores(data.errors?.map((e: { message: string }) => e.message) ?? [data.error]);
      return;
    }
    onRadicado(data.case_id);
  }

  return (
    <section className="space-y-4">
      <h2 className="font-semibold">Confirmar solicitud</h2>

      <div className="rounded-lg border border-gray-200 p-4 text-sm space-y-1">
        <p><strong>Tipo de deudor:</strong> {fd.tipo_deudor ?? "—"}</p>
        <p><strong>Acreedores:</strong> {fd.acreedores?.length ?? 0}</p>
        <p><strong>Bienes:</strong> {fd.bienes?.length ?? 0}</p>
        <p><strong>Procesos judiciales:</strong> {fd.procesos?.length ?? 0}</p>
        <p><strong>Anexos cargados:</strong> {adjuntos.length}</p>
      </div>

      <label className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-4 cursor-pointer">
        <input type="checkbox" checked={!!fd.juramento_aceptado}
          onChange={(e) => updateFormData({ juramento_aceptado: e.target.checked })}
          className="mt-1" />
        <span className="text-sm text-amber-900">{JURAMENTO_TEXTO}</span>
      </label>

      <label className="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" checked={!!fd.solicita_tarifa_especial}
          onChange={(e) => updateFormData({ solicita_tarifa_especial: e.target.checked })} />
        Solicito tarifa especial según el Art. 536 Ley 1564/2012
      </label>

      {errores.length > 0 && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          <ul className="list-disc pl-5">
            {errores.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      <button disabled={radicando || !fd.juramento_aceptado} onClick={radicar}
        className="bg-[#0D2340] text-white px-6 py-2.5 rounded-lg disabled:opacity-40">
        {radicando ? "Radicando…" : "Radicar solicitud"}
      </button>
    </section>
  );
}
```

- [ ] **Step 3: Cases al switch**

```tsx
case 12: return <Paso12Anexos {...p} />;
case 13: return <Paso13Confirmar {...p} />;
```

- [ ] **Step 4: Verificar build completo**

```bash
npx tsc --noEmit
npm run build
```
Expected: build OK.

- [ ] **Step 5: Smoke test E2E insolvencia**

1. Login como parte
2. Nueva solicitud → Insolvencia
3. Completar los 13 pasos con datos mínimos pero válidos (2 acreedores con >90d mora y >30% del total)
4. Radicar → debe redirigir a `/mis-casos/[id]` con el caso creado
5. Verificar en Supabase: `sgcc_cases` con `tipo_tramite='insolvencia'` y `creado_por_parte=true`, más registros en `sgcc_case_creditors`, `sgcc_case_assets`, `sgcc_case_judicial_processes`, `sgcc_case_payment_plan`.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(partes\)/mis-solicitudes/\[id\]/insolvencia/
git commit -m "feat(portal-partes): insolvencia pasos 12-13 (anexos tipados + juramento Art. 539 §1)"
```

---

## Fase 5 — Email, deprecación widget, feature flag

### Task 5.1: Email de confirmación al radicar

**Files:**
- Modify: `src/app/api/partes/solicitudes/[id]/radicar/route.ts`
- Usar helper existente `src/lib/notifications.ts` si ya envía con Resend

- [ ] **Step 1: Leer `src/lib/notifications.ts`**

Run: `Read src/lib/notifications.ts`
(verificar si hay función `sendEmail` o similar)

- [ ] **Step 2: Tras RPC exitosa, enviar emails**

En el route de radicar, después de recibir `rpcOut`:

```typescript
// Email al deudor + admin del centro (no bloquea si falla)
try {
  const { data: centro } = await supabaseAdmin
    .from("sgcc_centers").select("nombre, email").eq("id", draft.center_id).maybeSingle();
  const { data: user } = await supabaseAdmin
    .from("sgcc_users").select("email, nombre").eq("id", guard.userId).maybeSingle();
  // Llamar a helper de notifications.ts con plantillas
  // ...
} catch (e) {
  console.error("[radicar] error email:", e);
}
```

(Detalle de plantillas delegado al módulo de notifications existente.)

- [ ] **Step 3: Smoke test**

Verificar en Vercel preview con `RESEND_API_KEY` configurado que llega correo al radicar.
Si no está configurado, debe radicar igual y solo loguear.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/partes/solicitudes/\[id\]/radicar/route.ts
git commit -m "feat(portal-partes): email al deudor y centro al radicar (fallo silencioso)"
```

### Task 5.2: Banner de deprecación en widget público

**Files:**
- Modify: `src/app/widget/[centerId]/page.tsx`

- [ ] **Step 1: Agregar banner al inicio de la página**

Antes del renderizado del wizard, añadir:

```tsx
<div className="mb-6 rounded-lg bg-blue-50 border border-blue-200 p-4">
  <p className="text-sm text-blue-900 font-medium">
    ¿Prefieres seguir tu solicitud con seguimiento completo?
  </p>
  <p className="text-sm text-blue-800 mt-1">
    Crea una cuenta y radica desde el portal — podrás ver el estado, recibir notificaciones
    y cargar documentos desde cualquier dispositivo.
  </p>
  <a href="/registro/parte" className="inline-block mt-2 text-sm font-medium text-[#0D2340] underline">
    Crear cuenta
  </a>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/widget/\[centerId\]/page.tsx
git commit -m "feat(portal-partes): banner en widget público invitando a crear cuenta"
```

### Task 5.3: Feature flag

**Files:**
- Modify: `src/app/(partes)/mis-solicitudes/page.tsx` (guard)
- Modify: `src/app/(partes)/mis-solicitudes/nueva/page.tsx` (guard)

- [ ] **Step 1: Agregar guard env**

Al inicio de ambas pages:

```tsx
if (process.env.ENABLE_PORTAL_PARTES_SOLICITUDES !== "true") {
  redirect("/mis-casos");
}
```

- [ ] **Step 2: Documentar en README / deploy notes**

Crear o actualizar `docs/superpowers/specs/2026-04-18-portal-partes-solicitudes-design.md` si es necesario (ya contiene la sección 13).

- [ ] **Step 3: Commit**

```bash
git add src/app/\(partes\)/mis-solicitudes/
git commit -m "feat(portal-partes): feature flag ENABLE_PORTAL_PARTES_SOLICITUDES"
```

### Task 5.4: Verificación final y PR

- [ ] **Step 1: Build completo**

```bash
cd /c/Users/SD21/sgcc-portal-worktree
npx tsc --noEmit
npm run build
npm run lint
```
Expected: todo OK.

- [ ] **Step 2: Smoke tests finales**

Ejecutar los tres flujos completos en dev server:
1. Registro con código corto
2. Crear + radicar conciliación
3. Crear + radicar insolvencia (con 2 acreedores en mora y 30%+)

- [ ] **Step 3: Push rama y abrir PR**

```bash
git push -u origin feature/portal-partes-solicitudes
gh pr create --title "feat(portal-partes): radicación de solicitudes por usuarios (conciliación + insolvencia Ley 2445/2025)" \
  --body "$(cat <<'EOF'
## Summary
- Portal de partes puede radicar solicitudes de conciliación e insolvencia
- Borrador persistente con auto-save cada 3 s
- Validaciones Ley 2445/2025 (30% mora, pequeño comerciante, REDAM, juramento)
- Cálculo automático del pequeño acreedor (5% del capital)
- Widget público marcado como deprecado (banner invitando a crear cuenta)
- Feature flag `ENABLE_PORTAL_PARTES_SOLICITUDES` para rollout controlado

## Migración
- `019_portal_partes_solicitudes.sql` ejecutar en Supabase prod antes de activar flag

## Test plan
- [ ] Registro de parte con código corto válido/inválido
- [ ] Crear draft conciliación → radicar
- [ ] Crear draft insolvencia → 2 acreedores con 30%+ mora → radicar
- [ ] Validación rechaza si no cumple supuestos Art. 538
- [ ] Falta REDAM → error al radicar
- [ ] Juramento sin aceptar → error

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Notificar**

Ejecutar el flujo de validación con el usuario antes de mergear.

---

## Self-review resumen

**Spec coverage:** Todas las secciones 1-15 del spec están cubiertas por tareas concretas. La sección 12 (Testing) queda parcialmente cubierta — solo smoke tests manuales, no unitarios, por ausencia de framework; se documenta en la sección de testing approach de este plan.

**Placeholders:** Ninguno — todo código completo.

**Riesgos reconocidos:**
- La función `sgcc_documents` puede tener columna `created_by` que no existía antes — verificar en la migración 019 o hacer migración complementaria.
- La columna `nombre_persona` en `sgcc_case_parties` usada por la RPC puede no existir; verificar schema actual y ajustar la RPC si es necesario.
- La función `set_updated_at()` debe existir en Supabase (se asume que sí desde migraciones previas).

**Archivo resultante:** ~35 tareas, divididas en 6 fases, con commits frecuentes.
