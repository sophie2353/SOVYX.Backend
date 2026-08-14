// routes/slots.js
const express = require('express');
const metaAdsService = require('../services/metaAdsService');

// Estado en memoria del backend (O guardado en una DB simple)
let slotsState = {
  totalSlots: 4,
  takenSlots: 0,
  launchTimestamp: new Date('2026-08-14T00:00:00Z') // Ajusta la hora exacta del lanzamiento
};

// Guardar los clientes SSE conectados para enviar la señal en tiempo real
let clients = [];

// Función para notificar a todos los clientes web abiertos
const broadcastUpdates = async () => {
  const metrics = await computeMetrics();
  clients.forEach(client => client.res.write(`data: ${JSON.stringify(metrics)}\n\n`));
};

const computeMetrics = async () => {
  const metaData = await metaAdsService.getMetrics();
  
  // Calcular horas desde la publicación/lanzamiento
  const now = new Date();
  const diffMs = now - slotsState.launchTimestamp;
  const hoursLive = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60)));

  return {
    totalSlots: slotsState.totalSlots,
    remainingSlots: Math.max(0, slotsState.totalSlots - slotsState.takenSlots),
    takenSlots: slotsState.takenSlots,
    reachedClients: metaData.reach,
    totalSpentUSD: metaData.spend,
    hoursLive: hoursLive,
    timestamp: now.toISOString()
  };
};

// 1. GET: Consultar métricas actuales (para renderizar la web)
router.get('/status', async (req, res) => {
  try {
    const data = await computeMetrics();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo estado de cupos.' });
  }
});

// 2. GET: Stream Server-Sent Events (Conexión directa en vivo sin n8n)
router.get('/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const clientId = Date.now();
  const newClient = { id: clientId, res };
  clients.push(newClient);

  // Enviar el estado inicial inmediatamente al conectarse
  const initialData = await computeMetrics();
  res.write(`data: ${JSON.stringify(initialData)}\n\n`);

  req.on('close', () => {
    clients = clients.filter(client => client.id !== clientId);
  });
});

// 3. POST: Confirmación de Pago ($1,000 procesados en Stripe / Apple Pay)
// Este webhook se ejecuta cuando el cliente completa la compra inicial
router.post('/payment-success', async (req, res) => {
  const { secretKey } = req.body;

  // Verificación básica de seguridad
  if (secretKey !== process.env.PAYMENT_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  if (slotsState.takenSlots < slotsState.totalSlots) {
    slotsState.takenSlots += 1;
    
    // Transmitir inmediatamente la señal a todos los frontends conectados
    await broadcastUpdates();

    return res.status(200).json({ 
      success: true, 
      message: 'Cupo reservado con éxito.', 
      remainingSlots: slotsState.totalSlots - slotsState.takenSlots 
    });
  } else {
    return res.status(400).json({ error: 'No hay cupos disponibles.' });
  }
});

module.exports = router;
