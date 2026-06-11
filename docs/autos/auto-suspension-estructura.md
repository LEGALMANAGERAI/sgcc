# Auto de Suspensión y Reprogramación (Art. 551 CGP) — estructura y texto literal

Referencia para `generar-auto-suspension.ts`. Basado en los autos reales de Tejido Humano (minutas 08 y 09). El **texto fijo va verbatim** (no parafrasear). Los `{{...}}` son variables que vienen de `ResolvedAutoVars` / `AutoSuspensionOpciones`.

## Orden de secciones
1. Membrete (todas las páginas) · 2. Ciudad y fecha · 3. Título · 4. Identificación · 5. Párrafo de apertura · 6. I. Verificación del quórum (tabla) · 7. II. Consideraciones · 8. (opcional) Tabla de acreencias · 9. Motivo de suspensión + frase puente · 10. III. RESUELVE · 11. Firmas · 12. Pie VIGILADO (todas las páginas).

## 1. Membrete (FIJO, con variables del centro; va arriba en cada página)
Logo del centro a la izquierda ({{centro.logo_url}} si existe), y a la derecha:
```
{{centro.nombre}}
{{centro.resolucion_habilitacion}}
{{centro.resolucion_insolvencia}} Ministerio de Justicia – Código {{centro.codigo_ministerio}}
{{centro.direccion}}
Teléfono {{centro.telefono}} {{centro.email_radicacion}} y {{centro.email_secretaria}}
```

## 2. Ciudad y fecha (VARIABLE)
`{{centro.ciudad}}, {{opciones.fecha_audiencia_texto}}.`

## 3. Título (FIJO + número)
```
AUTO No. {{opciones.numero_auto}}
SUSPENSIÓN Y REPROGRAMACIÓN
```
(centrado, negrita)

## 4. Identificación (etiquetas FIJAS)
```
Radicado: {{caso.radicado}}
Deudor: {{deudor.nombre}} {{deudor.tipo_doc}} No. {{deudor.documento}}
Asunto: Auto de suspensión y reprogramación (Art. 551 C.G.P)
```

## 5. Párrafo de apertura (FIJO con huecos) — VERBATIM
```
El {{opciones.fecha_audiencia_texto}}, siendo {{opciones.hora_audiencia_texto}} ({{opciones.hora_audiencia_corta}}), se da inicio a la audiencia de negociación de pasivos del proceso de referencia, admitido mediante Auto No. {{caso.numero_auto_admisorio}} del {{caso.fecha_auto_admisorio}}, se procede con las siguientes actividades las cuales se desarrollan de manera virtual mediante (LINK AUDIENCIA DE CONCILIACIÓN Join Zoom Meeting {{opciones.zoom_apertura_url}} ID de reunión: {{opciones.zoom_apertura_id}} Código de acceso: {{opciones.zoom_apertura_codigo}}), en atención a implementar las tecnologías de la información y las comunicaciones en las actuaciones judiciales según la LEY 2213 DE 2022.
```

## 6. I. Verificación del quórum (FIJO + tabla)
```
I.    VERIFICACION DEL QUORUM

Registrada la asistencia se encuentran las siguientes personas:
```
**Tabla** (2 columnas: `ACREEDORES` | `APODERADO/REPRESENTANTE LEGAL`), **agrupada por clase de crédito** (fila separadora a todo el ancho con la clase en negrita centrada antes de los acreedores de esa clase). Se construye desde `opciones.quorum`.
- Celda izquierda: `{{nombre}}` / `NIT/C.C. No.: {{documento}}` / `Email: {{email}}` / `Teléfono: {{telefono}}` / `Dirección: {{direccion}}` / **`{{PRESENTE|AUSENTE}}`** (negrita).
- Celda derecha (si hay apoderado): `Apoderado: {{apoderado_nombre}}` / `C.C. No.: {{apoderado_cedula}}` / `T.P. No.: {{apoderado_tp}} del C.S de la J.` / `Email: {{apoderado_email}}` / `Teléfono: {{apoderado_telefono}}` / `Dirección: {{apoderado_direccion}}` / **`{{PRESENTE|AUSENTE}}`**. Si no hay apoderado, solo el estado.
- **Última fila = DEUDOR** (es_deudor=true): celda izquierda titulada **DEUDOR**, derecha titulada **APODERADO** con los datos de `deudor.apoderado`.

## 7. II. Consideraciones (intro FIJA + numeral 1 FIJO + libres)
```
II.    CONSIDERACIONES

Una vez instalada la audiencia se presenta lo siguiente:
```
**Numeral 1 (FIJO verbatim, SIEMPRE):**
```
1) Verificado el quórum reglamentario, el suscrito operador procede a dejar constancia de que la convocatoria fue realizada en debida forma, conforme a los términos previstos por la normativa aplicable. Así mismo, se hace constar que la fecha y hora de inicio del presente procedimiento transcurren sin que se advierta irregularidad alguna.
```
**Numerales siguientes:** numerar 2, 3, 4… combinando, EN ORDEN: primero los `BLOQUES_ESTANDAR` cuyo id esté en `opciones.bloques_estandar` (su `texto`), luego cada string de `opciones.considerandos` (texto libre del operador). Cada uno como numeral propio `N) ...`.

## 8. Tabla de acreencias (OPCIONAL — solo si `opciones.incluir_tabla_acreencias`)
Va justo después del numeral que la anuncia (bloque estándar `relacion_acreencias`). Columnas:
`# | Acreedor | Clase | Capital | Int. corr. | Int. mora | Seguros | Otros | Total | % Voto | Peq.`
Filas desde `acreedores` (montos conciliados). Fila final de **TOTALES** (suma de columnas; % Voto = 100,00%). Formatear montos en pesos.

## 9. Motivo + frase puente (motivo VARIABLE, frase FIJA)
```
{{N}}) {{opciones.motivo_suspension}}

En virtud de lo anterior, se han tomado las siguientes decisiones:

III.    RESUELVE:
```
(el motivo es el último numeral de consideraciones; si está vacío, omitir ese numeral pero dejar la frase puente)

## 10. III. RESUELVE (FÓRMULA FIJA con huecos) — VERBATIM
```
PRIMERO. SUSPENDER la audiencia y fijar como fecha de continuación el día {{opciones.continuacion_fecha}} a las {{opciones.continuacion_hora}}, para llevar a cabo la continuación de la audiencia de negociación de deudas contemplada en el artículo 550 del C.G.P., de manera virtual a través Del link {{opciones.continuacion_zoom_url}} Código de Acceso: {{opciones.continuacion_zoom_codigo}}.

SEGUNDO: Los presentes quedan notificados en audiencia.
```
(NOTA: el título es Art. 551 pero el RESUELVE cita Art. 550 — así está en los originales, dejarlo igual.)

## 11. Firmas
Operador (con espacio para firma escaneada {{operador}} si firma_url existe):
```
{{operador.nombre}}
{{operador.cargo}}
C.C. No. {{operador.cedula}} de {{operador.ciudad_cedula}}
T.P. No. {{operador.tarjeta_profesional}} del C.S. de la J.
```
Apoderado del deudor (si existe), centrado:
```
{{deudor.apoderado.nombre}}
C. C. {{deudor.apoderado.cedula}}
T.P. {{deudor.apoderado.tarjeta_profesional}} del C.S. de la J.
```

## 12. Pie de página (FIJO, todas las páginas)
`{{centro.pie_vigilado}}`  ("VIGILADO..." en negrita)
