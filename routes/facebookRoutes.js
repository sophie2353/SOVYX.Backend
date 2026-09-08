const express = require('express');
const router = express.Router();
const Client = require('../models/Client'); // Ajusta según la ubicación de tu modelo
const tokens = require('../config/tokens'); // Configuración centralizada de tokens y claves
const metaServices = require('../services/metaService'); // Servicio de Meta Ads

// Normalización tomando los valores del objeto `meta` exportado en config/tokens.js
const FB_CONFIG = {
  MY_ACT_ID: tokens.meta?.accountId || '',
  MY_ACCESS_TOKEN: tokens.meta?.accessToken || '',
  DEFAULT_PIXEL_ID: tokens.meta?.pixelId || null
};

// ============================================
// 1. CONECTAR Y GUARDAR EN MONGO
// ============================================
// POST /api/facebook/connect
router.post('/connect', async (req, res) => {
  try {
    const { userId, userAccessToken } = req.body;
    const tokenToUse = userAccessToken || FB_CONFIG.MY_ACCESS_TOKEN;

    if (!userId && !tokenToUse) {
      return res.status(400).json({ success: false, error: "Faltan datos requeridos (userId o userAccessToken)" });
    }

    let actId = FB_CONFIG.MY_ACT_ID;
    let pixelId = FB_CONFIG.DEFAULT_PIXEL_ID;
    let accountName = "Cuenta Meta Ads";

    try {
      const adAccountRes = await fetch(`https://graph.facebook.com/v25.0/me/adaccounts?fields=id,name&access_token=${tokenToUse}`);
      const adAccountData = await adAccountRes.json();

      if (!adAccountData.error && adAccountData.data && adAccountData.data.length > 0) {
        const firstAccount = adAccountData.data[0];
        actId = firstAccount.id;
        accountName = firstAccount.name;

        const pixelRes = await fetch(`https://graph.facebook.com/v25.0/${actId}/adspixels?fields=id,name&access_token=${tokenToUse}`);
        const pixelData = await pixelRes.json();
        if (pixelData.data && pixelData.data[0]) {
          pixelId = pixelData.data[0].id;
        }
      }
    } catch (apiErr) {
      console.warn("Advertencia al consultar Graph API en /connect, usando defaults:", apiErr);
    }

    let clientMeta = { act_id: actId, pixel_id: pixelId, account_name: accountName };
    if (userId) {
      const clientUpdated = await Client.findOneAndUpdate(
        { userId },
        {
          $set: {
            'meta.act_id': actId,
            'meta.pixel_id': pixelId,
            'meta.fb_token': tokenToUse,
            'meta.account_name': accountName,
            'meta.updatedAt': new Date()
          }
        },
        { new: true, upsert: true }
      );
      if (clientUpdated && clientUpdated.meta) clientMeta = clientUpdated.meta;
    }

    return res.status(200).json({
      success: true,
      message: "Credenciales de Meta guardadas exitosamente",
      data: clientMeta,
      connection: clientMeta
    });

  } catch (err) {
    console.error("Error en /api/facebook/connect:", err);
    return res.status(500).json({ success: false, error: "Error interno en el servidor" });
  }
});

// ============================================
// 2. OBTENER MÉTRICAS PARA DASHBOARD
// ============================================

