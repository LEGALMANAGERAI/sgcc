# Diseño — Optimización del flujo de audiencias (Entregable #1: Consolidación UX del expediente)

**Fecha:** 2026-06-09
**Rama:** `feature/expediente-flujo-audiencias`
**Estado:** Propuesta para revisión

---

## 1. Contexto y problema

El expediente (`src/app/(staff)/expediente/[id]/page.tsx`) presenta hoy **7-8 pestañas planas**, todas al mismo nivel jerárquico:

```
[Info General] [Documentos] [Admisión] [Poderes] [Asistencia] [Acta] [Procesos] (+Acreencias en insolvencia)
```

El trabajo real, sin embargo, es **secuencial** (admisión → poderes → citación → audiencia → asistencia → acta), y arriba ya existe un **"Flujo del caso"** (componente `CasoTimeline`) que permite editar varias de esas etapas desde un modal. Resultado:

- **Demasiadas pestañas planas** sin reflejar el orden del proceso.
- **Solapamiento** entre el timeline (que edita etapas) y las pestañas (que editan lo mismo).
- **Ubicación incoherente** de contenido: "Observaciones de audiencias" vive dentro de Info; la pestaña "Acta" cambia de cara (si no hay audiencia muestra "Programar audiencia"; si hay, muestra el acta).
- **Una sola audiencia visible** en el timeline aunque un caso pueda tener varias (inicial, continuación, complementaria).
- **Doble tipeo** entre la propuesta/relación conciliada de Acreencias y la tabla de obligaciones del Acta.

Esto hace que el flujo se sienta pesado y, en palabras del usuario, *"tiene mucha cosa que puede ir en opciones que ya tenemos del flujo y por eso no lo usamos"*.

## 2. Objetivos

1. Reducir las 7-8 pestañas planas a **4 pestañas**, agrupadas por etapa del proceso, con **sub-pestañas** internas.
2. Hacer que el **timeline** (que se mantiene) y las pestañas funcionen de forma **coherente**: el timeline navega, no duplica.
3. Permitir que el timeline muestre **varias audiencias** con un botón **"+"** para agregar continuaciones.
4. Eliminar el **doble tipeo** Acta↔Acreencias mediante un botón para **importar la obligación conciliada** de la relación definitiva.

## 3. No-objetivos (fuera de este entregable)

- **Motor de autos/plantillas** (los 16 documentos de `minutas/`, perfil de centro parametrizable, generación Word/PDF de autos). Es el **Entregable #2**, con su propio spec.
- **Unificar las tablas duplicadas en BD** (`sgcc_case_parties.asistio` vs `sgcc_hearing_attendance`; `sgcc_case_parties.apoderado_*` vs `sgcc_case_attorneys`). Es deuda técnica de fondo, no afecta la UX pedida. Se documenta pero **no se ejecuta aquí**.
- Cambios al motor de cálculo de acreencias, votación o amortización.

## 4. Diseño

### A) Estructura de pestañas: de 7-8 planas → 4 con sub-pestañas

```
ANTES:
[Info][Documentos][Admisión][Poderes][Asistencia][Acta][Procesos](+Acreencias)

DESPUÉS:
┌──────────┬─────────────────────┬──────────────────────────────┬──────────┐
│   Info   │     Documentos      │         Audiencia            │ Procesos │
│ General  │  [Soportes]         │  [Asistencia]                │          │
│          │  [Admisión]         │  [Acreencias]* (insolvencia) │          │
│          │  [Poderes]          │  [Acta]                      │          │
└──────────┴─────────────────────┴──────────────────────────────┴──────────┘
  * El sub-tab Acreencias solo aparece si tipo_tramite = "insolvencia".
    En conciliación / acuerdo de apoyo, Audiencia tiene [Asistencia][Acta].
```

**Mapeo de contenido (qué componente va dónde — no se reescriben, se reubican):**

| Pestaña | Sub-pestaña | Componente actual reutilizado |
|---|---|---|
| Info General | — | `TabInfo` (sin las "Observaciones de audiencias", que se mueven a Audiencia) |
| Documentos | Soportes | `TabDocumentos` |
| Documentos | Admisión | `TabChecklistAdmision` |
| Documentos | Poderes | `TabChecklistPoderes` |
| Audiencia | Asistencia | `TabAsistencia` + "Programar audiencia" (`ProgramarAudienciaInlineCard`) cuando no hay audiencias + `HistorialObservacionesAudiencias` |
| Audiencia | Acreencias* | `HerramientaAcreencias` (insolvencia) |
| Audiencia | Acta | `CrearActaConciliacion` / `CrearActaInsolvencia` / `CrearActaAcuerdoApoyo` según tipo |
| Procesos | — | `TabProcesos` |

