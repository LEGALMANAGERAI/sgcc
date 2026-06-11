# Auto de Primera Audiencia (firmeza del admisorio) — estructura

NO existe un PDF fijo: es lo que ocurre en la 1ª audiencia. Reusa el ESQUELETO del auto de suspensión (membrete, ciudad/fecha, identificación, apertura, quórum, considerandos, firmas, pie — ver `auto-suspension-estructura.md`). Lo PROPIO de este auto es el cierre (firmeza o reparos). **El RESUELVE está construido desde la lógica descrita por el usuario → VALIDAR EN AUDIENCIA PILOTO.**

## Lógica del usuario
En la 1ª audiencia: se ilustra a las partes (alcance/objeto/límites). Si no hay dudas → se pregunta si hay **reparos al auto admisorio**:
- **No hay reparos** → el auto admisorio **queda en firme**.
- **Sí hay reparos** → se exponen, se concilian o el operador **decide**; sobre esa decisión cabe **recurso de reposición**.

## Diferencias vs el auto de suspensión
1. **Título:** `AUTO No. {{numero}}` / `PRIMERA AUDIENCIA` (o "AUDIENCIA DE NEGOCIACIÓN DE DEUDAS").
2. **Asunto:** `Auto de primera audiencia de negociación de deudas (Art. 550 C.G.P)`.
3. **Considerandos:** usar `BLOQUES_ESTANDAR` por defecto: `ilustracion`, `reparos_admisorio`, `expediente_digital`, `reconocimiento_personeria` (ya incluyen la consulta de reparos). + considerandos libres.
4. **Toggle condicional `hubo_reparos` (sí/no)** → cambia el RESUELVE.
5. **NO** lleva fecha de continuación (no suspende). (Si la audiencia continúa otro día, eso es el auto de suspensión.)

## RESUELVE (condicional) — CONSTRUIDO, validar en piloto

### Si NO hubo reparos (`hubo_reparos = false`):
```
RESUELVE:

PRIMERO. DEJAR EN FIRME el Auto No. {{caso.numero_auto_admisorio}} del {{caso.fecha_auto_admisorio}}, mediante el cual se admitió el procedimiento de negociación de deudas, así como lo actuado hasta el momento, al no haberse presentado reparo jurídico alguno por los intervinientes.

SEGUNDO. Los presentes quedan notificados en audiencia.
```

### Si SÍ hubo reparos (`hubo_reparos = true`):
```
RESUELVE:

PRIMERO. {{decision_operador}}   ← texto libre: la decisión que toma el operador sobre los reparos planteados.

SEGUNDO. Contra la presente decisión procede el recurso de reposición, el cual deberá interponerse y sustentarse en la misma audiencia.

TERCERO. Los presentes quedan notificados en audiencia.
```
Campos en vivo cuando hay reparos: `{{reparos_descripcion}}` (qué reparos se plantearon — va como numeral de considerandos) y `{{decision_operador}}`.

## Opciones del formulario (AutoPrimeraAudienciaOpciones)
Igual que suspensión PERO: sin `continuacion_*`; con `hubo_reparos: boolean`, `reparos_descripcion: string`, `decision_operador: string`. Mantiene: numero_auto, datos de apertura (fecha/hora/zoom), considerandos + bloques_estandar, incluir_tabla_acreencias, quorum.
