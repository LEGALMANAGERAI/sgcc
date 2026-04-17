-- supabase/migrations/017_seed_clausulas_globales.sql
-- Seed inicial de cláusulas globales del sistema (center_id IS NULL, es_default TRUE).
-- Cubren los 3 trámites (conciliación, insolvencia, acuerdos de apoyo) y los resultados típicos.
-- Los centros no pueden editarlas directamente; deben duplicarlas para personalizar.

-- ─── PREÁMBULOS ────────────────────────────────────────────────────────────

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  NULL,
  'Preámbulo estándar — Conciliación extrajudicial en derecho',
  'preambulo',
  'conciliacion',
  NULL,
  $CLAUSE$En la ciudad de {{centro.ciudad}}, siendo las [HORA] del día {{fecha.hoy}}, en las instalaciones del {{centro.nombre}}, ubicado en {{centro.direccion}}, habilitado mediante {{centro.resolucion}}, se reunieron las partes citadas dentro del trámite de conciliación extrajudicial en derecho identificado con el radicado No. {{caso.radicado}}, con el fin de intentar una solución autocompositiva del conflicto, en los términos de la Ley 640 de 2001 y demás normas concordantes.$CLAUSE$,
  ARRAY['preambulo', 'apertura', 'ley-640'],
  TRUE,
  TRUE
);

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000002',
  NULL,
  'Preámbulo estándar — Insolvencia de persona natural no comerciante',
  'preambulo',
  'insolvencia',
  NULL,
  $CLAUSE$En la ciudad de {{centro.ciudad}}, siendo las [HORA] del día {{fecha.hoy}}, en las instalaciones del {{centro.nombre}}, ubicado en {{centro.direccion}}, habilitado mediante {{centro.resolucion}}, se adelantó la audiencia correspondiente al trámite de insolvencia de persona natural no comerciante identificado con el radicado No. {{caso.radicado}}, promovido por {{convocante.nombre}}, identificado(a) con {{convocante.doc}}, con el fin de procurar la negociación de un acuerdo de pago con sus acreedores, de conformidad con el Título IV, Sección Tercera del Código General del Proceso (Ley 1564 de 2012) y el Decreto 2677 de 2012.$CLAUSE$,
  ARRAY['preambulo', 'apertura', 'insolvencia', 'ley-1564'],
  TRUE,
  TRUE
);

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000003',
  NULL,
  'Preámbulo estándar — Acuerdos de apoyo (Ley 1996 de 2019)',
  'preambulo',
  'acuerdo_apoyo',
  NULL,
  $CLAUSE$En la ciudad de {{centro.ciudad}}, siendo las [HORA] del día {{fecha.hoy}}, en las instalaciones del {{centro.nombre}}, ubicado en {{centro.direccion}}, habilitado mediante {{centro.resolucion}}, se celebró la audiencia dentro del trámite de acuerdos de apoyo radicado No. {{caso.radicado}}, promovido por {{convocante.nombre}}, identificado(a) con {{convocante.doc}}, en ejercicio de su derecho al reconocimiento de la capacidad legal plena y a la adopción voluntaria de mecanismos de apoyo, conforme a la Ley 1996 de 2019.$CLAUSE$,
  ARRAY['preambulo', 'apertura', 'acuerdo-apoyo', 'ley-1996'],
  TRUE,
  TRUE
);

-- ─── IDENTIFICACIÓN DE PARTES ──────────────────────────────────────────────

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000010',
  NULL,
  'Identificación — Persona natural convocante',
  'identificacion_partes',
  NULL,
  NULL,
  $CLAUSE$CONVOCANTE: {{convocante.nombre}}, mayor de edad, identificado(a) con cédula de ciudadanía No. {{convocante.doc}}, domiciliado(a) en {{convocante.direccion}}, con correo electrónico {{convocante.email}} y teléfono {{convocante.telefono}}, quien actúa [EN NOMBRE PROPIO / REPRESENTADO(A) POR APODERADO JUDICIAL].$CLAUSE$,
  ARRAY['identificacion', 'persona-natural'],
  TRUE,
  TRUE
);

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000011',
  NULL,
  'Identificación — Persona jurídica convocada',
  'identificacion_partes',
  NULL,
  NULL,
  $CLAUSE$CONVOCADA: [RAZÓN SOCIAL], sociedad legalmente constituida e identificada con NIT [NIT], representada legalmente por [NOMBRE DEL REPRESENTANTE LEGAL], mayor de edad, identificado(a) con cédula de ciudadanía No. [CÉDULA], en su calidad de [CARGO], según consta en certificado de existencia y representación legal expedido por la Cámara de Comercio de [CIUDAD].$CLAUSE$,
  ARRAY['identificacion', 'persona-juridica', 'representacion'],
  TRUE,
  TRUE
);

