# Plan — Notificaciones con trazabilidad (citaciones)

Diseño: `docs/superpowers/specs/2026-11-21-notificaciones-trazabilidad-design.md` (decisiones en 8d y 8e).
Principio: **LM transporta, SIGECC define el contenido.** Remitente `{centro} vía Legal Manager`.

## Fase 0 — Legal Manager (sesión LM) · bloquea a la Fase 1

Contrato propuesto (la sesión LM puede ajustarlo y lo deja en memoria):

- `POST /api/partner/v1/mensajes` (withPartner, idempotente por `external_id`)
  - body: `external_id`, `canal` ("email" | "whatsapp"), `destinatario {nombre, email?, telefono?}`,
    `remitente {nombre, telefono?, correo?, logo_url?}`,
    `email? {asunto, html, adjuntos?: [{nombre, url}]}`,
    `whatsapp? {variables: {...}, boton_url}` (plantilla Utilidad nueva aprobada por Meta).
  - 201 `{mensaje_id, estado: "aceptado"}`. El HTML y el texto los arma SIGECC; LM solo envía.
- Webhooks al partner: `mensaje.entregado | mensaje.leido | mensaje.rebotado | mensaje.fallido`
  con hora del proveedor y, si Resend lo expone, la respuesta SMTP del servidor destino.
- `GET /api/partner/v1/mensajes/[id]` → estado + eventos (respaldo si se pierde un webhook).
- Respuesta automática en el buzón `notificaciones@` y en WhatsApp (texto de la sección 8d).
- Firmas con origen partner (SIGECC): usar la leyenda de SIGECC a nombre del centro.
  Clientes propios de LM: sin cambios.
- Tareas del usuario: crear la plantilla de WhatsApp en Meta y esperar su aprobación.

## Fase 1 — SIGECC: base probatoria (correo + WhatsApp + enlace)

1. Migración: `sgcc_notificacion_envios` (por destinatario y canal: caso, parte/apoderado,
   documento, hash, canal, destino, `token_hash`, vencimiento, `lm_mensaje_id`, estado) y
   `sgcc_notificacion_eventos` **append-only** con **hash encadenado** (trigger que bloquea
   UPDATE/DELETE). RLS por centro.
2. Citación en **PDF** (hoy DOCX) con huella SHA-256; reutilizar la generación PDF de autos.
3. Envío por destinatario vía `POST /mensajes`: correo (HTML con leyenda formal larga, logo,
   teléfono y correo del centro) y WhatsApp si hay celular y el centro lo marca.
4. Página pública `/notificacion/[token]`: muestra la citación, registra el acceso
   (IP, user-agent, hora), botón **"Acuso recibo"**, leyenda larga. Rate limit.
5. Receptor de webhooks `mensaje.*` (HMAC) → eventos.
6. Regla: la parte queda **"citada" solo con entregado o acceso** (hoy se marca a todos antes
   de enviar). Corregir el texto "confírmela asistencia".

## Fase 2 — SIGECC: seguimiento

- Panel en el expediente: por destinatario y canal → enviado / entregado / leído / accedió /
  acusó recibo / rebotó, con hora Colombia.
- Alertas al conciliador: rebote, sin entrega en 24 h, sin acceso en 48 h.
- Reenvío por otro canal y **registro manual de envío físico** con soporte (guía 4-72, foto).

## Fase 3 — SIGECC: constancia y términos

- **Constancia PDF por destinatario** (la genera SIGECC): datos del mensaje, huella del
  documento, línea de tiempo con cadena de hashes, nota legal (evidencia técnica de entrega,
  Ley 527 arts. 7, 10, 11, 20-21; sin "certificado" ni "plena validez"). Se archiva en el expediente.
- Cómputo de la notificación surtida: envío + 2 días hábiles (Ley 2213 art. 8,
  `dias-habiles-colombia.ts`), mostrando la fecha de acceso/acuse.

## Fase 4 (posterior) — Autorregistro a la audiencia sobre el mismo enlace (OTP + poder)

## Pendientes del usuario antes de cerrar textos
- Validar la frase "no se entenderán presentados ante el Centro".
- ¿Cada centro enlaza su política de tratamiento de datos en la confidencialidad?
- Redacción: "Legal Manager, plataforma de envío de notificaciones y firma electrónica
  utilizada por {centro}".
