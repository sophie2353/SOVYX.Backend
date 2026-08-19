const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const config = require('../config/tokens');
const sovyxDatabase = require('../modules/sovyxDatabase');

// ----------------------------------------------------
// GET /api/pagos/link - Genera la URL oficial de Kontigo
// ----------------------------------------------------
router.get('/link', (req, res) => {
  const email = req.query.email || '';
  const slug = process.env.KONTIGO_SLUG || 'SOVYX-Slot';
  const amount = 100000; // $1,000.00 USD en centavos (según especificación de Kontigo)
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  
  const redirectUrl = `${frontendUrl}/pago-exitoso?email=${encodeURIComponent(email)}`;
  const paymentUrl = `https://app.kontigo.lat/pay/${slug}?amount=${amount}&redirect_url=${encodeURIComponent(redirectUrl)}`;

  res.json({ status: 'SUCCESS', paymentUrl });
});

// ----------------------------------------------------
// POST /api/pagos/confirmar-pago - Procesa el registro y Meta Pixel CAPI
// ----------------------------------------------------
router.post('/confirmar-pago', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'El email es obligatorio para confirmar la reserva del slot.' });
    }

    // 1. Restar el slot en MongoDB
    const slotActualizado = await sovyxDatabase.registrarCliente({
      email,
      montoPagado: 1000,
      metodo: 'Kontigo Pay',
      fecha: new Date()
    });

    // 2. Notificar la compra al Pixel de Meta (Conversion API)
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
              custom_data: { currency: 'USD', value: 1000 }
            }
          ]
        },
        { params: { access_token: config.meta.accessToken } }
      );
    }

    console.log(`🟢 [SOVYX DB] Slot reservado con éxito para: ${email}`);

    res.status(200).json({
      status: 'SUCCESS',
      mensaje: 'Slot reservado correctamente y Pixel notificado.',
      slotsRestantes: slotActualizado.disponibles
    });
  } catch (error) {
    console.error('🔴 Error al confirmar pago:', error.message);
    res.status(500).json({ error: 'Falla al procesar la confirmación del pago en la base de datos.' });
  }
});

module.exports = router;
