-- supabase/migrations/018_clausulas_acta_enriquecidas.sql
-- Seed adicional de cláusulas globales basado en actas reales de Corprojusticia:
-- conciliación presencial/virtual, acuerdos de apoyo (Ley 1996/2019), constancia de no suscripción.
-- Agrega vocabulario específico de acuerdos de apoyo (titular, apoyo, relación de confianza)
-- y patrones jurídicos colombianos (modificación de contrato, SICAAC, cosa juzgada completa).

-- ═══════════════════════════════════════════════════════════════════════════
-- CONCILIACIÓN — Preámbulos por modalidad, apoderado, hechos, modificación, cierre
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000200',
  NULL,
  'Preámbulo — Conciliación VIRTUAL (Zoom, Meet, Teams)',
  'preambulo',
  'conciliacion',
  NULL,
  $CLAUSE$En {{centro.ciudad}}, siendo las [HORA EN LETRAS] ([HORA EN NÚMEROS]) del [DÍA EN LETRAS] ([DÍA EN NÚMEROS]) de [MES EN LETRAS] del año [AÑO EN LETRAS] ({{fecha.hoy}}), por medio de la plataforma [ZOOM / MEET / TEAMS], ante el {{centro.nombre}}, el Conciliador {{conciliador.nombre}}, identificado(a) con cédula de ciudadanía No. {{conciliador.doc}}, tarjeta profesional No. {{conciliador.tarjeta}} del Consejo Superior de la Judicatura, y con código interno [CÓDIGO INTERNO], fue facultado para llevar a cabo la audiencia de conciliación, y, firmar la presente acta. A esta, los presentes se identificaron de la siguiente manera:$CLAUSE$,
  ARRAY['preambulo', 'conciliacion', 'virtual', 'zoom'],
  TRUE,
  TRUE
);

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000201',
  NULL,
  'Preámbulo — Conciliación PRESENCIAL',
  'preambulo',
  'conciliacion',
  NULL,
  $CLAUSE$En {{centro.ciudad}}, siendo las [HORA EN LETRAS] ([HORA EN NÚMEROS]) del [DÍA EN LETRAS] ([DÍA EN NÚMEROS]) de [MES EN LETRAS] del año [AÑO EN LETRAS] ({{fecha.hoy}}), en las instalaciones del {{centro.nombre}}, ubicado en {{centro.direccion}}, habilitado mediante {{centro.resolucion}}, el Conciliador {{conciliador.nombre}}, identificado(a) con cédula de ciudadanía No. {{conciliador.doc}}, tarjeta profesional No. {{conciliador.tarjeta}} del Consejo Superior de la Judicatura, y con código interno [CÓDIGO INTERNO], fue facultado para llevar a cabo la audiencia de conciliación, y, firmar la presente acta. A esta, los presentes se identificaron de la siguiente manera:$CLAUSE$,
  ARRAY['preambulo', 'conciliacion', 'presencial'],
  TRUE,
  TRUE
);

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000202',
  NULL,
  'Identificación — Apoderado con personería reconocida',
  'identificacion_partes',
  NULL,
  NULL,
  $CLAUSE$APODERADO(A): [NOMBRE COMPLETO], identificado(a) con cédula de ciudadanía No. [CÉDULA] de [CIUDAD EXPEDICIÓN], y Tarjeta Profesional de abogado(a) No. [NÚMERO TP] del Consejo Superior de la Judicatura, obrando como apoderado(a) especial de [NOMBRE REPRESENTADO], conforme a poder debidamente otorgado. Dirección: [DIRECCIÓN], teléfono [TELÉFONO], correo electrónico [CORREO]. Personería reconocida en audiencia.$CLAUSE$,
  ARRAY['identificacion', 'apoderado', 'tarjeta-profesional'],
  TRUE,
  TRUE
);

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000203',
  NULL,
  'HECHOS — Estructura base (pretensiones del convocante)',
  'consideraciones',
  'conciliacion',
  NULL,
  $CLAUSE$HECHOS:

PRIMERO: [Describir el primer hecho o pretensión principal].

SEGUNDO: [Describir el segundo hecho o pretensión].

TERCERO: [Describir el tercer hecho o pretensión].

[CONTINUAR CON LOS DEMÁS HECHOS EN ORDEN ORDINAL: CUARTO, QUINTO, SEXTO, SÉPTIMO... DÉCIMO PRIMERO, DÉCIMO SEGUNDO, etc.]

