const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const config = require('../config/tokens');
const sovyxDatabase = require('../modules/sovyxDatabase');

// ----------------------------------------------------
// 1. GET /api/pagos/link - Genera URL de Kontigo según el monto ($1,000, $5,000 o $9,000 USD)
// ----------------------------------------------------
router.get('/link', async (req, res) => {
  try {
    const email = req.query.email || '';
    const monto = parseFloat(req.query.monto || req.query.amount || 1000);
    const slug = process.env.KONTIGO_SLUG || 'SOVYX-Slot';
    
    // Conversión a centavos ($1,000 USD = 100000 centavos)
    const amountInCents = Math.round(monto * 100); 
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const redirectUrl = `${frontendUrl}/pago-exitoso?email=${encodeURIComponent(email)}&monto=${monto}`;
    const paymentUrl = `https://app.kontigo.lat/pay/${slug}?amount=${amountInCents}&redirect_url=${encodeURIComponent(redirectUrl)}`;

    res.json({ 
      status: 'SUCCESS', 
      monto,
      amountInCents,
      paymentUrl 
    });
  } catch (error) {
    console.error('🔴 Error al generar enlace de pago:', error.message);
    res.status(500).json({ error: 'No se pudo generar el enlace de pago.' });
  }
});

// ----------------------------------------------------
// 2. POST /api/pagos/notificar-pago - Recibe Confirmación (Descuenta Slot + Dispara CAPI)
// ----------------------------------------------------
router.post('/notificar-pago', async (req, res) => {
  try {
    const { email, monto, transactionId } = req.body;
    const montoFinal = parseFloat(monto || 1000);

    if (!email) {
      return res.status(400).json({ error: 'El email del cliente es obligatorio para procesar el pago.' });
    }

    // A. Descontar slot (pasa de 2 a 1) y registrar cliente en MongoDB
    const clienteActualizado = await sovyxDatabase.registrarCliente({
      email,
      montoPagado: montoFinal,
      transactionId: transactionId || `TX_${Date.now()}`,
      metodo: 'Kontigo Pay',
      fecha: new Date()
    });

    // B. Enviar evento 'Purchase' al Pixel CAPI de Meta con el monto exacto abonado
    if (config.meta?.pixelId && config.meta?.accessToken) {
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
              custom_data: { 
                currency: 'USD', 
                value: montoFinal,
                order_id: transactionId || `SOVYX_${Date.now()}`
              }
            }
          ]
        },
        { params: { access_token: config.meta.accessToken } }
      );
      console.log(`📡 [META CAPI] Evento Purchase ($${montoFinal} USD) enviado para: ${email}`);
    }

    console.log(`🟢 [SOVYX DB] Pago registrado. Slots disponibles: ${clienteActualizado?.disponibles ?? 1}`);

    res.status(200).json({
      status: 'SUCCESS',
      mensaje: 'Pago registrado, slot descontado y Pixel notificado correctamente.',
      montoPagado: montoFinal,
      slotsRestantes: clienteActualizado?.disponibles ?? 1
    });
  } catch (error) {
    console.error('🔴 Error al procesar pago:', error.message);
    res.status(500).json({ error: 'Falla al procesar el pago en el servidor.' });
  }
});

module.exports = router;