-- ─── CONSIDERACIONES ───────────────────────────────────────────────────────

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000020',
  NULL,
  'Consideraciones — Antecedentes del conflicto (genérica)',
  'consideraciones',
  'conciliacion',
  NULL,
  $CLAUSE$CONSIDERACIONES:

1. Que las partes manifestaron estar en conflicto en los términos descritos en la solicitud de conciliación radicada el {{caso.fecha_solicitud}}, que versa sobre asunto de materia {{caso.materia}}.

2. Que el(la) conciliador(a) {{conciliador.nombre}}, portador(a) de la tarjeta profesional No. {{conciliador.tarjeta}}, informó a las partes sobre la naturaleza, alcances y efectos del presente trámite, así como sobre los efectos de cosa juzgada y el mérito ejecutivo del acta que pudiera expedirse.

3. Que las partes intervinieron libres de toda coacción, de manera voluntaria y con plena capacidad legal, y manifestaron su ánimo conciliatorio.

4. Que se expusieron las posiciones y pretensiones de cada parte y se desarrolló la audiencia conforme al protocolo del {{centro.nombre}}.$CLAUSE$,
  ARRAY['consideraciones', 'antecedentes', 'generica'],
  TRUE,
  TRUE
);

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000021',
  NULL,
  'Consideraciones — Conflicto contractual (incumplimiento)',
  'consideraciones',
  'conciliacion',
  NULL,
  $CLAUSE$CONSIDERACIONES:

1. Que entre las partes existió una relación contractual de [TIPO DE CONTRATO] celebrada el [FECHA], cuyo objeto consistió en [OBJETO DEL CONTRATO].

2. Que la parte convocante alega el incumplimiento de las obligaciones contractuales a cargo de la convocada, consistente en [DESCRIBIR INCUMPLIMIENTO], generando perjuicios por valor de [MONTO].

3. Que la parte convocada [ACEPTA / CONTROVIERTE] las pretensiones en los siguientes términos: [POSICIÓN DE LA CONVOCADA].

4. Que las partes, reconociendo la existencia del conflicto y con ánimo de alcanzar una solución autocompositiva, manifiestan lo siguiente:$CLAUSE$,
  ARRAY['consideraciones', 'contractual', 'incumplimiento'],
  TRUE,
  TRUE
);

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000022',
  NULL,
  'Consideraciones — Restitución de inmueble arrendado',
  'consideraciones',
  'conciliacion',
  NULL,
  $CLAUSE$CONSIDERACIONES:

1. Que entre las partes existe contrato de arrendamiento sobre el inmueble ubicado en [DIRECCIÓN DEL INMUEBLE], suscrito el [FECHA] por un canon mensual de [MONTO].

2. Que la parte convocante manifiesta que la convocada se encuentra en mora en el pago de los cánones correspondientes a [MESES ADEUDADOS], por un valor total de [MONTO TOTAL], incluyendo servicios públicos pendientes.

3. Que adicionalmente se solicita la restitución del bien inmueble con fundamento en la Ley 820 de 2003.

4. Que las partes comparecen con ánimo conciliatorio, buscando un acuerdo que evite la activación de la jurisdicción ordinaria.$CLAUSE$,
  ARRAY['consideraciones', 'arrendamiento', 'restitucion', 'ley-820'],
  TRUE,
  TRUE
);

