const express = require('express');
const router = express.Router();
const Client = require('../models/Client'); // Ajusta según la ubicación de tu modelo

// ============================================
// 1. CONECTAR Y GUARDAR EN MONGO
// ============================================
// POST /api/facebook/connect
router.post('/connect', async (req, res) => {
  try {
    const { userId, userAccessToken } = req.body;

    if (!userAccessToken || !userId) {
      return res.status(400).json({ error: "Faltan datos requeridos (userId o userAccessToken)" });
    }

    // 1. Graph API: Obtener Cuenta Publicitaria
    const adAccountRes = await fetch(`https://graph.facebook.com/v25.0/me/adaccounts?fields=id,name&access_token=${userAccessToken}`);
    const adAccountData = await adAccountRes.json();

    if (adAccountData.error) {
      return res.status(400).json({ error: "Error Graph API (adaccounts)", details: adAccountData.error });
    }

    const firstAccount = adAccountData.data && adAccountData.data[0];
    if (!firstAccount) {
      return res.status(404).json({ error: "No se encontraron cuentas publicitarias asociadas" });
    }

    const actId = firstAccount.id;

    // 2. Graph API: Obtener Pixel ID
    const pixelRes = await fetch(`https://graph.facebook.com/v25.0/${actId}/adspixels?fields=id,name&access_token=${userAccessToken}`);
    const pixelData = await pixelRes.json();
    const firstPixel = pixelData.data && pixelData.data[0];
    const pixelId = firstPixel ? firstPixel.id : null;

    // 3. Almacenamiento en Mongo
    const clientUpdated = await Client.findOneAndUpdate(
      { userId },
      {
        $set: {
          'meta.act_id': actId,
          'meta.pixel_id': pixelId,
          'meta.fb_token': userAccessToken,
          'meta.account_name': firstAccount.name,
          'meta.updatedAt': new Date()
        }
      },
      { new: true, upsert: true }
    );

    return res.status(200).json({
      success: true,
      message: "Credenciales de Meta guardadas exitosamente en MongoDB",
      data: clientUpdated.meta
    });

  } catch (err) {
    console.error("Error en /api/facebook/connect:", err);
    return res.status(500).json({ error: "Error interno en el servidor" });
  }
});

// ============================================
// 2. OBTENER MÉTRICAS PARA DASHBOARD
// ============================================
// GET /api/facebook/metrics/:userId
router.get('/metrics/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // 1. Buscar credenciales en Mongo
    const client = await Client.findOne({ userId });

    if (!client || !client.meta || !client.meta.act_id || !client.meta.fb_token) {
      return res.status(404).json({ 
        error: "El cliente no tiene una cuenta de Meta vinculada o faltan credenciales." 
      });
    }

    const { act_id, pixel_id, fb_token } = client.meta;

    // 2. Consulta de Insights/Métricas a Graph API
    const insightsUrl = `https://graph.facebook.com/v25.0/${act_id}/insights?fields=impressions,clicks,spend,reach,cpc,ctr,actions&date_preset=maximum&access_token=${fb_token}`;
    const insightsRes = await fetch(insightsUrl);
    const insightsData = await insightsRes.json();

    if (insightsData.error) {
      return res.status(400).json({ error: "Error al consultar Graph API", details: insightsData.error });
    }

    const metrics = insightsData.data && insightsData.data[0] ? insightsData.data[0] : {
      impressions: "0",
      clicks: "0",
      spend: "0.00",
      reach: "0",
      cpc: "0.00",
      ctr: "0.00"
    };

    return res.status(200).json({
      success: true,
      userId,
      meta: {
        act_id,
        pixel_id,
        account_name: client.meta.account_name
      },
      metrics
    });

  } catch (err) {
    console.error("Error en /api/facebook/metrics:", err);
    return res.status(500).json({ error: "Error interno al recuperar métricas" });
  }
});

// ============================================
// 3. CREAR O GESTIONAR CAMPAÑAS
// ============================================
// POST /api/facebook/campaigns
router.post('/campaigns', async (req, res) => {
  try {
    const { userId, name, objective = 'OUTCOME_TRAFFIC', status = 'PAUSED', dailyBudget } = req.body;

    if (!userId || !name) {
      return res.status(400).json({ error: "Faltan parámetros obligatorios (userId, name)" });
    }

    // 1. Buscar credenciales en Mongo
    const client = await Client.findOne({ userId });

    if (!client || !client.meta || !client.meta.act_id || !client.meta.fb_token) {
      return res.status(404).json({ error: "Credenciales de Meta no encontradas para este cliente" });
    }

    const { act_id, fb_token } = client.meta;

    // 2. Enviar creación de campaña a Graph API
    const campaignUrl = `https://graph.facebook.com/v25.0/${act_id}/campaigns`;
    const params = new URLSearchParams({
      name,
      objective,
      status,
      special_ad_categories: '[]',
      access_token: fb_token
    });

    if (dailyBudget) {
      params.append('daily_budget', dailyBudget);
    }

    const fbRes = await fetch(campaignUrl, {
      method: 'POST',
      body: params
    });

    const fbData = await fbRes.json();

    if (fbData.error) {
      return res.status(400).json({ error: "Error al crear campaña en Meta", details: fbData.error });
    }

    return res.status(200).json({
      success: true,
      message: "Campaña creada exitosamente en Meta Ads",
      campaignId: fbData.id,
      act_id
    });

  } catch (err) {
    console.error("Error en /api/facebook/campaigns:", err);
    return res.status(500).json({ error: "Error interno al procesar campaña" });
  }
});

module.exports = router;
