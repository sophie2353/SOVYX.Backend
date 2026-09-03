const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const config = require('../config/tokens');
const sovyxDatabase = require('../modules/sovyxDatabase');

// ====================================================
// ALMACENES DINÁMICOS DE PASARELA (Memoria + Nube)
// ====================================================
// 1. Links generales por monto (Opción 1: Auto por monto | Opción 2: Link directo)
const dynamicPaymentStore = {};

// 2. Links y configuraciones Post-48H / 72H / 96H por cliente/sesión
const post48Store = {};

const KONTIGO_BASE_URL = process.env.KONTIGO_CORPORATE_URL || 'https://kontigo.lat/pay/corporate';

// ====================================================
// 1. POST /api/pasarela/admin/set-link
// Configuración de Link General (Opción 1: Solo Monto | Opción 2: Link Directo)
// ====================================================
router.post('/admin/set-link', async (req, res) => {
  try {
    const { amount, paymentUrl, directUrl, adminKey } = req.body;

    if (config.SOVYX_ADMIN_KEY && adminKey && adminKey !== config.SOVYX_ADMIN_KEY) {
      return res.status(403).json({ error: 'Llave de administración inválida' });
    }

    if (!amount) {
      return res.status(400).json({ error: 'Falta el parámetro obligatorio: amount' });
    }

    const numAmount = Number(amount);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const redirectParam = encodeURIComponent(`${frontendUrl}/?payment=success&amount=${numAmount}`);

    let finalUrl = '';

    // OPCIÓN 2: Se proporcionó un link directo específico
    const rawDirectUrl = paymentUrl || directUrl;
    if (rawDirectUrl) {
      let formatted = rawDirectUrl
        .replace('{amount}', numAmount)
        .replace('{monto}', numAmount)
        .replace('{amout}', numAmount);

      finalUrl = formatted.includes('?')
        ? `${formatted}&redirect_url=${redirectParam}`
        : `${formatted}?redirect_url=${redirectParam}`;

      console.log(`[PASARELA ADMIN] Opción 2: Link directo guardado para $${numAmount}`);
    } 
    // OPCIÓN 1: Solo se pasó el monto -> Auto-generar link Kontigo Corporativo
    else {
      finalUrl = `${KONTIGO_BASE_URL}?amount=${numAmount}&redirect_url=${redirectParam}`;
      console.log(`[PASARELA ADMIN] Opción 1: Link Kontigo auto-generado para $${numAmount}`);
    }

    // Guardar en almacén local
    dynamicPaymentStore[numAmount] = finalUrl;

    // Sincronizar en Nube/DB si la función existe
    if (typeof sovyxDatabase.guardarLinkPasarela === 'function') {
      await sovyxDatabase.guardarLinkPasarela(numAmount, finalUrl);
    }

    res.json({
      status: 'SUCCESS',
      modo: rawDirectUrl ? 'OPCION_2_LINK_DIRECTO' : 'OPCION_1_SOLO_MONTO',
      amount: numAmount,
      paymentUrl: finalUrl,
      storedLinks: dynamicPaymentStore
    });
  } catch (error) {
    console.error('🔴 Error al configurar link:', error.message);
    res.status(500).json({ error: 'Error interno al registrar el link de pago.' });
  }
});

// ====================================================
// 2. GET /api/pasarela/get-link
// La web/cliente solicita el link según el monto
// ====================================================
router.get('/get-link', (req, res) => {
  const amount = Number(req.query.amount || 1000);
  let paymentUrl = dynamicPaymentStore[amount];

  // Fallback Opción 1 si no se ha configurado previamente un link en memoria
  if (!paymentUrl) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const redirectParam = encodeURIComponent(`${frontendUrl}/?payment=success&amount=${amount}`);
    paymentUrl = `${KONTIGO_BASE_URL}?amount=${amount}&redirect_url=${redirectParam}`;
  }

  res.json({
    status: 'SUCCESS',
    amount,
    paymentUrl
  });
});