-- ─── OBLIGACIONES DE DAR ───────────────────────────────────────────────────

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000030',
  NULL,
  'Obligación de dar — Pago único',
  'obligacion_dar',
  NULL,
  ARRAY['acuerdo_total', 'acuerdo_parcial'],
  $CLAUSE$OBLIGACIÓN DE PAGO ÚNICO: La parte convocada se obliga a pagar a la convocante la suma de [MONTO EN NÚMEROS] ([MONTO EN LETRAS] PESOS COLOMBIANOS), a más tardar el día [FECHA LÍMITE DE PAGO], mediante transferencia electrónica a la cuenta [TIPO DE CUENTA] No. [NÚMERO DE CUENTA] del [BANCO], a nombre de {{convocante.nombre}}, identificado(a) con {{convocante.doc}}.$CLAUSE$,
  ARRAY['obligacion', 'pago-unico', 'transferencia'],
  TRUE,
  TRUE
);

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000031',
  NULL,
  'Obligación de dar — Pago en cuotas mensuales',
  'obligacion_dar',
  NULL,
  ARRAY['acuerdo_total', 'acuerdo_parcial'],
  $CLAUSE$OBLIGACIÓN DE PAGO EN CUOTAS: La parte convocada se obliga a pagar a la convocante la suma total de [MONTO TOTAL EN NÚMEROS] ([MONTO EN LETRAS] PESOS COLOMBIANOS), mediante [NÚMERO DE CUOTAS] cuotas mensuales iguales y sucesivas de [MONTO DE CUOTA] cada una, pagaderas el día [DÍA DE PAGO] de cada mes, siendo la primera cuota el día [FECHA PRIMERA CUOTA] y la última el [FECHA ÚLTIMA CUOTA].

El pago se efectuará mediante transferencia electrónica a la cuenta [TIPO DE CUENTA] No. [NÚMERO DE CUENTA] del [BANCO], a nombre de {{convocante.nombre}}.

PARÁGRAFO — ACELERACIÓN: El incumplimiento en el pago oportuno de dos (2) cuotas consecutivas o tres (3) no consecutivas, facultará a la parte convocante para exigir el pago total de la obligación pendiente, sin necesidad de requerimiento judicial o extrajudicial alguno, al cual renuncia expresamente la parte convocada.$CLAUSE$,
  ARRAY['obligacion', 'pago-cuotas', 'aceleracion'],
  TRUE,
  TRUE
);

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000032',
  NULL,
  'Obligación de dar — Entrega de bien mueble',
  'obligacion_dar',
  NULL,
  ARRAY['acuerdo_total', 'acuerdo_parcial'],
  $CLAUSE$ENTREGA DE BIEN MUEBLE: La parte convocada se obliga a entregar a la convocante el siguiente bien mueble: [DESCRIPCIÓN DETALLADA DEL BIEN, MARCA, MODELO, SERIAL, CARACTERÍSTICAS], en estado [DESCRIBIR ESTADO DE ENTREGA], a más tardar el día [FECHA DE ENTREGA], en la siguiente dirección: [LUGAR DE ENTREGA].

La entrega se hará constar mediante acta suscrita por las partes, en la que se dejará registro del estado del bien.$CLAUSE$,
  ARRAY['obligacion', 'entrega', 'bien-mueble'],
  TRUE,
  TRUE
);

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000033',
  NULL,
  'Obligación de dar — Restitución de inmueble',
  'obligacion_dar',
  'conciliacion',
  ARRAY['acuerdo_total', 'acuerdo_parcial'],
  $CLAUSE$RESTITUCIÓN DEL INMUEBLE: La parte convocada se obliga a restituir a la convocante el inmueble ubicado en [DIRECCIÓN COMPLETA DEL INMUEBLE], libre de personas y enseres, al día y a paz y salvo en el pago de servicios públicos domiciliarios y administración, a más tardar el día [FECHA DE ENTREGA], a las [HORA].

La entrega se hará mediante acta firmada por las partes, en la que constará el estado del inmueble, las lecturas de contadores y el inventario de bienes que permanecen en el bien.$CLAUSE$,
  ARRAY['restitucion', 'inmueble', 'arrendamiento'],
  TRUE,
  TRUE
);

-- ─── OBLIGACIONES DE HACER / NO HACER ──────────────────────────────────────

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000040',
  NULL,
  'Obligación de hacer — Prestación de servicio',
  'obligacion_hacer',
  NULL,
  ARRAY['acuerdo_total', 'acuerdo_parcial'],
  $CLAUSE$OBLIGACIÓN DE HACER: La parte convocada se obliga a ejecutar a favor de la convocante [DESCRIBIR LA OBLIGACIÓN: servicio, reparación, construcción, etc.], en los términos y con las especificaciones técnicas que se detallan a continuación: [ESPECIFICACIONES].

