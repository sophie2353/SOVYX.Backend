const express = require('express');
const router = express.Router();

/**
 * Enviar notificación push al cliente (FCM / WebPush)
 */
const sendPushNotification = async (userId, title, body, data = {}) => {
  console.log(`[PUSH SENT] User: ${userId} | Title: "${title}" | Body: "${body}"`);
  // Aquí invocas tu servicio de Push Notifications (Firebase Cloud Messaging, OneSignal, WebPush, etc.)
};

/**
 * POST /api/webhook-client/timer/push-24h
 * Se activa automáticamente a las 24 horas.
 * Dispara la alerta push para que el usuario pague o suba su archivo Excel.
 */
router.post('/timer/push-24h', async (req, res) => {
  try {
    const { userId, timerId } = req.body;

    await sendPushNotification(
      userId,
      '⚠️ Recordatorio Importante',
      'Tienes 24 horas para realizar tu pago y/o subir tu archivo Excel.',
      { timerId, type: 'REQUIRE_PAYMENT_OR_EXCEL' }
    );

    return res.status(200).json({
      success: true,
      message: 'Notificación push de 24h enviada correctamente.'
    });
  } catch (error) {
    console.error('Error enviando push 24h:', error);
    return res.status(500).json({ success: false, error: 'Error enviando push 24h' });
  }
});

/**
 * POST /api/webhook-client/timer/push-day7
 * Se activa automáticamente al llegar al Día 7.
 * Dispara la notificación de alerta final/bloqueo previo a la confirmación de pago.
 */
router.post('/timer/push-day7', async (req, res) => {
  try {
    const { userId, timerId } = req.body;

    await sendPushNotification(
      userId,
      '🚨 Plazo Vencido (Día 7)',
      'Tu plazo de subida ha vencido. Realiza tu pago o sube el Excel para continuar.',
      { timerId, type: 'PAYMENT_DEADLINE_REACHED' }
    );

    return res.status(200).json({
      success: true,
      message: 'Notificación push de Día 7 enviada correctamente.'
    });
  } catch (error) {
    console.error('Error enviando push Día 7:', error);
    return res.status(500).json({ success: false, error: 'Error enviando push Día 7' });
  }
});

module.exports = router;