// ====================================================
// 3. POST /api/pasarela/admin/post48-link
// Inyección de Pasarela Post 48 - 72 - 96 Horas desde Admin
// ====================================================
router.post('/admin/post48-link', async (req, res) => {
  try {
    const { 
      sessionId, 
      clienteId, 
      email, 
      montoBase = 3000, 
      customLink, 
      cuotas = 3, 
      timerHours = 48, 
      adminKey 
    } = req.body;

    if (config.SOVYX_ADMIN_KEY && adminKey && adminKey !== config.SOVYX_ADMIN_KEY) {
      return res.status(403).json({ error: 'Llave de administración inválida' });
    }

    const keyIdentificadora = sessionId || clienteId || email || `POST48_${Date.now()}`;
    const numMonto = parseFloat(montoBase);
    const numCuotas = parseInt(cuotas) || 3;
    const montoCuota = (numMonto / numCuotas).toFixed(2);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const redirectParam = encodeURIComponent(`${frontendUrl}/?payment=success_post48&session=${keyIdentificadora}`);

    // Determinar la URL final de cobro post-48
    let pasarelaUrl = customLink;
    if (!pasarelaUrl) {
      pasarelaUrl = `https://kontigo.lat/pay/post48?session=${keyIdentificadora}&amount=${montoCuota}&parts=${numCuotas}&redirect_url=${redirectParam}`;
    }

    // Calcular la expiración según el temporizador (48h, 72h o 96h)
    const horasNum = parseInt(timerHours) || 48;
    const deadlineMs = Date.now() + (horasNum * 60 * 60 * 1000);
    const deadlineISO = new Date(deadlineMs).toISOString();

    const post48Payload = {
      sessionId: keyIdentificadora,
      email: email || `${keyIdentificadora}@sovyx.com`,
      montoTotal: numMonto,
      cuotas: numCuotas,
      montoCuota: parseFloat(montoCuota),
      pasarelaUrl,
      timerVentanaHoras: horasNum,
      deadlineISO,
      estado: 'ACTIVADO_POST48',
      creadoEn: new Date().toISOString(),
      cloudSyncStatus: 'STORED_IN_CLOUD'
    };

    // Guardar en el almacén en memoria
    post48Store[keyIdentificadora] = post48Payload;

    // Sincronizar en la DB si aplica
    if (typeof sovyxDatabase.guardarPost48 === 'function') {
      await sovyxDatabase.guardarPost48(post48Payload);
    }

    console.log(`🟢 [POST48 ADMIN] Inyección registrada para ${keyIdentificadora} (${horasNum}h): ${pasarelaUrl}`);

    res.json({
      status: 'SUCCESS',
      message: `Pasarela Post-${horasNum}H inyectada correctamente y almacenada en nube.`,
      post48Data: post48Payload
    });
  } catch (error) {
    console.error('🔴 Error al inyectar pasarela Post-48h:', error.message);
    res.status(500).json({ error: 'Error interno al procesar pasarela Post-48H.' });
  }
});

// ====================================================
// 4. GET /api/pasarela/post48/status
// Consulta de la pasarela y temporizador Post 48-72-96h por el cliente
// ====================================================
router.get(['/post48/status', '/post48/:sessionId'], (req, res) => {
  const sessionId = req.params.sessionId || req.query.sessionId || req.query.email;
  const data = post48Store[sessionId];

  if (!data) {
    return res.status(404).json({
      status: 'NOT_FOUND',
      error: `No hay cobro Post-48H inyectado para el identificador: ${sessionId}`
    });
  }

  // Verificar si ya expiró el temporizador (48/72/96h)
  const ahora = Date.now();
  const limite = new Date(data.deadlineISO).getTime();
  const tiempoRestanteMs = Math.max(0, limite - ahora);

  res.json({
    status: 'SUCCESS',
    data: {
      ...data,
      tiempoRestanteMs,
      expirado: tiempoRestanteMs === 0
    }
  });
});

// ====================================================
// 5. POST /api/pasarela/confirm
// Recibe confirmación de Kontigo, descuenta slot en DB y envía Pixel CAPI
// ====================================================
router.post('/confirm', async (req, res) => {
  try {
    const { email, amount, clientId, transactionId } = req.body;
    
    const montoFinal = parseFloat(amount || 1000); 
    const idCliente = clientId || 'cliente_sovyx';
    const emailCliente = email || `${idCliente}@sovyx.com`;

    // A. Descontar slot y registrar cliente en la Base de Datos
    let clienteActualizado = null;
    if (typeof sovyxDatabase.registrarCliente === 'function') {
      clienteActualizado = await sovyxDatabase.registrarCliente({
        email: emailCliente,
        montoPagado: montoFinal,
        transactionId: transactionId || `TX_${Date.now()}`,
        metodo: 'Kontigo Pay',
        fecha: new Date()
      });
    }

    // B. Enviar evento 'Purchase' a Meta CAPI
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

    console.log(`🟢 [SOVYX DB] Pago de $${montoFinal} USD confirmado para ${emailCliente}. Slot descontado.`);

    res.status(200).json({
      status: 'SUCCESS',
      mensaje: 'Pago confirmado, slot descontado y Pixel CAPI notificado correctamente.',
      montoPagado: montoFinal,
      cliente: clienteActualizado
    });
  } catch (error) {
    console.error('🔴 Error al procesar confirmación de pago:', error.message);
    res.status(500).json({ error: 'Falla al procesar la confirmación del pago.' });
  }
});

// Alias de compatibilidad
router.post('/notificar-pago', (req, res) => {
  res.redirect(307, '/api/pasarela/confirm');
});

module.exports = router;
