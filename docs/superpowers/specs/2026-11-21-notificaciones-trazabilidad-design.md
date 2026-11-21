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
