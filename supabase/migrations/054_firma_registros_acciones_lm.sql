-- 054: acciones nuevas del registro de actividad de firma (gestión vía Legal Manager).
-- Solo AGREGA valores al CHECK de 008; no cambia ni borra datos.
--   contacto_actualizado → se editó correo/celular/canales de un firmante (PATCH LM)
--   reactivado           → firma vencida reactivada con nuevo plazo (LM)
--   expirado             → la firma venció (antes se registraba como "cancelado")
--   por_vencer           → LM avisó que vence en menos de 24 h
ALTER TABLE sgcc_firma_registros DROP CONSTRAINT IF EXISTS sgcc_firma_registros_accion_check;
ALTER TABLE sgcc_firma_registros ADD CONSTRAINT sgcc_firma_registros_accion_check
  CHECK (accion IN (
    'otp_solicitado', 'otp_verificado', 'firmado', 'rechazado',
    'visto', 'enviado', 'documento_creado', 'recordatorio_enviado', 'cancelado',
    'contacto_actualizado', 'reactivado', 'expirado', 'por_vencer'
  ));

-- Reversa (solo si no hay filas con las acciones nuevas):
-- ALTER TABLE sgcc_firma_registros DROP CONSTRAINT IF EXISTS sgcc_firma_registros_accion_check;
-- ALTER TABLE sgcc_firma_registros ADD CONSTRAINT sgcc_firma_registros_accion_check
--   CHECK (accion IN ('otp_solicitado','otp_verificado','firmado','rechazado','visto','enviado',
--                     'documento_creado','recordatorio_enviado','cancelado'));