Plazo de ejecución: [PLAZO O FECHA LÍMITE]. La obligación se entenderá cumplida con la suscripción del acta de entrega a satisfacción por parte de la convocante.$CLAUSE$,
  ARRAY['obligacion', 'hacer', 'servicio'],
  TRUE,
  TRUE
);

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000041',
  NULL,
  'Obligación de no hacer — Abstención',
  'obligacion_no_hacer',
  NULL,
  ARRAY['acuerdo_total', 'acuerdo_parcial'],
  $CLAUSE$OBLIGACIÓN DE NO HACER: La parte [CONVOCANTE/CONVOCADA] se obliga a abstenerse de [DESCRIBIR LA CONDUCTA QUE DEBE CESAR O NO REPETIRSE], por un término de [PLAZO O INDEFINIDAMENTE]. El incumplimiento de esta obligación generará las consecuencias previstas en la cláusula penal acordada, sin perjuicio de las acciones legales a que haya lugar.$CLAUSE$,
  ARRAY['obligacion', 'no-hacer', 'abstencion'],
  TRUE,
  TRUE
);

-- ─── GARANTÍAS ─────────────────────────────────────────────────────────────

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000050',
  NULL,
  'Garantía personal — Codeudor solidario',
  'garantias',
  NULL,
  ARRAY['acuerdo_total', 'acuerdo_parcial'],
  $CLAUSE$CODEUDOR SOLIDARIO: Como garantía adicional del cumplimiento de las obligaciones adquiridas por la parte convocada, comparece a este acto [NOMBRE DEL CODEUDOR], mayor de edad, identificado(a) con cédula de ciudadanía No. [CÉDULA CODEUDOR], domiciliado(a) en [DIRECCIÓN CODEUDOR], quien se constituye en CODEUDOR SOLIDARIO de todas las obligaciones aquí contraídas, renunciando expresamente a los beneficios de excusión y división.$CLAUSE$,
  ARRAY['garantia', 'codeudor', 'solidario'],
  TRUE,
  TRUE
);

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000051',
  NULL,
  'Garantía — Pagaré en blanco con carta de instrucciones',
  'garantias',
  NULL,
  ARRAY['acuerdo_total', 'acuerdo_parcial'],
  $CLAUSE$PAGARÉ: Como respaldo de las obligaciones contraídas, la parte convocada suscribe a favor de la convocante un pagaré en blanco con carta de instrucciones, el cual podrá ser llenado ante el incumplimiento de las obligaciones aquí pactadas, por el monto insoluto, los intereses corrientes y moratorios a la máxima tasa legal permitida, y demás conceptos accesorios, siendo título ejecutivo idóneo para el cobro judicial correspondiente.$CLAUSE$,
  ARRAY['garantia', 'pagare', 'titulo-ejecutivo'],
  TRUE,
  TRUE
);

-- ─── CLÁUSULA PENAL ────────────────────────────────────────────────────────

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000060',
  NULL,
  'Cláusula penal — Porcentaje sobre obligación',
  'clausula_penal',
  NULL,
  ARRAY['acuerdo_total', 'acuerdo_parcial'],
  $CLAUSE$CLÁUSULA PENAL: En caso de incumplimiento total o parcial de cualquiera de las obligaciones pactadas, la parte incumplida pagará a la parte cumplida, a título de pena, una suma equivalente al [PORCENTAJE, ej. 20%] del valor total de la obligación incumplida, sin perjuicio del cumplimiento de la obligación principal y del pago de intereses moratorios a la máxima tasa legal permitida.

Esta pena constituye estimación anticipada de perjuicios y no requiere prueba del daño.$CLAUSE$,
  ARRAY['clausula-penal', 'incumplimiento', 'pena'],
  TRUE,
  TRUE
);

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000061',
  NULL,
  'Intereses de mora',
  'clausula_penal',
  NULL,
  ARRAY['acuerdo_total', 'acuerdo_parcial'],
  $CLAUSE$INTERESES DE MORA: Las sumas que no fueren pagadas oportunamente causarán intereses moratorios a la máxima tasa legal permitida, certificada por la Superintendencia Financiera de Colombia, desde el día siguiente al vencimiento del plazo y hasta el día en que se verifique el pago efectivo, sin perjuicio de la aplicación de la cláusula penal.$CLAUSE$,
  ARRAY['intereses', 'mora'],
  TRUE,
  TRUE
);