ÚLTIMO: [Hecho de cierre o pretensión general si aplica].$CLAUSE$,
  ARRAY['hechos', 'pretensiones', 'estructura', 'ordinales'],
  TRUE,
  TRUE
);

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000204',
  NULL,
  'Acuerdo — Modificación de contrato previo',
  'obligacion_hacer',
  NULL,
  ARRAY['acuerdo_total', 'acuerdo_parcial'],
  $CLAUSE$MODIFICACIÓN DE CONTRATO PREVIO: Modificar la cláusula [NÚMERO ORDINAL DE LA CLÁUSULA] del contrato de [TIPO DE CONTRATO] suscrito entre las partes el día [FECHA DEL CONTRATO], la cual se dejará sin ningún efecto jurídico alguno y en su lugar se reemplaza con la siguiente cláusula:

"[NOMBRE DE LA NUEVA CLÁUSULA, EJ. SEXTA]: [TEXTO COMPLETO DE LA NUEVA CLÁUSULA]

Parágrafo primero: [CONDICIÓN O SUBREGLA APLICABLE, si corresponde].

Parágrafo segundo: [CONDICIÓN ADICIONAL, si corresponde]."$CLAUSE$,
  ARRAY['acuerdo', 'modificacion-contrato', 'paragrafos'],
  TRUE,
  TRUE
);

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000205',
  NULL,
  'Canales de comunicación entre las partes',
  'domicilio_notificaciones',
  NULL,
  ARRAY['acuerdo_total', 'acuerdo_parcial'],
  $CLAUSE$CANALES DE COMUNICACIÓN: Las partes acuerdan establecer como canales de comunicación, en el siguiente orden de prelación:

1. Chat de WhatsApp (el cual podrá ser realizado por intermedio de sus apoderados y sus teléfonos de contacto).
2. Correo electrónico registrado en la presente acta.
3. Por intermedio de cada uno de sus apoderados.

Los temas a tratar serán todos aquellos que tengan que ver con la ejecución del presente acuerdo, y en general cualquier otro tema que les competa tratar y decidir en conjunto. Cualquier cambio de número telefónico o correo electrónico deberá ser informado por escrito a la contraparte dentro de los cinco (5) días hábiles siguientes.$CLAUSE$,
  ARRAY['comunicacion', 'whatsapp', 'email', 'acuerdo'],
  TRUE,
  TRUE
);

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000206',
  NULL,
  'Cierre completo — Conciliación con acuerdo (SICAAC + primera copia)',
  'cierre',
  'conciliacion',
  ARRAY['acuerdo_total', 'acuerdo_parcial'],
  $CLAUSE$La presente CONCILIACIÓN ES DECLARATIVA, HACE TRÁNSITO A COSA JUZGADA EN LO CIVIL, deja sin efectos cualquier convenio verbal o escrito celebrado con anterioridad entre las partes y sobre el mismo objeto en relación con lo que exclusivamente se concilió, y PRESTA MÉRITO EJECUTIVO, de conformidad con las disposiciones legales que regulan la materia, quedando de este modo definitivamente terminada la diferencia que la originó.

Leído el contenido de la presente ACTA, es APROBADA en todas sus partes y los asistentes autorizan al conciliador para que la suscriba y la reporte al sistema SICAAC del Ministerio de Justicia y el Derecho, dejando el original para el archivo del CENTRO DE CONCILIACIÓN.

A las partes se les hace entrega de una primera copia que presta mérito ejecutivo.$CLAUSE$,
  ARRAY['cierre', 'cosa-juzgada', 'merito-ejecutivo', 'sicaac', 'primera-copia'],
  TRUE,
  TRUE
);

