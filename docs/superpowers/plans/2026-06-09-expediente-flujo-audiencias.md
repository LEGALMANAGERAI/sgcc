# Optimización flujo de audiencias — Plan de implementación (Entregable #1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidar las 7-8 pestañas planas del expediente en 4 pestañas con sub-pestañas, hacer el timeline coherente (navega + muestra varias audiencias con "+"), y permitir importar la obligación conciliada al acta.

**Architecture:** Reorganización de UI en server component (`expediente/[id]/page.tsx`) usando navegación por URL (`?tab=` + `?sub=`) con tabla de redirección de claves viejas; el timeline (`CasoTimeline`, client component) gana navegación por etapa y chips de audiencias; el acta de insolvencia recibe las acreencias conciliadas como prop y las importa a su tabla de obligaciones. No hay cambios de base de datos.

**Tech Stack:** Next.js (App Router, server components) · React · TypeScript · Tailwind · Supabase · lucide-react · clsx.

**Convención de pruebas:** El repo **no tiene framework de tests** (cero tests, solo `next dev/build/start/lint`). Montar Jest/Vitest para este cambio sería scope creep contra el patrón del proyecto. La compuerta automática de cada tarea es **`npx tsc --noEmit`** (typecheck) + **`npm run lint`**, más una **verificación manual en dev** descrita en cada tarea. TDD clásico no aplica aquí por ser reorganización de UI sin lógica nueva testeable de forma aislada (salvo la función de import, que se valida en dev).

---

## Estructura de archivos

| Archivo | Responsabilidad | Acción |
|---|---|---|
| `src/components/ui/SubTabs.tsx` | Barra de sub-pestañas reutilizable (presentacional, enlaces) | Crear |
| `src/app/(staff)/expediente/[id]/page.tsx` | Definición de las 4 pestañas + sub-pestañas, lectura de `?sub=`, redirección de claves viejas, ruteo de contenido | Modificar |
| `src/components/modules/expediente/CrearActaInsolvencia.tsx` | Botón "Importar obligación conciliada" + función de mapeo; nueva prop `acreenciasConciliadas` | Modificar |
| `src/components/modules/casos/CasoTimeline.tsx` | Navegación por etapa (label→tab), chips multi-audiencia + botón "+", quitar "mover etapa" del clic en círculo | Modificar |
| `src/components/modules/casos/EditarEtapaModal.tsx` | Botón explícito "Marcar como etapa actual" (mover etapa) | Modificar |
| `src/components/modules/expediente/TabAsistencia.tsx` | Actualizar 2 enlaces `?tab=` a nuevo formato | Modificar |
| `src/app/(staff)/dashboard/page.tsx` | Actualizar 5 enlaces `?tab=` a nuevo formato | Modificar |
| `src/components/modules/apoderados/ApoderadoHistorial.tsx` | Actualizar 1 enlace `?tab=` a nuevo formato | Modificar |

---

## Task 1: Componente reutilizable de sub-pestañas

**Files:**
- Create: `src/components/ui/SubTabs.tsx`

- [ ] **Step 1: Crear el componente presentacional de sub-pestañas**

Es un server component (solo enlaces, sin estado). Sigue el estilo de la barra de pestañas existente en `expediente/[id]/page.tsx` (borde inferior, activo en azul `#1B4F9B`).

```tsx
import Link from "next/link";
import { clsx } from "clsx";

export interface SubTab {
  key: string;
  label: string;
}

interface SubTabsProps {
  /** Ruta base sin querystring, ej: `/expediente/abc` */
  basePath: string;
  /** Clave de la pestaña padre, ej: `documentos` */
  tab: string;
  /** Sub-pestañas a mostrar */
  subTabs: SubTab[];
  /** Sub-pestaña activa */
  activeSub: string;
}

export function SubTabs({ basePath, tab, subTabs, activeSub }: SubTabsProps) {
  return (
    <div className="mb-5">
      <nav className="inline-flex gap-1 rounded-lg bg-gray-100 p-1">
        {subTabs.map((st) => {
          const isActive = activeSub === st.key;
          return (
            <Link
              key={st.key}
              href={`${basePath}?tab=${tab}&sub=${st.key}`}
              className={clsx(
                "px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
                isActive
                  ? "bg-white text-[#0D2340] shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              {st.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores nuevos referidos a `SubTabs.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/SubTabs.tsx
