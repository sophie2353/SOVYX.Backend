const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const config = require('../config/tokens');
const sovyxDatabase = require('../modules/sovyxDatabase');

// ====================================================
// ALMACÉN DINÁMICO DE LINKS (Actualizable desde la Web/Postman)
// ====================================================
// Aquí se guardarán los links que envíes desde tu panel admin o Postman
const dynamicPaymentStore = {
  // Ej: { "1": "url...", "1000": "url...", "9000": "url...", "5000": "url..." }
};

// ----------------------------------------------------
// 1. POST /api/pagos/admin/set-link 
// (Envías el monto y el link desde tu web admin o Postman para guardarlo)
// ----------------------------------------------------
router.post('/admin/set-link', (req, res) => {
  const { amount, paymentUrl } = req.body;

  if (!amount || !paymentUrl) {
    return res.status(400).json({ error: 'Faltan datos obligatorios: amount y paymentUrl' });
  }

  const numAmount = Number(amount);
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  
  // Añadir parámetro de redirección automática al frontend para cuando Kontigo devuelva al usuario
  const redirectParam = encodeURIComponent(`${frontendUrl}/?payment=success&amount=${numAmount}`);
  const finalUrl = paymentUrl.includes('?') 
    ? `${paymentUrl}&redirect_url=${redirectParam}`
    : `${paymentUrl}?redirect_url=${redirectParam}`;

  // Guardar en el almacén en memoria
  dynamicPaymentStore[numAmount] = finalUrl;

  console.log(`[PAGOS ADMIN] Link registrado exitosamente para el monto: $${numAmount}`);

  res.json({
    status: 'SUCCESS',
    message: `Link configurado correctamente para el monto $${numAmount}`,
    storedLinks: dynamicPaymentStore
  });
});

// ----------------------------------------------------
// 2. GET /api/pagos/get-link 
// (La web del cliente consulta el link según el monto que va a pagar)
// ----------------------------------------------------
router.get('/get-link', (req, res) => {
  const amount = Number(req.query.amount || 1000);
  const paymentUrl = dynamicPaymentStore[amount];

  if (!paymentUrl) {
    return res.status(404).json({ 
      error: `No hay ningún link de pago configurado para el monto $${amount}. Regístralo primero desde el admin o Postman.` 
    });
  }

  res.json({
    status: 'SUCCESS',
    amount,
    paymentUrl
  });
});

// ----------------------------------------------------
// 3. POST /api/pagos/confirm 
// (Recibe el retorno de pago exitoso, descuenta slot y dispara CAPI de Meta)
// ----------------------------------------------------
router.post('/confirm', async (req, res) => {
  try {
    const { email, amount, clientId, transactionId } = req.body;
    
    const montoFinal = parseFloat(amount || 1000); 
    const idCliente = clientId || 'cliente_sovyx';
    const emailCliente = email || `${idCliente}@sovyx.com`;

    // A. Registrar el pago en base de datos y descontar slot
    const clienteActualizado = await sovyxDatabase.registrarCliente({
      email: emailCliente,
      montoPagado: montoFinal,
      transactionId: transactionId || `TX_${Date.now()}`,
      metodo: 'Kontigo Pay',
      fecha: new Date()
    });

    // B. Enviar evento 'Purchase' al Pixel CAPI de Meta con el valor exacto
    if (config.meta?.pixelId && config.meta?.accessToken) {
      const hashedEmail = crypto.createHash('sha256').update(emailCliente.toLowerCase().trim()).digest('hex');

      await axios.post(
        `https://graph.facebook.com/v25.0/${config.meta.pixelId}/events`,
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
      console.log(`📡 [META CAPI] Evento Purchase ($${montoFinal} USD) enviado para: ${emailCliente}`);
    }

    console.log(`🟢 [SOVYX DB] Pago de $${montoFinal} USD confirmado para ${emailCliente}.`);

    res.status(200).json({
      status: 'SUCCESS',
      mensaje: 'Pago registrado, slot descontado y Pixel notificado correctamente.',
      montoPagado: montoFinal
    });
  } catch (error) {
    console.error('🔴 Error al procesar confirmación de pago:', error.message);
    res.status(500).json({ error: 'Falla al procesar el pago en el servidor.' });
  }
});

// Alias por compatibilidad por si alguna versión anterior de app.js llama a esta ruta
router.post('/notificar-pago', (req, res) => {
  res.redirect(307, '/api/pagos/confirm');
});

module.exports = router;