-- ─── CONFIDENCIALIDAD / DOMICILIO ──────────────────────────────────────────

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000070',
  NULL,
  'Confidencialidad de la audiencia',
  'confidencialidad',
  NULL,
  NULL,
  $CLAUSE$CONFIDENCIALIDAD: Las partes y el(la) conciliador(a) se obligan a mantener la reserva y confidencialidad sobre todo lo actuado en la presente audiencia, con excepción del contenido del acta, conforme al artículo 76 de la Ley 23 de 1991, en concordancia con los artículos 1 y 3 de la Ley 640 de 2001. Los documentos, manifestaciones, propuestas y posiciones expuestas en el curso del trámite no podrán ser invocados como prueba en procesos judiciales o administrativos posteriores.$CLAUSE$,
  ARRAY['confidencialidad', 'reserva', 'ley-640'],
  TRUE,
  TRUE
);

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000071',
  NULL,
  'Domicilio contractual para notificaciones',
  'domicilio_notificaciones',
  NULL,
  NULL,
  $CLAUSE$DOMICILIO CONTRACTUAL: Para todos los efectos derivados del presente acuerdo, las partes fijan como domicilio contractual la ciudad de {{centro.ciudad}}. Las notificaciones se surtirán en las siguientes direcciones:

CONVOCANTE: {{convocante.direccion}} — {{convocante.email}}
CONVOCADA: [DIRECCIÓN DE LA CONVOCADA] — [CORREO DE LA CONVOCADA]

Cualquier cambio de domicilio o datos de contacto deberá ser comunicado por escrito a la contraparte dentro de los cinco (5) días hábiles siguientes a su ocurrencia.$CLAUSE$,
  ARRAY['domicilio', 'notificaciones'],
  TRUE,
  TRUE
);

-- ─── DESISTIMIENTO / INASISTENCIA ──────────────────────────────────────────

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000080',
  NULL,
  'Desistimiento — Unilateral del convocante',
  'desistimiento',
  'conciliacion',
  ARRAY['desistimiento'],
  $CLAUSE$DESISTIMIENTO: La parte convocante, {{convocante.nombre}}, en ejercicio del derecho reconocido en el artículo 9 de la Ley 640 de 2001, manifiesta su decisión libre, voluntaria e informada de DESISTIR de la presente solicitud de conciliación, renunciando a continuar con el trámite. En consecuencia, el(la) conciliador(a) declara terminado el procedimiento conciliatorio y dispone el archivo de las diligencias.$CLAUSE$,
  ARRAY['desistimiento', 'unilateral', 'archivo'],
  TRUE,
  TRUE
);

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000081',
  NULL,
  'Constancia de inasistencia — Parte convocada',
  'inasistencia',
  'conciliacion',
  ARRAY['inasistencia'],
  $CLAUSE$CONSTANCIA DE INASISTENCIA: Siendo la fecha y hora señaladas para la audiencia de conciliación, se verifica que la parte convocada, pese a haber sido debidamente citada mediante [MEDIO DE CITACIÓN, ej.: correo electrónico y comunicación escrita con guía de entrega], NO COMPARECIÓ ni presentó justificación alguna.

De conformidad con el artículo 35 de la Ley 640 de 2001, la inasistencia injustificada de la parte convocada producirá los efectos allí previstos, entre ellos la presunción de veracidad de los hechos susceptibles de confesión que se discutan en proceso posterior y las consecuencias procesales correspondientes. Se expide la presente constancia para los fines legales pertinentes.$CLAUSE$,
  ARRAY['inasistencia', 'convocada', 'ley-640-art-35'],
  TRUE,
  TRUE
);

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000082',
  NULL,
  'Constancia de inasistencia — Ambas partes',
  'inasistencia',
  'conciliacion',
  ARRAY['inasistencia'],
  $CLAUSE$CONSTANCIA DE INASISTENCIA DE AMBAS PARTES: Siendo la fecha y hora señaladas para la audiencia de conciliación dentro del radicado No. {{caso.radicado}}, se verifica que NINGUNA de las partes compareció ni presentó justificación alguna, pese a haber sido debidamente citadas. En consecuencia, se da por terminado el trámite conciliatorio y se ordena el archivo de las diligencias, sin perjuicio de que las partes puedan presentar una nueva solicitud de conciliación si así lo estiman conveniente.$CLAUSE$,
  ARRAY['inasistencia', 'ambas-partes', 'archivo'],
  TRUE,
  TRUE
);

