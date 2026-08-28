// routes/campaignRoutes.js
const express = require('express');
const router = express.Router();
const metaService = require('../services/metaService');

// Mapa persistente de conexiones SSE activas por cliente
const clients = new Map();

// Helper exportado para que metaService (o cualquier otro servicio) envíe datos en tiempo real
function sendSSEUpdate(sessionId, metricsData) {
  const clientRes = clients.get(sessionId);
  if (clientRes) {
    clientRes.write(`data: ${JSON.stringify({ metrics: metricsData })}\n\n`);
  }
}

// 📡 SSE Stream: GET /api/campaigns/stream?sessionId=xxx
router.get('/stream', (req, res) => {
  const sessionId = req.query.sessionId || 'default';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  clients.set(sessionId, res);

  req.on('close', () => {
    clients.delete(sessionId);
  });
});

// 📥 Recepción de Audience/Borrador: POST /api/v1/client/upload-audience
router.post('/upload-audience', async (req, res) => {
  const { sessionId, accessToken, adAccountId } = req.body;

  try {
    // Delegar todo el trabajo pesado al metaService
    const result = await metaService.processDraftAndActivate({
      sessionId,
      accessToken,
      adAccountId,
      draftData: req.body
    });

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = { router, sendSSEUpdate };