async function fetchInsightsForUser(targetUserId, customActId, customToken) {
  let act_id = customActId;
  let fb_token = customToken;
  let account_name = "Meta Account";
  let pixel_id = FB_CONFIG.DEFAULT_PIXEL_ID;

  if (targetUserId) {
    const client = await Client.findOne({ userId: targetUserId });
    if (client && client.meta) {
      if (client.meta.act_id) act_id = client.meta.act_id;
      if (client.meta.fb_token) fb_token = client.meta.fb_token;
      if (client.meta.account_name) account_name = client.meta.account_name;
      if (client.meta.pixel_id) pixel_id = client.meta.pixel_id;
    }
  }

  act_id = act_id || FB_CONFIG.MY_ACT_ID;
  fb_token = fb_token || FB_CONFIG.MY_ACCESS_TOKEN;

  if (!act_id || !fb_token) {
    throw new Error("No hay un act_id o token configurado en tokens.js o BD.");
  }

  const fields = 'impressions,clicks,spend,reach,cpc,ctr,actions';
  const insightsUrl = `https://graph.facebook.com/v25.0/${act_id}/insights?fields=${fields}&date_preset=last_30d&access_token=${fb_token}`;
  
  const insightsRes = await fetch(insightsUrl);
  const insightsData = await insightsRes.json();

  if (insightsData.error) {
    throw new Error(insightsData.error.message || "Error al consultar Graph API");
  }

  const rawMetrics = insightsData.data && insightsData.data[0] ? insightsData.data[0] : {};
  const actions = rawMetrics.actions || [];

  const formattedMetrics = {
    impressions: parseInt(rawMetrics.impressions || 0, 10),
    clicks: parseInt(rawMetrics.clicks || 0, 10),
    spend: parseFloat(rawMetrics.spend || 0).toFixed(2),
    reach: parseInt(rawMetrics.reach || 0, 10),
    cpc: parseFloat(rawMetrics.cpc || 0).toFixed(2),
    ctr: parseFloat(rawMetrics.ctr || 0).toFixed(2),
    leads: parseInt(actions.find(a => a.action_type === 'lead')?.value || 0, 10),
    purchases: parseInt(actions.find(a => a.action_type === 'purchase')?.value || 0, 10)
  };

  return {
    userId: targetUserId,
    meta: { act_id, pixel_id, account_name },
    metrics: formattedMetrics
  };
}

// GET /api/facebook/metrics/:userId
router.get('/metrics/:userId?', async (req, res) => {
  try {
    const userId = req.params.userId || req.query.userId;
    const result = await fetchInsightsForUser(userId, req.query.act_id, req.query.access_token);

    return res.status(200).json({
      success: true,
      userId: result.userId,
      meta: result.meta,
      data: result.metrics,
      metrics: result.metrics
    });
  } catch (err) {
    console.error("Error en /api/facebook/metrics:", err);
    return res.status(500).json({ success: false, error: err.message || "Error interno al recuperar métricas" });
  }
});

// GET /api/facebook/campaigns/user?userId=...
router.get('/campaigns/user', async (req, res) => {
  try {
    const userId = req.query.userId;
    const result = await fetchInsightsForUser(userId, req.query.act_id, req.query.access_token);

    return res.status(200).json({
      success: true,
      userId: result.userId,
      meta: result.meta,
      data: result.metrics,
      metrics: result.metrics
    });
  } catch (err) {
    console.error("Error en /api/facebook/campaigns/user:", err);
    return res.status(500).json({ success: false, error: err.message || "Error interno al recuperar campañas" });
  }
});

// ============================================
// 3. CREAR O GESTIONAR CAMPAÑAS (DELEGADO A METASERVICE)
// ============================================
// POST /api/facebook/campaigns
router.post('/campaigns', async (req, res) => {
  try {
    const { 
      userId, 
      name = "Prueba Hora 24", 
      objective = 'OUTCOME_TRAFFIC', 
      status = 'PAUSED', 
      dailyBudget, 
      targeting,
      usersPayload,
      countriesFound 
    } = req.body;

    let act_id = FB_CONFIG.MY_ACT_ID;
    let fb_token = FB_CONFIG.MY_ACCESS_TOKEN;
    let pixel_id = FB_CONFIG.DEFAULT_PIXEL_ID;

    if (userId) {
      const client = await Client.findOne({ userId });
      if (client && client.meta) {
        if (client.meta.act_id) act_id = client.meta.act_id;
        if (client.meta.fb_token) fb_token = client.meta.fb_token;
        if (client.meta.pixel_id) pixel_id = client.meta.pixel_id;
      }
    }

    // Delegación completa a metaServices
    const campaignResult = await metaServices.createDraftCampaign({
      actId: act_id,
      token: fb_token,
      pixelId: pixel_id,
      name,
      objective,
      status,
      dailyBudget,
      targeting,
      usersPayload,
      countriesFound
    });

    return res.status(200).json({
      success: true,
      message: "Campaña borrador creada y procesada exitosamente en Meta Ads",
      data: campaignResult
    });

  } catch (err) {
    console.error("Error en /api/facebook/campaigns:", err);
    return res.status(500).json({ success: false, error: err.message || "Error interno al procesar campaña" });
  }
});

module.exports = router;
