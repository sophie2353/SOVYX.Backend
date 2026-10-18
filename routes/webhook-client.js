const express = require('express');
const router = express.Router();
const webpush = require('web-push');
const Client = require('../models/clients'); // Modelo donde guardamos la suscripción push del usuario

// =========================================================================
// CONFIGURACIÓN VAPID (Variables de entorno)
// Si no están configuradas, se muestra advertencia en logs
// =========================================================================
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:soporte@sodie.ai';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
} else {
  console.warn('⚠️ [PUSH] VAPID Keys no configuradas en variables de entorno. WebPush nativo desactivado.');
}

/**
 * Endpoint para expone la clave pública VAPID al cliente para la suscripción nativa
 */
router.get('/vapid-public-key', (req, res) => {
  return res.json({ publicKey: VAPID_PUBLIC_KEY });
});

/**
 * Endpoint para que el cliente guarde la suscripción nativa del navegador post-permiso
 */
router.post('/save-subscription', async (req, res) => {
  try {
    const { userId, clientId, subscription } = req.body;
    const activeClientId = clientId || userId;

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ success: false, error: 'Suscripción inválida' });
    }

    await Client.findOneAndUpdate(
      { clientId: activeClientId },
      { $set: { pushSubscription: subscription, pushEnabled: true } },
      { upsert: true, new: true }
    );

    return res.json({ success: true, message: 'Suscripción push guardada correctamente en el backend' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Helper interno para enviar notificación push vía web-push nativo
 */
const sendPushNotification = async (userId, title, body, data = {}) => {
  console.log(`[PUSH INITIATED] User: ${userId} | Title: "${title}" | Body: "${body}"`);

  try {
    // Buscar la suscripción nativa guardada para el cliente
    const clientDoc = await Client.findOne({ $or: [{ clientId: userId }, { userId: userId }] });

    if (!clientDoc || !clientDoc.pushSubscription) {
      console.warn(`⚠️ [PUSH] No se encontró suscripción push nativa para ${userId}`);
      return false;
    }

    const payload = JSON.stringify({
      title,
      body,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      data
    });

    if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
      await webpush.sendNotification(clientDoc.pushSubscription, payload);
      console.log(`✅ [PUSH DELIVERED] Notificación WebPush enviada con éxito a ${userId}`);
      return true;
    } else {
      console.log(`📱 [PUSH SIMULATED] ${payload}`);
      return true;
    }
  } catch (err) {
    console.error(`💥 Error enviando WebPush a ${userId}:`, err.message);
    return false;
  }
};

/**
 * POST /api/webhook-client/timer/push-24h
 * Se mantiene el nombre de la ruta para compatibilidad, pero dispara la alerta de 72 HORAS.
 */
router.post('/timer/push-24h', async (req, res) => {
  try {
    const { userId, timerId } = req.body;

    await sendPushNotification(
      userId,
      '⏳ Ventana de 72 Horas Activa',
      'Tu ciclo de 72 horas para actualizar tu segmentación o confirmar tu campaña está en marcha.',
      { timerId, type: 'REQUIRE_PAYMENT_OR_EXCEL_72H', cycleHours: 72 }
    );

    return res.status(200).json({
      success: true,
      message: 'Notificación push de ciclo de 72h enviada correctamente.'
    });
  } catch (error) {
    console.error('Error enviando push 72h:', error);
    return res.status(500).json({ success: false, error: 'Error enviando push de 72h' });
  }
});

/**
 * POST /api/webhook-client/timer/push-day7
 * Alerta final de renovación de ciclo.
 */
router.post('/timer/push-day7', async (req, res) => {
  try {
    const { userId, timerId } = req.body;

    await sendPushNotification(
      userId,
      '🚨 Fin de Ciclo (Día 7)',
      'Tu plazo de subida y configuración ha finalizado. Actualiza tus datos para reactivar las métricas.',
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