-- ═══════════════════════════════════════════════════════════════════════════
-- ACUERDOS DE APOYO (Ley 1996 de 2019) — vocabulario titular/apoyo
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000210',
  NULL,
  'Preámbulo — Acuerdo de apoyo VIRTUAL',
  'preambulo',
  'acuerdo_apoyo',
  NULL,
  $CLAUSE$Previa citación notificada el día [FECHA CITACIÓN EN LETRAS] ({{caso.fecha_limite_citacion}}), {{conciliador.nombre}}, obrando en calidad de CONCILIADOR, debidamente autorizado por el Ministerio de Justicia y del Derecho, declara abierta la presente audiencia, celebrada el día [FECHA EN LETRAS] ({{caso.fecha_audiencia}}) a las [HORA EN LETRAS] ([HORA EN NÚMEROS]) por medio de la plataforma [ZOOM / MEET / TEAMS], ante el {{centro.nombre}}, y manifiesta que comparecieron ante el centro las siguientes personas:$CLAUSE$,
  ARRAY['preambulo', 'acuerdo-apoyo', 'virtual', 'ley-1996'],
  TRUE,
  TRUE
);

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000211',
  NULL,
  'Preámbulo — Acuerdo de apoyo PRESENCIAL',
  'preambulo',
  'acuerdo_apoyo',
  NULL,
  $CLAUSE$Previa citación notificada el día [FECHA CITACIÓN EN LETRAS] ({{caso.fecha_limite_citacion}}), {{conciliador.nombre}}, obrando en calidad de CONCILIADOR, debidamente autorizado por el Ministerio de Justicia y del Derecho, declara abierta la presente audiencia, celebrada el día [FECHA EN LETRAS] ({{caso.fecha_audiencia}}) a las [HORA EN LETRAS] ([HORA EN NÚMEROS]) presencialmente en las instalaciones del {{centro.nombre}}, ubicado en {{centro.direccion}}, y manifiesta que comparecieron ante el centro las siguientes personas:$CLAUSE$,
  ARRAY['preambulo', 'acuerdo-apoyo', 'presencial', 'ley-1996'],
  TRUE,
  TRUE
);

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000212',
  NULL,
  'Identificación — Titular del acto jurídico',
  'identificacion_partes',
  'acuerdo_apoyo',
  NULL,
  $CLAUSE$TITULAR DEL ACTO JURÍDICO: {{convocante.nombre}}, identificado(a) con cédula de ciudadanía No. {{convocante.doc}} de [CIUDAD DE EXPEDICIÓN], con número de contacto {{convocante.telefono}}, correo electrónico {{convocante.email}} y dirección {{convocante.direccion}}.

PERSONA(S) DESIGNADA(S) COMO APOYO Y RELACIÓN DE CONFIANZA:
[NOMBRE COMPLETO DEL APOYO], identificado(a) con cédula de ciudadanía No. [CÉDULA] de [CIUDAD], [Y TARJETA PROFESIONAL No. XXXX del C.S. de la J. — si es abogado], con número de contacto [TELÉFONO] y correo electrónico [CORREO].$CLAUSE$,
  ARRAY['identificacion', 'titular', 'apoyo', 'acuerdo-apoyo'],
  TRUE,
  TRUE
);

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000213',
  NULL,
  'Acuerdo de apoyo — Relación de confianza y autonomía',
  'apoyo_decision',
  'acuerdo_apoyo',
  ARRAY['acuerdo_total'],
  $CLAUSE$AUTONOMÍA DEL TITULAR: Surtida la audiencia privada, es claro para este conciliador que el(la) Titular del acto jurídico participó de forma autónoma, sin ningún vicio en su consentimiento (es decir, sin error, fuerza o dolo), y que así mismo comprende el escenario y los efectos jurídicos de los acuerdos de apoyo. Por lo tanto, es procedente la suscripción del mismo.

RELACIÓN DE CONFIANZA: Este conciliador observa que entre el(la) Apoyo y el(la) Titular de los actos jurídicos existe relación de confianza, por el [TIPO DE VÍNCULO, ej.: grado de consanguinidad Padre/Madre-Hijo(a), hermano(a), amistad, persona de confianza], toda vez que quien se designará como apoyo previamente ha venido realizando estas gestiones, y en especial por la manifestación expresa de confianza efectuada en la entrevista privada.$CLAUSE$,
  ARRAY['autonomia', 'relacion-confianza', 'ley-1996', 'vicios-consentimiento'],
  TRUE,
  TRUE
);

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000214',
  NULL,
  'Acuerdo de apoyo — Obligaciones del apoyo (Art. 46 Ley 1996)',
  'apoyo_decision',
  'acuerdo_apoyo',
  ARRAY['acuerdo_total'],
  $CLAUSE$OBLIGACIONES DE LA PERSONA DE APOYO: El conciliador expuso al Apoyo las obligaciones consagradas en el ARTÍCULO 46 de la Ley 1996 de 2019, así:

"Las personas de apoyo tienen las siguientes obligaciones:

