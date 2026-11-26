# Notificaciones con trazabilidad (citaciones y actos del trámite) — Diseño

Fecha: 2026-11-21 · Estado: BORRADOR para aprobación del usuario

## 1. Objetivo

Que cada citación (y luego autos, suspensiones, nuevas fechas) se notifique
**por destinatario** con evidencia técnica de entrega y acceso, al estilo del
correo certificado, **sin usar la palabra "certificado"** (reservada por la
Ley 1369 de 2009 a operadores postales habilitados).

Nombre comercial: **"Notificación electrónica con trazabilidad"**.
Documento probatorio: **"Constancia de notificación — Evidencia técnica de entrega"**.

## 2. Marco legal (a validar por el usuario, abogado)

- Ley 527/1999 arts. 7, 10, 11 (mensaje de datos admisible como prueba) y
  arts. 20-21 (acuse de recibo).
- Ley 2213/2022 art. 8 + Sentencia C-420/2020: la notificación se entiende
  realizada 2 días hábiles después del envío, y los términos corren cuando se
  recibe acuse de recibo **o se puede constatar el acceso del destinatario**.
  Aplica con claridad a insolvencia (CGP); en conciliación extrajudicial la
  citación se rige por la Ley 2220/2022 (medio idóneo, incluido electrónico).
- WhatsApp es mensaje de datos; la jurisprudencia lo ha admitido cuando el
  número fue suministrado por el interesado y hay evidencia de recepción.
- Redacción heredada de Legal Manager: "evidencia técnica de entrega"; NO decir
  "plena validez probatoria" (la valora el juez); NO "certificado".

## 3. Canales

| Canal | Rol | Evidencia que deja |
|---|---|---|
| **Correo (Resend)** | Principal y probatorio | aceptado, entregado, rebotado (webhook firmado Svix) |
| **WhatsApp (Meta Cloud API)** | Probatorio igual que el correo (STC16733-2022: basta concluir que lo recibió; juzgados piden doble check / leído) | aceptado, entregado (doble check), leído (check azul, si el destinatario no lo desactivó) |
| **Enlace personal** (en ambos) | La prueba fuerte | accedió (IP, user-agent, hora), descargó, acusó recibo |
| **Físico / manual** | Respaldo si los digitales fallan | registro manual con soporte (guía 4-72, foto) |

No se registra "abierto" por píxel de correo (poco confiable, decisión ya tomada en LM).

## 4. Flujo

1. Conciliador pulsa "Notificar citación" → se genera **PDF** (no DOCX) con
   huella **SHA-256**, guardado en expediente.
2. Se crea **un envío por destinatario y canal** (parte y apoderado activo),
   cada uno con **token propio** (32 bytes aleatorios, con vencimiento).
3. El mensaje NO depende del adjunto: lleva enlace `/notificacion/[token]`
   (el PDF puede ir adjunto como respaldo en correo).
4. La página del enlace muestra el documento, registra el acceso y ofrece
   **"Acuso recibo"** (y luego "Confirmo asistencia" / autorregistro, fase 4).
5. Webhooks de Resend y Meta agregan eventos de proveedor.
6. La parte queda **"notificada" solo con entrega o acceso**; rebote o
   no-entrega → alerta al conciliador y reenvío por otro canal.
7. Fecha de notificación surtida calculada (envío + 2 días hábiles, con
   `dias-habiles-colombia.ts`) mostrando además la fecha de acceso/acuse.
8. **Constancia PDF por destinatario** con línea de tiempo en hora Colombia,
   huella del documento y nota legal; descargable y anexable al acta.

## 5. Modelo de datos (migración nueva)

- `sgcc_notificacion_envios`: id, center_id, case_id, documento_id,
  hash_documento, party_id / attorney_id, canal, destino (email/teléfono),
  token_hash, token_expira_at, proveedor_id, estado_actual, created_by_staff.
- `sgcc_notificacion_eventos` **append-only** (trigger que bloquea UPDATE/DELETE):
  envio_id, tipo (`aceptado|entregado|rebotado|leido|accedio|descargo|acuso_recibo|manual`),
  ocurrido_at (hora del proveedor cuando exista), fuente, ip, user_agent,
  payload_hash.
- RLS por center_id como el resto de `sgcc_*`.

## 6. Seguridad

- Token guardado como hash; página pública con rate limit (`src/lib/rate-limit.ts`).
- Webhooks con verificación de firma (Svix para Resend, `X-Hub-Signature-256` para Meta).
- Documento servido por el proxy autenticado por token (patrón `/api/firmar/[token]/archivo`).

## 7. Corrige además

- Hoy `citacion/route.ts` marca `citacion_enviada_at` y estado "citado" para
  todos **antes** de enviar y aunque falle. Pasa a depender de entrega/acceso.
- Error de texto "confírmela asistencia".

## 8. Fases