**Orden de sub-pestañas en Audiencia:** `Asistencia` → `Acreencias` → `Acta`. La asistencia va primero porque se hace al inicio de la audiencia (incluso por un asistente); el acta cierra.

**Navegación (URL):** se extiende el patrón actual `?tab=` con un segundo parámetro `?tab=documentos&sub=admision`. Server component, sin estado cliente. Si `sub` falta, se usa la primera sub-pestaña por defecto.

**Compatibilidad de enlaces existentes:** hoy varios sitios enlazan con `?tab=asistencia`, `?tab=acta`, `?tab=acreencias`, `?tab=admision`, `?tab=poderes`, `?tab=documentos`. Se agrega una **tabla de redirección** de claves viejas → nueva pestaña+sub:

| `?tab=` viejo | Redirige a |
|---|---|
| `admision` | `documentos&sub=admision` |
| `poderes` | `documentos&sub=poderes` |
| `documentos` | `documentos&sub=soportes` |
| `asistencia` | `audiencia&sub=asistencia` |
| `acta` | `audiencia&sub=acta` |
| `acreencias` | `audiencia&sub=acreencias` |

### B) Importar la obligación conciliada al Acta (eliminar doble tipeo)

En el Acta de insolvencia (`CrearActaInsolvencia`), la tabla de "Obligaciones pactadas" hoy se escribe **a mano**, duplicando lo que ya quedó en la **relación definitiva de acreencias** (módulo Acreencias, tabla `sgcc_acreencias` con valores conciliados).

**Cambio:** agregar un botón **"Importar obligaciones de la relación definitiva conciliada"** que pre-carga la tabla de obligaciones del Acta con los valores **conciliados** (no la propuesta teórica — lo que realmente pasó). El usuario puede editar después.

- **Fuente de datos:** las acreencias del caso con sus valores conciliados (`con_capital`, `con_intereses_*`, etc.), individual o consolidada por acreedor.
- **Comportamiento:** botón visible solo en insolvencia y solo si hay acreencias conciliadas. No sobrescribe sin confirmación si ya hay obligaciones escritas.
- **Alcance acotado:** este entregable solo hace el **pre-llenado** de la tabla de obligaciones del Acta. La generación de los autos/plantillas completos es del Entregable #2.

### C) Timeline coherente (navegación, no duplicación)

El "Flujo del caso" (`CasoTimeline`) **se mantiene**. Hoy cada nodo: (a) al clic en el círculo **mueve** la etapa del caso (`moverAEtapa` → `/api/casos/[id]/avanzar`), y (b) tiene un lápiz que abre `EditarEtapaModal`.

**Cambio:** cada etapa del timeline se vuelve, además, un **enlace de navegación** a la pestaña+sub-pestaña correspondiente, para que el timeline diga "dónde vamos" y al usarlo lleve a "dónde se trabaja eso":

| Etapa timeline | Navega a |
|---|---|
| Solicitud | `info` |
| Admisión | `documentos&sub=admision` |
| Citación | `documentos&sub=soportes` (la citación se gestiona como documento/soporte) |
| Audiencia | `audiencia&sub=asistencia` |
| Acta | `audiencia&sub=acta` |
| Archivo | `info` |

**Resolución del conflicto de clics** (el círculo ya hace "mover etapa"): se separa la acción.
- El **label + ícono** de cada etapa → navega a su pestaña (acción frecuente, segura).
- **Mover la etapa del caso** deja de colgar del clic en el círculo y pasa a una acción explícita dentro de `EditarEtapaModal` (botón "Marcar como etapa actual"), evitando movimientos accidentales. *(Decisión a confirmar — ver §8.)*

### D) Timeline con varias audiencias + botón "+"

Hoy el nodo "Audiencia" del timeline es **único**, aunque `CasoTimeline` ya recibe `audiencias[]` completo (solo lo usa dentro del modal).

**Cambio:** bajo el nodo "Audiencia" se renderiza una fila de **chips**, uno por cada audiencia del caso, más un chip **"+"**:

