// routes/paymentWebhook.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const config = require('../config/tokens');
const sovyxDatabase = require('../modules/sovyxDatabase');

router.post('/stripe-webhook', async (req, res) => {
  const { event, data } = req.body; // Adaptar según Stripe, MercadoPago o pasarela utilizada

  try {
    // 1. Confirmar que el pago fue exitoso
    if (event === 'payment_intent.succeeded' || data?.status === 'approved') {
      const userEmail = data.customer_email || data.email;
      const amount = data.amount || 1000;

      // 2. Restar slot en la Base de Datos SOVYX
      const slotActualizado = await sovyxDatabase.registrarCliente({
        email: userEmail,
        montoPagado: amount,
        fecha: new Date()
      });

      // 3. Disparar evento de Compra a Meta (Conversion API - CAPI)
      if (config.meta.pixelId && config.meta.accessToken) {
        await axios.post(
          `https://graph.facebook.com/v25.0/${config.meta.pixelId}/events`,
          {
            data: [
              {
                event_name: 'Purchase',
                event_time: Math.floor(Date.now() / 1000),
                action_source: 'website',
                user_data: {
                  em: [require('crypto').createHash('sha256').update(userEmail.toLowerCase()).digest('hex')]
                },
                custom_data: {
                  currency: 'USD',
                  value: amount / 100 // si viene en centavos
                }
              }
            ]
          },
          {
            params: { access_token: config.meta.accessToken }
          }
        );
      }

      return res.status(200).json({
        status: 'SUCCESS',
        mensaje: 'Slot reservado y Pixel de compra notificado',
        slotsRestantes: slotActualizado.disponibles
      });
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('🔴 Error procesando compra/Pixel:', error.message);
    res.status(500).json({ error: 'Falla al sincronizar compra con SOVYX' });
  }
});

module.exports = router;