git commit -m "feat(ui): componente reutilizable SubTabs para sub-pestañas"
```

---

## Task 2: Reestructurar pestañas del expediente a 4 grupos con sub-pestañas

**Files:**
- Modify: `src/app/(staff)/expediente/[id]/page.tsx`

Contexto: hoy `BASE_TABS` define 7 pestañas planas (`info, documentos, admision, poderes, asistencia, acta, procesos`) + `acreencias` dinámica; el contenido se rutea con `activeTab === "..."` (líneas ~466-589). Vamos a: (a) definir 4 pestañas de nivel superior, (b) leer `?sub=`, (c) redirigir claves viejas, (d) reagrupar el render.

- [ ] **Step 1: Reemplazar la definición de pestañas y el parseo de `tab`/`sub`**

Reemplaza el bloque de constantes `BASE_TABS` (líneas ~42-52) por esta definición de pestañas de nivel superior + sub-pestañas + mapa de redirección:

```tsx
const TOP_TABS = [
  { key: "info", label: "Info General" },
  { key: "documentos", label: "Documentos" },
  { key: "audiencia", label: "Audiencia" },
  { key: "procesos", label: "Procesos" },
] as const;

// Sub-pestañas por pestaña. `audiencia` agrega "acreencias" solo en insolvencia (se inyecta abajo).
const SUBTABS_DOCUMENTOS = [
  { key: "soportes", label: "Soportes" },
  { key: "admision", label: "Admisión" },
  { key: "poderes", label: "Poderes" },
];
const SUBTABS_AUDIENCIA_BASE = [
  { key: "asistencia", label: "Asistencia" },
  { key: "acta", label: "Acta" },
];

// Claves `?tab=` viejas → { tab, sub } nuevo. Mantiene compatibilidad de enlaces externos.
const REDIRECT_TAB: Record<string, { tab: string; sub?: string }> = {
  documentos: { tab: "documentos", sub: "soportes" },
  admision: { tab: "documentos", sub: "admision" },
  poderes: { tab: "documentos", sub: "poderes" },
  asistencia: { tab: "audiencia", sub: "asistencia" },
  acta: { tab: "audiencia", sub: "acta" },
  acreencias: { tab: "audiencia", sub: "acreencias" },
  procesos: { tab: "procesos" },
  info: { tab: "info" },
};

type TopTabKey = "info" | "documentos" | "audiencia" | "procesos";
```

- [ ] **Step 2: Reemplazar el cálculo de `activeTab` por resolución tab+sub con redirección**

Reemplaza la línea `const activeTab = (...)` (línea ~64) por:

```tsx
  const rawTab = sp.tab ?? "info";
  const redirect = REDIRECT_TAB[rawTab] ?? { tab: rawTab };
  const activeTab = (TOP_TABS.some((t) => t.key === redirect.tab)
    ? redirect.tab
    : "info") as TopTabKey;
  // sub explícito en URL gana; si no, el de la redirección; si no, el default por pestaña
  const activeSub = (sp as any).sub ?? redirect.sub ?? null;
```

Y agrega `sub` al tipo de `searchParams` (interface `Props`, línea ~56):

```tsx
  searchParams: Promise<{ tab?: string; sub?: string }>;
```

- [ ] **Step 3: Construir las sub-pestañas de Audiencia según el tipo de trámite y resolver el sub activo**

Justo después de cargar `caso` y antes del render (cerca de donde hoy se arma `TABS`, línea ~289), reemplaza ese bloque `const TABS = [...]` por:

```tsx
  const subtabsAudiencia = caso.tipo_tramite === "insolvencia"
    ? [
        { key: "asistencia", label: "Asistencia" },
        { key: "acreencias", label: "Acreencias" },
        { key: "acta", label: "Acta" },
      ]
    : SUBTABS_AUDIENCIA_BASE;

  // Sub activo efectivo por pestaña (default = primera sub-pestaña)
  const subDocumentos = activeSub && SUBTABS_DOCUMENTOS.some((s) => s.key === activeSub)
    ? activeSub
    : "soportes";
  const subAudiencia = activeSub && subtabsAudiencia.some((s) => s.key === activeSub)
    ? activeSub
    : "asistencia";