```
        ● Audiencia
        │
  ┌─────┴───────────────────────────────┐
  │ [Inicial · 12 jun] [Cont. · 19 jun] [ + ] │
  └───────────────────────────────────────────┘
```

- Cada chip muestra **tipo** (inicial / continuación / complementaria) + **fecha**, y su **estado** (programada / finalizada / suspendida / cancelada) por color.
- **Clic en un chip** → navega a `audiencia&sub=asistencia` enfocando esa audiencia (`?hearing=<id>`).
- **Clic en "+"** → abre el flujo de **programar nueva audiencia** (reutiliza `ProgramarAudienciaInlineCard` / `AudienciaForm` o el modal existente), con tipo por defecto "continuación".
- Si no hay audiencias, se muestra solo el chip "+" con etiqueta "Programar audiencia".

## 5. Modelo de datos

**No se crean ni modifican tablas.** Se reutiliza todo lo existente:
- `sgcc_hearings` (audiencias), `sgcc_hearing_attendance` (asistencia), `sgcc_actas` (actas), `sgcc_acreencias` (relación conciliada), `sgcc_case_timeline` (flujo).
- La importación de obligaciones (B) **lee** `sgcc_acreencias` y **escribe** en el payload del acta (`sgcc_actas.obligaciones` JSONB) vía el endpoint existente `POST /api/casos/[id]/acta` — sin cambios de esquema.

## 6. Archivos afectados (estimado)

| Archivo | Cambio |
|---|---|
| `src/app/(staff)/expediente/[id]/page.tsx` | Reestructurar `TABS` a 4 grupos con sub-tabs; leer `?sub=`; tabla de redirección de claves viejas; mover "Observaciones" a Audiencia |
| `src/components/modules/casos/CasoTimeline.tsx` | Navegación por etapa; chips de audiencias + botón "+"; separar "mover etapa" al modal |
| `src/components/modules/casos/EditarEtapaModal.tsx` | Botón explícito "Marcar como etapa actual" (si se confirma §8) |
| `src/components/modules/expediente/CrearActaInsolvencia.tsx` | Botón "Importar obligaciones de la relación definitiva conciliada" + lógica de pre-llenado |
| (posible) nuevo `SubTabs.tsx` en `components/ui` | Componente reutilizable de sub-pestañas (si no existe uno) |

## 7. Plan de pruebas

- **Manual (dev):** recorrer un caso de cada tipo (conciliación, insolvencia, acuerdo de apoyo) y verificar que cada pestaña/sub-pestaña carga el contenido correcto; que los enlaces viejos `?tab=` redirigen bien; que el timeline navega; que los chips de audiencia aparecen para casos con varias audiencias; que el botón "+" programa una continuación; que "Importar obligaciones" pre-llena el acta con los valores conciliados.
- **No romper:** verificar que mover la etapa del caso sigue funcionando (desde el modal) y que la colaboración en tiempo real (`CollaborationBar`) y el contador de término no se afectan.
- **Regresión de enlaces:** buscar en el código todos los `?tab=` y confirmar que la redirección los cubre.

## 8. Decisiones abiertas (a confirmar por el usuario antes de implementar)

1. **Mover etapa del caso:** ¿OK quitar el "mover etapa" del clic en el círculo del timeline y dejarlo como botón explícito dentro del modal de editar etapa? (Evita movimientos accidentales, pero cambia un comportamiento existente.)
2. **Citación:** hoy "Citación" es una etapa del timeline pero no tiene pestaña propia. ¿La dejamos navegando a `Documentos > Soportes`, o querés una sub-pestaña/sección de Citación en algún lado?
3. **Procesos** (vigilancia rama judicial): ¿se queda como 4ª pestaña de nivel superior, o preferís moverla a una sub-pestaña dentro de otra (p. ej. Documentos) ya que es un concepto lateral?

## 9. Riesgos

- **Enlaces rotos** por el cambio de `?tab=`: mitigado con la tabla de redirección y la búsqueda de regresión.
- **Cambio de comportamiento del timeline** (mover etapa): mitigado dejándolo explícito en el modal; requiere confirmación del usuario (§8.1).
- **`HerramientaAcreencias` es grande (3758 líneas):** al moverla a sub-pestaña solo cambia su contenedor, no su lógica; bajo riesgo.