1. Actuar de acuerdo con la voluntad y preferencias de la persona titular del acto jurídico.
2. Abstenerse de realizar actos que contraríen o afecten los derechos, la voluntad o las preferencias del titular.
3. Rendir cuentas periódicas al titular sobre la gestión efectuada.
4. Mantener la confidencialidad sobre los actos realizados en virtud del acuerdo.
5. Abstenerse de obtener provecho indebido del ejercicio del apoyo.
6. Comunicar al titular cualquier conflicto de intereses que pueda surgir."

El(la) Apoyo manifiesta expresamente conocer y aceptar las obligaciones aquí consagradas.$CLAUSE$,
  ARRAY['obligaciones', 'art-46', 'ley-1996', 'apoyo'],
  TRUE,
  TRUE
);

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000215',
  NULL,
  'Acuerdo de apoyo — Salvaguarda de rendición semestral',
  'apoyo_decision',
  'acuerdo_apoyo',
  ARRAY['acuerdo_total'],
  $CLAUSE$SALVAGUARDA — RENDICIÓN DE CUENTAS: Acuerdan las partes dejar como salvaguarda que cada seis (6) meses, contados a partir de la suscripción del presente acuerdo de apoyo, el(la) Apoyo entregará al(la) Titular del acto jurídico un documento escrito en el que se informe sobre la administración de los recursos y la gestión de los trámites efectuados en virtud del presente acuerdo, de haberlos, de conformidad con el artículo 11 de la Ley 1996 de 2019.$CLAUSE$,
  ARRAY['salvaguarda', 'rendicion-cuentas', 'art-11', 'ley-1996'],
  TRUE,
  TRUE
);

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000216',
  NULL,
  'Acuerdo de apoyo — Vigencia y revocabilidad',
  'apoyo_decision',
  'acuerdo_apoyo',
  ARRAY['acuerdo_total'],
  $CLAUSE$VIGENCIA: El presente acuerdo tendrá una vigencia de [PLAZO EN LETRAS] ([PLAZO EN NÚMEROS]) años, contados a partir de la suscripción del presente acuerdo, sin superar el máximo de cinco (5) años previsto en la Ley 1996 de 2019. Podrá renovarse por voluntad expresa del(la) Titular.

REVOCABILIDAD: El(la) Apoyo y el(la) Titular de los actos jurídicos manifiestan que, en el evento de querer dar por terminada la designación o modificar el presente acuerdo de apoyo, lo manifestarán por escrito mediante mensaje de WhatsApp o correo electrónico a los canales registrados en la presente acta. El(la) Titular podrá revocar el acuerdo en cualquier momento sin expresar causa.$CLAUSE$,
  ARRAY['vigencia', 'revocabilidad', 'whatsapp', 'ley-1996'],
  TRUE,
  TRUE
);

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000217',
  NULL,
  'Cierre — Acuerdo de apoyo (aceptación íntegra y firma)',
  'cierre',
  'acuerdo_apoyo',
  ARRAY['acuerdo_total'],
  $CLAUSE$LECTURA Y APROBACIÓN: Leído el presente instrumento por los comparecientes, estos estuvieron de acuerdo con él, lo aceptaron íntegramente en la forma en que se encuentra redactado y, en señal de aprobación, dan su aval en la audiencia y firman.

El conciliador dispone el archivo del original en el Centro de Conciliación y la entrega de copia al(la) Titular y al(la) Apoyo.$CLAUSE$,
  ARRAY['cierre', 'aceptacion-integra', 'acuerdo-apoyo'],
  TRUE,
  TRUE
);

-- ═══════════════════════════════════════════════════════════════════════════
-- CONSTANCIA DE NO SUSCRIPCIÓN (acuerdo de apoyo)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000218',
  NULL,
  'Constancia — No suscripción del acuerdo de apoyo',
  'apoyo_decision',
  'acuerdo_apoyo',
  ARRAY['no_acuerdo'],
  $CLAUSE$CONSTANCIA DE NO SUSCRIPCIÓN DEL ACUERDO DE APOYO:

La solicitud de acuerdo de apoyo No. {{caso.radicado}} fue radicada ante el Centro de Conciliación el día [FECHA EN LETRAS] ({{caso.fecha_solicitud}}), en la cual se identifica como Titular del acto jurídico al(la) señor(a) {{convocante.nombre}}, identificado(a) con cédula de ciudadanía No. {{convocante.doc}}, y como persona designada como apoyo a [NOMBRE COMPLETO DEL APOYO PROPUESTO], identificado(a) con cédula de ciudadanía No. [CÉDULA], quien es [VÍNCULO: hermano(a), hijo(a), amigo(a), etc.] del(la) Titular.

