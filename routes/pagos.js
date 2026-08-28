const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const config = require('../config/tokens');
const sovyxDatabase = require('../modules/sovyxDatabase');

// ====================================================
// MATRIZ CENTRALIZADA DE LINKS DE PAGO
// ====================================================
// Mañana solo pegas tus 6 URLs de Kontigo aquí o vía Admin
const PAYMENT_LINKS = {
  // --- MODO PRUEBA / ADMIN ---
  admin: {
    1:    "", // Link de $1 (Inicial / Slot)
    1000: "", // Link de $1 USD (Simulando 1K)
    9000: ""  // Link de $1 USD (Simulando 9K)
  },
  // --- CLIENTES REALES ---
  client: {
    1000: "", // Link Kontigo de $1,000 USD (Slot inicial)
    9000: "", // Link Kontigo de $9,000 USD (Cierre post-48h)
    5000: ""  // Link Kontigo de $5,000 USD (Mensualidad)
  }
};

// ----------------------------------------------------
// 1. POST /api/pagos/admin/set-links 
// (Para actualizar o guardar los links desde tu panel o Postman)
// ----------------------------------------------------
router.post('/admin/set-links', (req, res) => {
  const { profile, amount, paymentUrl } = req.body; // profile: 'admin' | 'client'

  if (!profile || !amount || !paymentUrl) {
    return res.status(400).json({ error: 'Faltan datos (profile, amount o paymentUrl)' });
  }

  const targetProfile = profile === 'admin' ? 'admin' : 'client';
  const numAmount = Number(amount);

  // Agregar parámetro de retorno automático a tu app
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const redirectParam = encodeURIComponent(`${frontendUrl}/?payment=success&profile=${targetProfile}&amount=${numAmount}`);
  
  const finalUrl = paymentUrl.includes('?') 
    ? `${paymentUrl}&redirect_url=${redirectParam}`
    : `${paymentUrl}?redirect_url=${redirectParam}`;

  // Guardar en la matriz
  PAYMENT_LINKS[targetProfile][numAmount] = finalUrl;

  console.log(`[PAYMENT LINK CONFIG] Perfil: ${targetProfile} | Monto: $${numAmount} -> Link Guardado`);

  res.json({
    ok: true,
    message: `Link de $${numAmount} guardado correctamente para el perfil [${targetProfile}]`,
    links: PAYMENT_LINKS
  });
});

// ----------------------------------------------------
// 2. GET /api/pagos/get-link 
// (app.js solo envía ?amount=1000&profile=client y recibe su URL al instante)
// ----------------------------------------------------
router.get('/get-link', (req, res) => {
  const amount = Number(req.query.amount || 1000);
  const profile = (req.query.profile === 'admin' || req.query.isAdmin === 'true') ? 'admin' : 'client';

  // Buscar el link en la matriz
  const paymentUrl = PAYMENT_LINKS[profile]?.[amount] || PAYMENT_LINKS.client?.[amount];

  if (!paymentUrl) {
    return res.status(404).json({ 
      error: `No hay un link de pago configurado para el perfil '${profile}' y monto $${amount}.` 
    });
  }

  res.json({
    status: 'SUCCESS',
    profile,
    amount,
    paymentUrl
  });
});

// ----------------------------------------------------
// 3. POST /api/pagos/confirm 
// (Recibe la confirmación del pago, descuenta slot y envía CAPI)
// ----------------------------------------------------
router.post('/confirm', async (req, res) => {
  try {
    const { email, amount, clientId, transactionId } = req.body;
    
    const montoFinal = parseFloat(amount || 1000); 
    const idCliente = clientId || 'cliente_sovyx';
    const emailCliente = email || `${idCliente}@sovyx.com`;

    // A. Registrar pago en MongoDB y descontar slot
    const clienteActualizado = await sovyxDatabase.registrarCliente({
      email: emailCliente,
      montoPagado: montoFinal,
      transactionId: transactionId || `TX_${Date.now()}`,
      metodo: 'Kontigo Pay',
      fecha: new Date()
    });

    // B. Notificar a Meta Pixel CAPI
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
      mensaje: 'Pago registrado y Pixel notificado con éxito.',
      montoPagado: montoFinal
    });
  } catch (error) {
    console.error('🔴 Error al procesar confirmación:', error.message);
    res.status(500).json({ error: 'Falla al procesar el pago en el servidor.' });
  }
});

module.exports = router;
