const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const config = require('../config/tokens');
const sovyxDatabase = require('../modules/sovyxDatabase');

// POST /api/webhooks/kontigo
router.post('/kontigo', async (req, res) => {
  try {
    const payload = req.body;
    const status = (payload.status || payload.event || '').toUpperCase();
    const esExitoso = ['APPROVED', 'COMPLETED', 'PAID', 'SUCCESS'].includes(status);

    if (esExitoso) {
      const email = payload.customer_email || payload.email || 'cliente@sovyx.com';
      const monto = payload.amount || 1000;

      // 1. Restar Slot en MongoDB
      const slotActualizado = await sovyxDatabase.registrarCliente({
        email,
        montoPagado: monto,
        referencia: payload.id || payload.reference,
        metodo: 'Kontigo Link',
        fecha: new Date()
      });

      // 2. Notificar al Pixel de Meta (Conversion API)
      if (config.meta.pixelId && config.meta.accessToken) {
        const hashedEmail = crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');

        await axios.post(
          `https://graph.facebook.com/v19.0/${config.meta.pixelId}/events`,
          {
            data: [
              {
                event_name: 'Purchase',
                event_time: Math.floor(Date.now() / 1000),
                action_source: 'website',
                user_data: { em: [hashedEmail] },
                custom_data: { currency: 'USD', value: monto }
              }
            ]
          },
          { params: { access_token: config.meta.accessToken } }
        );
      }

      console.log(`🟢 [SOVYX DB] Slot reservado para: ${email}`);
      return res.status(200).json({ status: 'OK', slotsRestantes: slotActualizado.disponibles });
    }

    res.status(200).json({ status: 'IGNORED' });
  } catch (error) {
    console.error('🔴 Error en Webhook Kontigo:', error.message);
    res.status(500).json({ error: 'Falla al procesar notificación' });
  }
});

module.exports = router;