| Fase | Contenido | Depende de |
|---|---|---|
| F1 | Migración, PDF+hash, envío por destinatario, página del enlace + acuse, webhook Resend, corrección "citado" | — |
| F2 | Constancia PDF, panel de seguimiento en expediente, alertas, reenvío, registro físico manual | F1 |
| F3 | WhatsApp: plantilla Meta aprobada, envío, webhook | F1 + configuración Meta |
| F4 | Autorregistro a la audiencia sobre el mismo enlace (OTP + poder) | F1 |

Base a portar desde Legal Manager: `src/lib/firma/resend-webhook.ts` (Svix manual),
`src/lib/firma/constancia-entrega.ts` (pdf-lib), tabla append-only de eventos.

## 8b. Revisión 21-nov (diagnóstico, sin implementar)

**Legal Manager como proveedor (preferencia del usuario).** LM ya tiene en producción:
API partner que SIGECC consume para firma (auth por API key, webhooks HMAC salientes,
idempotencia, anti-SSRF), WhatsApp Cloud API con estados entregado/leído llegando
desde 13-nov, webhook Resend con Svix, tabla append-only de eventos y constancia PDF.
Propuesta: nuevo endpoint `POST /api/partner/v1/notificaciones` en LM; LM envía
(correo + WhatsApp), aloja la página del enlace, guarda la traza, emite la constancia
y avisa a SIGECC por webhook (entregado, leído, accedió, acusó recibo). SIGECC solo
muestra estado y archiva la constancia en el expediente. Se cobra como consumo
(igual que firma partner).

Riesgos a resolver:
- **Reputación del número de WhatsApp**: los convocados no dieron su número (lo dio
  el convocante) → si bloquean/reportan, baja la calidad del número que usa la firma
  de LM. Mitigar con un **número separado para notificaciones** en la misma cuenta de Meta.
- **Plantilla nueva** en Meta (categoría Utilidad) con el nombre del centro en el cuerpo;
  el nombre visible del remitente es el de LM.
- **Juramento** (Ley 2213 art. 8 y jurisprudencia de WhatsApp): el solicitante debe
  afirmar bajo juramento que el correo/número es del destinatario y cómo lo obtuvo →
  agregar casilla en la solicitud de SIGECC.

**Referente: Servientrega e-entrega** (fuentes comerciales, a verificar): por
destinatario, testigo PDF con resumen, trazabilidad, contenido y adjuntos; firma digital
del mensaje (integridad); estado en tiempo real y entrega al servidor; planes de 10 a
200 envíos. Equivalentes nuestros: huella SHA-256 + constancia + estado "entregado".
Brecha: ellos firman con certificado digital de una entidad certificada; nosotros
podríamos sellar la constancia con firma digital/estampa de tiempo de una ECD (costo
adicional, evaluar). Ventaja nuestra: WhatsApp + acceso al enlace + acuse dentro del
trámite. Su prueba también ha sido debatida en juzgados (destino no registrado, captura
pedida al operador): la dirección correcta y el juramento pesan tanto como la traza.

## 9. Decisiones pendientes del usuario

1. WhatsApp: ¿mismo número/cuenta de Meta de Legal Manager o uno propio de
   SIGECC? (Meta cobra por mensaje; requiere plantilla aprobada.)
2. Alcance inicial: ¿solo citaciones o también autos/suspensiones/nuevas fechas?
   (Recomendado: modelo general, se estrena con citaciones.)
3. Remitente: `notificaciones@sgcc.app` con "responder a" del centro, o dominio
   propio de cada centro (requiere verificar DNS por centro).

## 8c. Análisis de un testigo de e-entrega (24-nov)

Se revisó un testigo real (datos del caso omitidos a propósito). Estructura:

| Elemento del testigo | Qué es en realidad | Cómo lo replicamos |
|---|---|---|
| "E-entrega certifica… acreditado ONAC (ECD)" | El proveedor es Entidad de Certificación Digital acreditada | No decimos "certifica": "constancia / evidencia técnica de entrega" |
| Resumen: id, remitente (el centro), cuenta remitente del proveedor, destinatario, asunto, fecha, estado, adjuntos descargables | Envía desde SU dominio a nombre del cliente | Enviar desde dominio de LM a nombre del centro, "responder a" el centro; adjuntos descargables por enlace |
| "Mensaje enviado con estampa de tiempo" (art. 23 Ley 527) | Hora de salida + sello de tiempo | Hora del servidor + sello propio (ver abajo) |
| "Acuse de recibo" (art. 24) con línea SMTP `250 2.0.0 OK` del servidor destino | Es la ENTREGA al servidor del destinatario, no la lectura | Evento "entregado" de Resend. VERIFICAR si Resend expone la respuesta SMTP; si no, evaluar Amazon SES (sí la da) |
| Estampa por evento: "Tiempo de firmado" + Política (OID) | Sellado de tiempo RFC 3161 de la ECD | Sello propio (ver abajo) |
| Pie: arts. 20-21 Ley 527 (presunción de recepción con acuse automatizado) | Fundamento jurídico | Misma base legal, redacción propia |