```

- [ ] **Step 4: Reemplazar la barra de pestañas (Tabs bar) por las 4 pestañas de nivel superior**

Reemplaza el `<nav>` de la barra de pestañas (líneas ~444-463) para iterar `TOP_TABS` y construir el `href` con la primera sub-pestaña de cada grupo:

```tsx
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-0 -mb-px">
          {TOP_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const href =
              tab.key === "info"
                ? `/expediente/${id}`
                : tab.key === "documentos"
                ? `/expediente/${id}?tab=documentos&sub=soportes`
                : tab.key === "audiencia"
                ? `/expediente/${id}?tab=audiencia&sub=asistencia`
                : `/expediente/${id}?tab=${tab.key}`;
            return (
              <Link
                key={tab.key}
                href={href}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? "border-[#1B4F9B] text-[#0D2340] font-bold"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
```

- [ ] **Step 5: Reagrupar el contenido — pestaña Documentos con sub-pestañas**

Importa `SubTabs` arriba (`import { SubTabs } from "@/components/ui/SubTabs";`). Reemplaza los bloques `activeTab === "documentos"`, `activeTab === "admision"` y `activeTab === "poderes"` por **un solo** bloque de pestaña Documentos:

```tsx
      {activeTab === "documentos" && (
        <>
          <SubTabs
            basePath={`/expediente/${id}`}
            tab="documentos"
            subTabs={SUBTABS_DOCUMENTOS}
            activeSub={subDocumentos}
          />
          {subDocumentos === "soportes" && (
            <TabDocumentos
              caseId={id}
              documentos={documentos}
              expedienteDigitalUrl={caso.expediente_digital_url ?? null}
              puedeEditarLink={(session.user as any).userType === "staff"}
              puedeEliminar={(session.user as any).userType === "staff"}
            />
          )}
          {subDocumentos === "admision" && (
            <TabChecklistAdmision
              caseId={id}
              checklist={checklistAdmision}
              responses={admisionResponses}
              documentos={documentos.map((d: any) => ({ id: d.id, nombre: d.nombre, tipo: d.tipo }))}
            />
          )}
          {subDocumentos === "poderes" && (
            <TabChecklistPoderes
              caseId={id}
              parties={parties}
              attorneys={attorneys}
              checklist={checklistPoderes}
              responses={poderesResponses}
            />
          )}
        </>
      )}
```

- [ ] **Step 6: Reagrupar el contenido — pestaña Audiencia con sub-pestañas (incluye mover "Observaciones" aquí)**

Reemplaza los bloques `activeTab === "asistencia"`, ambos `activeTab === "acta"` y `activeTab === "acreencias"` por **un solo** bloque de pestaña Audiencia. Nota: el `HistorialObservacionesAudiencias` que hoy está dentro de Info se mueve aquí (sub-pestaña Asistencia).

```tsx
      {activeTab === "audiencia" && (
        <>
          <SubTabs
            basePath={`/expediente/${id}`}
            tab="audiencia"
            subTabs={subtabsAudiencia}
            activeSub={subAudiencia}
          />

          {subAudiencia === "asistencia" && (
            <>
              {hearings.length > 0 ? (
                <TabAsistencia
                  caseId={id}
                  hearings={hearings}
                  parties={parties}
                  attorneys={attorneys}
                  attendance={attendance}
                />
              ) : (
                <ProgramarAudienciaInlineCard
                  caseId={id}
                  conciliadores={conciliadoresList}
                  salas={salasList}
                  defaultConciliadorId={caso.conciliador_id ?? null}
                  tipoTramite={caso.tipo_tramite}
                />
              )}
              <div className="mt-8">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">Observaciones de audiencias</h3>
                  <p className="text-[11px] text-gray-400">Edita cada observación en línea</p>
                </div>
                <HistorialObservacionesAudiencias caseId={id} audiencias={hearings} />
              </div>
            </>
          )}

          {subAudiencia === "acreencias" && caso.tipo_tramite === "insolvencia" && (
            <HerramientaAcreencias
              caseId={id}
              acreedoresIniciales={acreencias}
              partesConvocados={parties
                .filter((p: any) => p.rol === "convocado" && p.party)
                .map((p: any) => ({
                  id: p.party.id,
                  nombre: p.party.razon_social ?? [p.party.nombres, p.party.apellidos].filter(Boolean).join(" "),
                  documento: p.party.numero_doc ?? p.party.nit_empresa ?? "",
                }))}
            />
          )}

          {subAudiencia === "acta" && hearings.length > 0 && (
            <div className="mt-6">
              {caso.tipo_tramite === "insolvencia" && (
                <CrearActaInsolvencia
                  caseId={id}
                  hearingId={hearings[hearings.length - 1].id}
                  acreenciasConciliadas={acreencias}
                />
              )}
              {caso.tipo_tramite === "conciliacion" && (
                <CrearActaConciliacion caseId={id} hearingId={hearings[hearings.length - 1].id} />
              )}
              {caso.tipo_tramite === "acuerdo_apoyo" && (
                <CrearActaAcuerdoApoyo caseId={id} hearingId={hearings[hearings.length - 1].id} />
              )}
            </div>
          )}

          {subAudiencia === "acta" && hearings.length === 0 && (
            <ProgramarAudienciaInlineCard
              caseId={id}
              conciliadores={conciliadoresList}
              salas={salasList}
              defaultConciliadorId={caso.conciliador_id ?? null}
              tipoTramite={caso.tipo_tramite}
            />
          )}
        </>
      )}
```

> Nota: la prop `acreenciasConciliadas` de `CrearActaInsolvencia` se agrega en la Task 3; este código ya la pasa. Si ejecutas Task 2 antes que Task 3, `tsc` marcará la prop faltante hasta completar Task 3 — ejecuta ambas antes del commit final de Task 3, o usa `acreenciasConciliadas={acreencias}` y agrega la prop en Task 3 inmediatamente después.

- [ ] **Step 7: Quitar el `HistorialObservacionesAudiencias` del bloque Info**

En el bloque `activeTab === "info"` (líneas ~466-488), elimina el `<div className="mt-8">...HistorialObservacionesAudiencias...</div>` (ya se movió a Audiencia en Step 6). Conserva `TabInfo` y `EliminarExpediente`.

- [ ] **Step 8: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores (excepto, temporalmente, la prop `acreenciasConciliadas` si Task 3 aún no se hizo — ver nota en Step 6).

- [ ] **Step 9: Verificación manual en dev**

Run: `npm run dev` (en la terminal dedicada del usuario) y abrir un expediente.
Verificar:
- Se ven 4 pestañas: Info General · Documentos · Audiencia · Procesos.
- Documentos muestra sub-pestañas `[Soportes][Admisión][Poderes]` y cada una carga su contenido.
- Audiencia muestra `[Asistencia][Acta]` (conciliación/apoyo) o `[Asistencia][Acreencias][Acta]` (insolvencia).
- "Observaciones de audiencias" aparece bajo Audiencia > Asistencia, ya no en Info.
- Abrir `/expediente/<id>?tab=admision` redirige (muestra) Documentos > Admisión; `?tab=acta` muestra Audiencia > Acta.

- [ ] **Step 10: Commit**

```bash
git add src/app/\(staff\)/expediente/\[id\]/page.tsx
git commit -m "feat(expediente): 4 pestañas con sub-pestañas (Documentos y Audiencia) + redirección de claves viejas"
```

---

## Task 3: Importar obligación conciliada al Acta de insolvencia

**Files:**
- Modify: `src/components/modules/expediente/CrearActaInsolvencia.tsx`

- [ ] **Step 1: Agregar la prop `acreenciasConciliadas` a la interfaz**

En `interface CrearActaInsolvenciaProps` (línea ~21), agrega el campo (tipado laxo, igual que el resto del archivo):

```tsx
interface CrearActaInsolvenciaProps {
  caseId: string;
  hearingId: string;
  acreenciasConciliadas?: any[];
}
```

Y en la firma del componente (línea ~56):

```tsx
export function CrearActaInsolvencia({ caseId, hearingId, acreenciasConciliadas = [] }: CrearActaInsolvenciaProps) {
```

- [ ] **Step 2: Agregar la función de import y un flag de "hay conciliadas"**

Justo después de `actualizarObligacion` (línea ~129), agrega:

```tsx
  // Total conciliado de una acreencia = capital + intereses + seguros + otros (columnas con_*)
  const totalConciliado = useCallback((a: any) => {
    return (
      Number(a.con_capital ?? 0) +
      Number(a.con_intereses_corrientes ?? 0) +
      Number(a.con_intereses_moratorios ?? 0) +
      Number(a.con_seguros ?? 0) +
      Number(a.con_otros ?? 0)
    );
  }, []);

  const conciliadasDisponibles = useMemo(
    () => acreenciasConciliadas.filter((a) => totalConciliado(a) > 0),
    [acreenciasConciliadas, totalConciliado]
  );

  const importarObligacionesConciliadas = useCallback(() => {
    const CLASE_LABEL: Record<string, string> = {
      primera: "1ª clase", segunda: "2ª clase", tercera: "3ª clase",
      cuarta: "4ª clase", quinta: "5ª clase",
    };
    const importadas: Obligacion[] = conciliadasDisponibles.map((a) => ({
      acreedor: a.acreedor_nombre ?? "",
      obligacion: `Crédito ${CLASE_LABEL[a.clase_credito] ?? a.clase_credito ?? ""} conciliado`.trim(),
      plazo: "",
      monto: String(totalConciliado(a)),
    }));
    const tieneContenido = obligaciones.some((ob) => ob.acreedor || ob.obligacion || ob.monto);
    if (tieneContenido && !confirm("Esto reemplazará las obligaciones actuales con las conciliadas. ¿Continuar?")) {
      return;
    }
    setObligaciones(importadas.length ? importadas : [{ acreedor: "", obligacion: "", plazo: "", monto: "" }]);
  }, [conciliadasDisponibles, totalConciliado, obligaciones]);
```

Asegúrate de que `useMemo` y `useCallback` estén en el import de React (ya se usan en el archivo, líneas ~103/113).

- [ ] **Step 3: Agregar el botón en el encabezado de "Obligaciones pactadas"**

En el encabezado de la sección "Obligaciones pactadas" (línea ~360, junto al botón `agregarObligacion`), agrega el botón de import **antes** del de agregar. Solo se muestra si hay conciliadas:

```tsx
              {conciliadasDisponibles.length > 0 && (
                <button
                  type="button"
                  onClick={importarObligacionesConciliadas}
                  className="text-xs font-medium text-[#1B4F9B] hover:underline mr-3"
                  title="Carga las obligaciones desde la relación definitiva conciliada"
                >
                  ↓ Importar obligación conciliada ({conciliadasDisponibles.length})
                </button>
              )}
```

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores; la prop `acreenciasConciliadas` ahora existe (resuelve la nota de Task 2 Step 6).

- [ ] **Step 5: Verificación manual en dev**

En un caso de insolvencia con acreencias conciliadas (valores `con_*` > 0), ir a Audiencia > Acta:
- Aparece el botón "↓ Importar obligación conciliada (N)".
- Al pulsarlo, la tabla de obligaciones se llena con acreedor + descripción de clase + monto conciliado.
- Si ya había obligaciones, pide confirmación antes de reemplazar.
- En un caso sin acreencias conciliadas, el botón no aparece.

- [ ] **Step 6: Commit**

```bash
git add src/components/modules/expediente/CrearActaInsolvencia.tsx
git commit -m "feat(acta): importar obligación conciliada de la relación definitiva al acta de insolvencia"
```

---

## Task 4: Timeline navegable + mover "mover etapa" al modal

**Files:**
- Modify: `src/components/modules/casos/CasoTimeline.tsx`
- Modify: `src/components/modules/casos/EditarEtapaModal.tsx`

Contexto: hoy el clic en el círculo de cada paso llama `moverAEtapa` (línea ~126). Vamos a: (a) que el label+ícono de cada paso navegue a su pestaña, (b) sacar el "mover etapa" del clic en círculo y exponerlo como botón en `EditarEtapaModal`.

- [ ] **Step 1: Definir el destino de navegación por etapa en `CasoTimeline`**

En `CasoTimeline.tsx`, después del array `STEPS` (línea ~28), agrega el mapa de navegación:

```tsx
const STEP_HREF: Record<string, string> = {
  solicitud: "",
  admision: "?tab=documentos&sub=admision",
  citacion: "?tab=documentos&sub=soportes",
  audiencia: "?tab=audiencia&sub=asistencia",
  acta: "?tab=audiencia&sub=acta",
  archivo: "",
};
```

- [ ] **Step 2: Convertir el círculo en enlace de navegación (no "mover etapa")**

Reemplaza el `<button onClick={() => moverAEtapa(step.etapa)} ...>` (líneas ~124-153) por un `<Link>` que navega a la pestaña. Importa `Link` (`import Link from "next/link";`) arriba.

```tsx
              <Link
                href={`/expediente/${caseId}${STEP_HREF[step.etapa] ?? ""}`}
                title={`Ir a ${step.label}`}
                className={clsx(
                  "w-8 h-8 rounded-full flex items-center justify-center z-10 transition-all",
                  "hover:scale-110 hover:ring-2 hover:ring-[#0D2340]/30 cursor-pointer",
                  isCompleted
                    ? "bg-[#0D2340] text-white"
                    : isCurrent
                    ? "bg-[#1B4F9B] text-white ring-4 ring-amber-100"
                    : isActive
                    ? "bg-white border-2 border-[#0D2340] text-[#0D2340]"
                    : "bg-gray-100 text-gray-400 border-2 border-gray-200 hover:bg-gray-200 hover:text-[#0D2340] hover:border-[#0D2340]"
                )}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : <step.icon className="w-3.5 h-3.5" />}
              </Link>
```

> Esto elimina el uso de `moviendoEtapa`/`moverAEtapa` desde el círculo. **No borres** `moverAEtapa` todavía: se reutiliza vía el modal (Step 4). Si `tsc`/eslint marcan `moviendoEtapa` o `errorMover` como no usados, los moverás al modal en el Step siguiente; mientras tanto puedes dejar el bloque `errorMover` de aviso (líneas ~98-102) en su lugar.

- [ ] **Step 3: Actualizar el texto de ayuda del encabezado del timeline**

Reemplaza el `<p>` de ayuda (líneas ~94-96) por:

```tsx
        <p className="text-[11px] text-gray-400">
          Click en una etapa para ir a su pestaña · ✏️ para editar o mover el caso
        </p>
```

- [ ] **Step 4: Pasar la acción "mover a esta etapa" al `EditarEtapaModal`**

En `CasoTimeline.tsx`, pásale al modal una prop `onMoverEtapa` que ejecute la lógica de avanzar. Localiza el `<EditarEtapaModal ... />` (líneas ~183-195) y agrega la prop:

```tsx
        <EditarEtapaModal
          etapa={editingEtapa}
          caso={caso}
          partes={partes}
          audiencias={audiencias}
          actas={actas}
          conciliadores={conciliadores}
          secretarios={secretarios}
          salas={salas}
          onMoverEtapa={() => moverAEtapa(editingEtapa)}
          onClose={() => setEditingEtapa(null)}
        />
```

- [ ] **Step 5: Agregar el botón "Marcar como etapa actual" en `EditarEtapaModal`**

En `EditarEtapaModal.tsx`, agrega `onMoverEtapa?: () => void | Promise<void>;` a su interfaz de props y desestructúralo. En el footer del modal (junto a los botones de cerrar/guardar), agrega:

```tsx
        {onMoverEtapa && (
          <button
            type="button"
            onClick={async () => {
              await onMoverEtapa();
              onClose();
            }}
            className="text-sm font-medium text-[#1B4F9B] hover:underline mr-auto"
          >
            Marcar como etapa actual del caso
          </button>
        )}
```

(Ubícalo a la izquierda del footer con `mr-auto` para separarlo de Guardar/Cerrar.)

- [ ] **Step 6: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores. Si eslint reporta `moviendoEtapa` sin uso en el render, déjalo solo si se sigue usando en `moverAEtapa`; de lo contrario elimina la referencia huérfana en el JSX.

- [ ] **Step 7: Verificación manual en dev**

- Click en un círculo/etapa del timeline navega a la pestaña correcta (Admisión→Documentos/Admisión, Audiencia→Audiencia/Asistencia, Acta→Audiencia/Acta).
- El lápiz abre el modal; dentro hay un botón "Marcar como etapa actual del caso" que mueve el caso (con su confirmación) y cierra.
- Ya no se mueve la etapa por accidente al hacer click en el círculo.

- [ ] **Step 8: Commit**

```bash
git add src/components/modules/casos/CasoTimeline.tsx src/components/modules/casos/EditarEtapaModal.tsx
git commit -m "feat(timeline): etapas navegan a su pestaña; mover etapa pasa a botón explícito en el modal"
```

---

## Task 5: Chips de varias audiencias + botón "+" en el timeline

**Files:**
- Modify: `src/components/modules/casos/CasoTimeline.tsx`

Contexto: `CasoTimeline` ya recibe `audiencias: any[]` (todas las del caso). Cada audiencia tiene `id`, `fecha_hora`, `tipo` (`inicial|continuacion|complementaria`), `estado` (`programada|finalizada|suspendida|cancelada`). Vamos a renderizar chips bajo la barra del timeline.

- [ ] **Step 1: Agregar helpers de etiqueta/color de audiencia**

En `CasoTimeline.tsx`, después de `STEP_HREF` (Task 4 Step 1), agrega:

```tsx
const TIPO_AUD_LABEL: Record<string, string> = {
  inicial: "Inicial",
  continuacion: "Continuación",
  complementaria: "Complementaria",
};
const ESTADO_AUD_COLOR: Record<string, string> = {
  programada: "bg-blue-50 text-blue-700 border-blue-200",
  en_curso: "bg-amber-50 text-amber-700 border-amber-200",
  finalizada: "bg-green-50 text-green-700 border-green-200",
  suspendida: "bg-orange-50 text-orange-700 border-orange-200",
  cancelada: "bg-gray-100 text-gray-400 border-gray-200 line-through",
};
```

- [ ] **Step 2: Renderizar la fila de chips de audiencias + botón "+"**

Inmediatamente **después** del `</div>` que cierra la fila de pasos del timeline (el `<div className="flex items-start gap-0">...</div>`, cierra ~línea 181) y **antes** del bloque `{editingEtapa && (...)}`, agrega:

```tsx
      <div className="mt-5 pt-4 border-t border-gray-100">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold text-gray-500 mr-1">Audiencias:</span>
          {audiencias.length === 0 && (
            <span className="text-[11px] text-gray-400 italic mr-1">Ninguna programada</span>
          )}
          {audiencias.map((aud) => (
            <Link
              key={aud.id}
              href={`/expediente/${caseId}?tab=audiencia&sub=asistencia`}
              className={clsx(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors hover:brightness-95",
                ESTADO_AUD_COLOR[aud.estado] ?? "bg-gray-50 text-gray-600 border-gray-200"
              )}
              title={`${TIPO_AUD_LABEL[aud.tipo] ?? aud.tipo} · ${aud.estado}`}
            >
              <Mic className="w-3 h-3" />
              {TIPO_AUD_LABEL[aud.tipo] ?? aud.tipo}
              {aud.fecha_hora && (
                <span className="opacity-70">· <ClientDate iso={aud.fecha_hora} mode="date" /></span>
              )}
            </Link>
          ))}
          <Link
            href={`/casos/${caseId}/audiencia`}
            className="inline-flex items-center justify-center w-6 h-6 rounded-full border-2 border-dashed border-[#1B4F9B]/40 text-[#1B4F9B] hover:bg-[#1B4F9B]/10 transition-colors"
            title="Programar nueva audiencia"
          >
            +
          </Link>
        </div>
      </div>
```

> `Mic` y `ClientDate` ya están importados en el archivo (líneas ~11 y ~19). `Link` y `clsx` también (tras Task 4 / ya presente).

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 4: Verificación manual en dev**

- En un caso con varias audiencias, bajo el timeline aparece "Audiencias:" con un chip por cada una (tipo + fecha), coloreado por estado.
- El chip "+" lleva a `/casos/<id>/audiencia` (programar nueva / continuación).
- Un chip lleva a Audiencia > Asistencia.
- En un caso sin audiencias, muestra "Ninguna programada" + el chip "+".

- [ ] **Step 5: Commit**

```bash
git add src/components/modules/casos/CasoTimeline.tsx
git commit -m "feat(timeline): chips por cada audiencia + botón + para programar continuación"
```

---

## Task 6: Actualizar enlaces `?tab=` viejos en el resto del código

**Files:**
- Modify: `src/components/modules/expediente/TabAsistencia.tsx`
- Modify: `src/app/(staff)/dashboard/page.tsx`
- Modify: `src/components/modules/apoderados/ApoderadoHistorial.tsx`

Contexto: la redirección de Task 2 ya cubre estos enlaces en runtime, pero los actualizamos para evitar el salto y mantener consistencia.

- [ ] **Step 1: Actualizar los enlaces**

Reemplaza exactamente:

- `src/components/modules/expediente/TabAsistencia.tsx:268` → `?tab=documentos` por `?tab=documentos&sub=soportes`
- `src/components/modules/expediente/TabAsistencia.tsx:581` → `?tab=acta` por `?tab=audiencia&sub=acta`
- `src/app/(staff)/dashboard/page.tsx:407` → `?tab=poderes` por `?tab=documentos&sub=poderes`
- `src/app/(staff)/dashboard/page.tsx:420` → `?tab=admision` por `?tab=documentos&sub=admision`
- `src/app/(staff)/dashboard/page.tsx:681` → `?tab=poderes` por `?tab=documentos&sub=poderes`
- `src/app/(staff)/dashboard/page.tsx:698` → `?tab=poderes` por `?tab=documentos&sub=poderes`
- `src/app/(staff)/dashboard/page.tsx:703` → `?tab=admision` por `?tab=documentos&sub=admision`
- `src/components/modules/apoderados/ApoderadoHistorial.tsx:115` → `?tab=poderes` por `?tab=documentos&sub=poderes`

(Usa Grep `tab=(admision|poderes|asistencia|acta|acreencias|documentos|procesos)` para reconfirmar que no quedó ninguno sin migrar; las líneas pueden haberse desplazado.)

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 3: Verificación manual en dev**

- Desde el dashboard, los enlaces de "checklist de admisión incompleta" y "cambio de apoderado" abren la sub-pestaña correcta directamente.
- En Asistencia, el enlace a documentos y el botón que iba a `?tab=acta` abren la sub-pestaña correcta.

- [ ] **Step 4: Commit**

```bash
git add src/components/modules/expediente/TabAsistencia.tsx src/app/\(staff\)/dashboard/page.tsx src/components/modules/apoderados/ApoderadoHistorial.tsx
git commit -m "refactor(enlaces): migrar enlaces ?tab= viejos al formato tab+sub"
```

---

## Task 7: Build final de verificación

- [ ] **Step 1: Build completo**

Run: `npm run build`
Expected: build exitoso (Next.js corre typecheck en build). Si falla por typecheck, corregir antes de continuar.

- [ ] **Step 2: Regresión de enlaces**

Run: `grep -rn "tab=admision\|tab=poderes\|tab=asistencia\|tab=acta\|tab=acreencias\|tab=documentos" src --include=*.tsx --include=*.ts`
Expected: solo aparecen en `REDIRECT_TAB` (page.tsx) y en los enlaces ya migrados con `&sub=`. Ningún `?tab=<clave vieja>` suelto sin `&sub=`.

- [ ] **Step 3: Commit (si hubo correcciones)**

```bash
git add -A
git commit -m "chore(expediente): correcciones de build final flujo de audiencias"
```

---

## Cobertura del spec (self-review)

- §4.A (4 pestañas + sub-pestañas) → Tasks 1, 2 ✅
- §4.A (orden Asistencia→Acreencias→Acta) → Task 2 Step 3/6 ✅
- §4.A (redirección de claves viejas) → Task 2 Step 1-2; Task 6 ✅
- §4.A (mover "Observaciones" a Audiencia) → Task 2 Step 6/7 ✅
- §4.B (importar obligación conciliada) → Task 3 ✅
- §4.C (timeline navega) → Task 4 ✅
- §8.1 (mover etapa al modal) → Task 4 Step 4-5 ✅
- §8.2 (Citación→Documentos/Soportes) → Task 4 Step 1 (`STEP_HREF.citacion`) ✅
- §8.3 (Procesos como 4ª pestaña) → Task 2 Step 1 (`TOP_TABS`) ✅
- §4.D (chips multi-audiencia + "+") → Task 5 ✅
- §5 (sin cambios de BD) → ninguna task toca migraciones ✅
- §3 No-objetivos (motor de autos, unificar tablas) → no incluidos ✅