Fue programada la audiencia privada para el día [FECHA EN LETRAS] ({{caso.fecha_audiencia}}) a las [HORA], fecha y hora a la cual asistieron las partes. Una vez instaurada la audiencia privada entre el suscrito conciliador y la persona Titular del acto jurídico, este observa que:

[DESCRIBIR LAS RAZONES OBSERVADAS, EJ.: "No fue posible establecer el canal de comunicación necesario para que el suscrito lograra concluir la autonomía y comprensión necesaria por parte del(la) Titular para la formalización del acuerdo de apoyo"].

Luego de realizada la sesión, a criterio del suscrito no es dable la suscripción del acuerdo de apoyo solicitado.

En virtud de lo anterior, RESUELVE el suscrito conciliador NO SUSCRIBIR el acuerdo de apoyo solicitado, y dispone el archivo del expediente.$CLAUSE$,
  ARRAY['constancia', 'no-suscripcion', 'acuerdo-apoyo', 'archivo'],
  TRUE,
  TRUE
);

-- ═══════════════════════════════════════════════════════════════════════════
-- GENÉRICAS — Cláusula penal específica, vigencia
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000220',
  NULL,
  'Cláusula penal — Monto específico (letras + números)',
  'clausula_penal',
  NULL,
  ARRAY['acuerdo_total', 'acuerdo_parcial'],
  $CLAUSE$CLÁUSULA PENAL: En caso de incumplimiento total o parcial de cualquiera de las obligaciones pactadas, la parte incumplida pagará a la parte cumplida, a título de pena, la suma de [MONTO EN LETRAS] pesos m/cte. ($[MONTO EN NÚMEROS]), sin perjuicio del cumplimiento de la obligación principal y del pago de intereses moratorios a la máxima tasa legal permitida.

Esta pena constituye estimación anticipada de perjuicios, no requiere prueba del daño y se hará exigible mediante el solo requerimiento escrito de la parte cumplida.$CLAUSE$,
  ARRAY['clausula-penal', 'monto-especifico', 'pena'],
  TRUE,
  TRUE
);

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000221',
  NULL,
  'Vigencia del acuerdo',
  'otro',
  NULL,
  ARRAY['acuerdo_total', 'acuerdo_parcial'],
  $CLAUSE$VIGENCIA: El presente acuerdo entrará en vigencia a partir de la fecha de suscripción y conservará sus efectos hasta el total cumplimiento de las obligaciones aquí contenidas. Su incumplimiento parcial o total activará las consecuencias previstas en la cláusula penal y en los demás mecanismos pactados, sin perjuicio del mérito ejecutivo que preste la presente acta.$CLAUSE$,
  ARRAY['vigencia', 'cumplimiento'],
  TRUE,
  TRUE
);

-- ═══════════════════════════════════════════════════════════════════════════
-- Actualizar variables_requeridas de las cláusulas nuevas
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE sgcc_clausulas
SET variables_requeridas = (
  SELECT COALESCE(jsonb_agg(DISTINCT match[1]), '[]'::jsonb)
  FROM regexp_matches(contenido, '\{\{([^}]+)\}\}', 'g') AS match
)
WHERE center_id IS NULL
  AND id IN (
    '10000000-0000-0000-0000-000000000200',
    '10000000-0000-0000-0000-000000000201',
    '10000000-0000-0000-0000-000000000202',
    '10000000-0000-0000-0000-000000000203',
    '10000000-0000-0000-0000-000000000204',
    '10000000-0000-0000-0000-000000000205',
    '10000000-0000-0000-0000-000000000206',
    '10000000-0000-0000-0000-000000000210',
    '10000000-0000-0000-0000-000000000211',
    '10000000-0000-0000-0000-000000000212',
    '10000000-0000-0000-0000-000000000213',
    '10000000-0000-0000-0000-000000000214',
    '10000000-0000-0000-0000-000000000215',
    '10000000-0000-0000-0000-000000000216',
    '10000000-0000-0000-0000-000000000217',
    '10000000-0000-0000-0000-000000000218',
    '10000000-0000-0000-0000-000000000220',
    '10000000-0000-0000-0000-000000000221'
  );