**Decisión del usuario (24-nov): NO contratar servicios de terceros (ECD/TSA).
Replicamos la prestación del servicio con infraestructura propia (LM como proveedor).**

Sello propio en lugar de estampa de ECD:
- Cada evento guarda: hora del servidor, hora del proveedor (Resend/Meta) cuando exista,
  y `hash = SHA-256(evento + hash del evento anterior)` → **cadena de hashes**: alterar o
  borrar un evento rompe la cadena (además de la tabla append-only).
- La constancia PDF lleva la huella del documento notificado, la cadena de eventos y se
  **firma con una llave propia de LM** (verificable en una página pública de verificación,
  como la de la firma electrónica).
- Límite honesto: no es estampa de entidad acreditada; su valor lo aprecia el juez por
  confiabilidad (art. 11 Ley 527). Por eso NO se usa "certifica" ni "plena validez".

Ventajas frente al testigo analizado: su "acuse de recibo" es solo la entrega SMTP.
Nuestra traza suma WhatsApp (entregado/leído), acceso al enlace (IP/hora) y acuse
expreso del destinatario.

Idea posterior: sugerir/validar el correo de notificaciones judiciales registrado de
las entidades (personas jurídicas) para evitar discusiones por destino equivocado.

## 8d. Decisiones del usuario (26-nov)

1. **WhatsApp: mismo número de LM** (como otros proveedores). Vigilar la calidad del número
   en WhatsApp Manager; separar solo si baja. El nombre visible en WhatsApp es fijo: "Legal Manager".
2. **Alcance inicial: citaciones** (modelo general, se estrena con citaciones).
3. **Remitente (opción B, modelo e-entrega):** `{nombre del centro} vía Legal Manager
   <notificaciones@legalmanager.com.co>`. Por centro, sin DNS: nombre (+ campo opcional
   "nombre para notificaciones" si es largo), `logo_url`, `telefono`, `email_radicacion`
   (o `email_contacto`). Nombre saneado (sin comillas ni direcciones) contra suplantación.
   Opción C (dominio propio del centro) queda como extra futuro.
4. **Sin "Responder a"**: el buzón de envío no recibe correspondencia (práctica de la Rama
   Judicial). **Respuesta automática** en el buzón y en WhatsApp (gratis dentro de 24 h):
   "Esta cuenta de Legal Manager está habilitada exclusivamente para el envío de
   notificaciones y solicitudes de firma electrónica. Su mensaje no ha sido leído ni
   tramitado, y no se entiende presentado ante {remitente}. Diríjase a: {correo} · {teléfono}."

### Leyenda formal (larga) — correo y página del enlace personal
Aplica a notificaciones Y firma electrónica (para firma se cambia en LM: también alcanza a
clientes propios de LM, con {remitente} = empresa/consultor).

> AVISO IMPORTANTE
> Este es un mensaje de datos generado de forma automática por Legal Manager, plataforma de
> notificaciones y firma electrónica, por encargo de {remitente} (Ley 527 de 1999).
> Esta cuenta está habilitada EXCLUSIVAMENTE para el envío de notificaciones y solicitudes de
> firma electrónica, y no para la recepción de solicitudes, memoriales, escritos, poderes ni
> documentos. Los mensajes que se remitan a esta dirección no serán leídos ni tramitados y NO
> se entenderán presentados ante {remitente}.
> Toda solicitud o comunicación dirigida a {remitente} debe enviarse por sus canales oficiales:
> Correo: {correo} · Teléfono: {teléfono}.
> Verificación: para confirmar la autenticidad de este mensaje, consulte el enlace personal
> incluido o comuníquese con {remitente} por los canales anteriores. {remitente} no le
> solicitará pagos, contraseñas ni datos bancarios por este medio.
> Confidencialidad: este mensaje y sus anexos contienen información dirigida exclusivamente a
> su destinatario y pueden contener datos personales protegidos por la Ley 1581 de 2012. Si lo
> recibió por error, informe a {remitente} por sus canales oficiales y elimínelo.

### Leyenda corta — mensaje de WhatsApp (límite de plantilla ~1.000 caracteres)
> AVISO: Mensaje automático enviado por Legal Manager, plataforma de notificaciones y firma
> electrónica, por encargo de {remitente}. Este número NO recibe mensajes, solicitudes ni
> documentos; lo que envíe aquí no se entenderá presentado ante {remitente}. Canales oficiales:
> {correo} · {teléfono}. {remitente} no le pedirá pagos ni contraseñas por este medio.

Pendiente de validar por el usuario (abogado): la frase "no se entenderán presentados" y si
cada centro enlaza su política de tratamiento de datos en la sección de confidencialidad.