-- ─── CIERRE ────────────────────────────────────────────────────────────────

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000090',
  NULL,
  'Cierre — Acta con acuerdo (mérito ejecutivo y cosa juzgada)',
  'cierre',
  'conciliacion',
  ARRAY['acuerdo_total', 'acuerdo_parcial'],
  $CLAUSE$MÉRITO EJECUTIVO Y COSA JUZGADA: Las partes declaran conocer que, de conformidad con los artículos 1 y 66 de la Ley 446 de 1998 y el artículo 1 de la Ley 640 de 2001, el acuerdo aquí consignado presta mérito ejecutivo y hace tránsito a cosa juzgada en los términos del artículo 303 del Código General del Proceso.

No siendo otro el objeto de la presente diligencia, se da por terminada siendo las [HORA DE CIERRE], y en constancia firman quienes en ella intervinieron.$CLAUSE$,
  ARRAY['cierre', 'merito-ejecutivo', 'cosa-juzgada'],
  TRUE,
  TRUE
);

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000091',
  NULL,
  'Cierre — Acta sin acuerdo',
  'cierre',
  'conciliacion',
  ARRAY['no_acuerdo'],
  $CLAUSE$CIERRE SIN ACUERDO: Agotadas las posibilidades de arreglo directo y habiéndose intentado distintas fórmulas conciliatorias sin éxito, las partes manifiestan que NO FUE POSIBLE LLEGAR A UN ACUERDO. En consecuencia, el(la) conciliador(a) expide la presente acta de no acuerdo, que constituye el requisito de procedibilidad exigido por la ley para acudir a la jurisdicción ordinaria, de conformidad con los artículos 35 y siguientes de la Ley 640 de 2001.

No siendo otro el objeto de la presente diligencia, se da por terminada siendo las [HORA DE CIERRE], y en constancia firman quienes en ella intervinieron.$CLAUSE$,
  ARRAY['cierre', 'no-acuerdo', 'procedibilidad'],
  TRUE,
  TRUE
);

-- ─── INSOLVENCIA ───────────────────────────────────────────────────────────

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000100',
  NULL,
  'Insolvencia — Acuerdo de pago aprobado',
  'insolvencia_acuerdo_pago',
  'insolvencia',
  ARRAY['acuerdo_total'],
  $CLAUSE$ACUERDO DE PAGO: Habiéndose obtenido la aprobación de los acreedores con el quórum y mayorías previstas en el artículo 553 del Código General del Proceso, se celebra el siguiente ACUERDO DE PAGO dentro del trámite de insolvencia del deudor {{convocante.nombre}}:

1. Plazo total del acuerdo: [PLAZO EN MESES O AÑOS].
2. Monto total reconocido a los acreedores: [MONTO TOTAL].
3. Forma y periodicidad de pago: [DESCRIBIR: cuotas mensuales, trimestrales, etc.]
4. Fecha de inicio del primer pago: [FECHA].
5. Prelación de créditos: Los pagos se aplicarán conforme a la prelación legal prevista en los artículos 2488 y siguientes del Código Civil y el artículo 557 del Código General del Proceso.

