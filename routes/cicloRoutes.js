const express = require('express');
const router = express.Router();
const axios = require('axios');
const sessionsDB = require('../config/db');

router.post('/iniciar-ciclo', async (req, res) => {
  const { sessionId, borradorNombre } = req.body;
  const session = sessionsDB[sessionId];

  if (!session || !session.fbAccessToken) {
    return res.status(400).json({ error: 'Falta vinculación con Meta Ads' });
  }

  try {
    // A. Consultar Ad Accounts
    const meRes = await axios.get(`https://graph.facebook.com/v19.0/me/adaccounts?access_token=${session.fbAccessToken}`);
    const adAccountId = meRes.data.data[0]?.id;

    // B. Buscar AdSet del borrador "Prueba Hora 24"
    const adSetsRes = await axios.get(`https://graph.facebook.com/v19.0/${adAccountId}/adsets`, {
      params: {
        fields: 'id,name',
        access_token: session.fbAccessToken
      }
    });

    const targetName = borradorNombre || "Prueba Hora 24";
    const draftAdSet = adSetsRes.data.data.find(set => set.name === targetName);

    if (!draftAdSet) {
      return res.status(404).json({ error: `Borrador "${targetName}" no encontrado en Meta` });
    }

    // C. Inyectar audiencia procesada
    await axios.post(`https://graph.facebook.com/v19.0/${draftAdSet.id}`, {
      targeting: session.targetingData,
      access_token: session.fbAccessToken
    });

    res.json({ ok: true, adSetId: draftAdSet.id, status: 'INJECTED' });
  } catch (err) {
    console.error('Error inyectando en borrador:', err.response?.data || err.message);
    res.status(500).json({ error: 'Error de comunicación con la Graph API de Meta' });
  }
});

module.exports = router;
