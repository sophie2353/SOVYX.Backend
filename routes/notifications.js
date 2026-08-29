const express = require('express');
const router = express.Router();
const webpush = require('web-push');

// Configurar las llaves VAPID en web-push
webpush.setVapidDetails(
  'mailto:soporte@tudominio.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// POST /api/v1/notifications/subscribe
router.post('/subscribe', async (req, res) => {
  try {
    const subscription = req.body; // Objeto PushSubscription enviado por el frontend
    const userId = req.user?.id;   // Opcional: ID del usuario autenticado

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Objeto de suscripción inválido.' });
    }

    // 1. Guardar o actualizar la suscripción en la BD
    // Ejemplo:
    // await db.UserSubscription.upsert({
    //   userId,
    //   endpoint: subscription.endpoint,
    //   keys: subscription.keys
    // });

    console.log('Suscripción push registrada:', subscription.endpoint);

    res.status(201).json({ message: 'Suscripción guardada con éxito.' });
  } catch (error) {
    console.error('Error guardando la suscripción:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