El presente acuerdo, una vez firmado, será vinculante para todos los acreedores relacionados en el trámite, incluidos los que no hubieren asistido a la audiencia, de conformidad con el artículo 555 del Código General del Proceso.$CLAUSE$,
  ARRAY['insolvencia', 'acuerdo-pago', 'prelacion'],
  TRUE,
  TRUE
);

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000101',
  NULL,
  'Insolvencia — Fracaso del acuerdo (remisión a liquidación)',
  'insolvencia_liquidacion',
  'insolvencia',
  ARRAY['no_acuerdo'],
  $CLAUSE$FRACASO DEL ACUERDO Y REMISIÓN A LIQUIDACIÓN: No habiéndose alcanzado las mayorías exigidas por el artículo 553 del Código General del Proceso para la aprobación del acuerdo de pago, o habiendo fracasado la negociación, el(la) conciliador(a) declara el FRACASO DEL TRÁMITE DE NEGOCIACIÓN DE DEUDAS y dispone remitir el expediente al juez civil municipal competente del domicilio del deudor, para que se adelante el procedimiento de LIQUIDACIÓN PATRIMONIAL, de conformidad con los artículos 563 y siguientes del Código General del Proceso.$CLAUSE$,
  ARRAY['insolvencia', 'liquidacion', 'fracaso'],
  TRUE,
  TRUE
);

-- ─── ACUERDOS DE APOYO ─────────────────────────────────────────────────────

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000110',
  NULL,
  'Acuerdo de apoyo — Designación de persona de apoyo',
  'apoyo_decision',
  'acuerdo_apoyo',
  ARRAY['acuerdo_total'],
  $CLAUSE$DESIGNACIÓN DE PERSONA DE APOYO: {{convocante.nombre}}, en pleno ejercicio de su capacidad legal y autonomía, manifiesta su voluntad libre e informada de designar como PERSONA DE APOYO a [NOMBRE DE LA PERSONA DE APOYO], mayor de edad, identificado(a) con cédula de ciudadanía No. [CÉDULA], domiciliado(a) en [DIRECCIÓN], quien acepta la designación y se obliga a actuar conforme a los principios de la Ley 1996 de 2019.

Relación con el titular: [VÍNCULO, ej.: hermano, hijo, amigo, persona de confianza].

La persona de apoyo actuará respetando la voluntad y preferencias del titular del acto jurídico, sin sustituirla, y únicamente dentro del alcance expresamente definido en el presente acuerdo.$CLAUSE$,
  ARRAY['apoyo', 'designacion', 'ley-1996'],
  TRUE,
  TRUE
);

INSERT INTO sgcc_clausulas (id, center_id, titulo, categoria, tipo_tramite, resultado_aplicable, contenido, tags, es_default, activo)
VALUES (
  '10000000-0000-0000-0000-000000000111',
  NULL,
  'Acuerdo de apoyo — Alcance del apoyo',
  'apoyo_decision',
  'acuerdo_apoyo',
  ARRAY['acuerdo_total'],
  $CLAUSE$ALCANCE DEL APOYO: El apoyo designado se limita a los siguientes actos jurídicos:

1. [ÁREA DE APOYO — ej. gestión bancaria y financiera].
2. [ÁREA DE APOYO — ej. trámites administrativos y de salud].
3. [ÁREA DE APOYO — ej. celebración de contratos civiles y comerciales].

TIPO DE APOYO: La persona de apoyo actuará mediante [SEÑALAR: ASISTENCIA (acompañamiento en la toma de decisiones) / INTERPRETACIÓN DE LA VOLUNTAD / COMUNICACIÓN ASISTIDA], sin sustituir la voluntad del titular.

DURACIÓN: El presente acuerdo de apoyo tendrá una vigencia de [PLAZO, máximo 5 años, renovable], contados a partir de la fecha de suscripción. El titular podrá revocarlo en cualquier momento mediante manifestación de voluntad escrita, sin expresar causa.

SALVAGUARDIAS: Conforme al artículo 11 de la Ley 1996 de 2019, se adoptan las siguientes salvaguardias para evitar abusos: [LISTAR SALVAGUARDIAS].$CLAUSE$,
  ARRAY['apoyo', 'alcance', 'salvaguardias', 'ley-1996'],
  TRUE,
  TRUE
);

-- ─── VARIABLES REQUERIDAS (auto-extraer desde contenido) ───────────────────
-- Actualiza variables_requeridas con los tokens {{...}} encontrados en el contenido.
UPDATE sgcc_clausulas
SET variables_requeridas = (
  SELECT COALESCE(jsonb_agg(DISTINCT match[1]), '[]'::jsonb)
  FROM regexp_matches(contenido, '\{\{([^}]+)\}\}', 'g') AS match
)
WHERE center_id IS NULL;
