// routes/client.js
const express = require('express');
const router = express.Router();
const n8nService = require('../services/n8nService');

router.post('/onboarding', async (req, res) => {
  const { email, clientDataCsv, metaAdsAccountId, sessionId } = req.body;

  if (!email || !metaAdsAccountId) {
    return res.status(400).json({ error: 'Faltan campos obligatorios para iniciar la calibración.' });
  }

  try {
    // 1. Guardar en tu base de datos el registro del cliente y su cuenta de Ads
    // 2. Disparar webhook a n8n para notificar que hay un nuevo Setup de 48H listo
    await n8nService.reportarEventoWeb('lead_captured', {
      email,
      metaAdsAccountId,
      sessionId
    });

    return res.status(200).json({ 
      success: true, 
      message: 'Data recibida. Iniciando calibración de IA1 y IA3 para clonado de audiencia.' 
    });
  } catch (error) {
    console.error('Error en onboarding de cliente:', error);
    return res.status(500).json({ error: 'Error al procesar el registro.' });
  }
});

module.exports = router;
