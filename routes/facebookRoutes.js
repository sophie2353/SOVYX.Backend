const express = require('express');
const router = express.Router();
const Client = require('../models/Client');
const tokens = require('../config/tokens');
const metaService = require('../services/metaService');

// Configuración centralizada de fallback (Admin) desde config/tokens.js
const FB_CONFIG = {
  MY_ACT_ID: tokens.meta?.accountId || process.env.META_MASTER_ACT_ID || '',
  MY_ACCESS_TOKEN: tokens.meta?.accessToken || process.env.META_MASTER_ACCESS_TOKEN || '',
  DEFAULT_PIXEL_ID: tokens.meta?.pixelId || process.env.META_DEFAULT_PIXEL_ID || null,
  REDIRECT_URI: process.env.META_REDIRECT_URI || 'https://tu-dominio.com/confirmacionauth'
};

/**
 * Helper para obtener las credenciales de Meta desde Mongo o aplicar fallback a tokens.js (Admin)
 */
async function getUserMetaContext(userId, sessionId) {
  let act_id = FB_CONFIG.MY_ACT_ID;
  let fb_token = FB_CONFIG.MY_ACCESS_TOKEN;
  let pixel_id = FB_CONFIG.DEFAULT_PIXEL_ID;
  let account_name = "Meta Account";

  if (userId || sessionId) {
    const query = userId ? { userId } : { sessionId };
    const client = await Client.findOne(query);
    if (client && client.meta) {
      if (client.meta.act_id) act_id = client.meta.act_id;
      if (client.meta.fb_token) fb_token = client.meta.fb_token;
      if (client.meta.pixel_id) pixel_id = client.meta.pixel_id;
      if (client.meta.account_name) account_name = client.meta.account_name;
    }
  }

  return {
    act_id: act_id ? act_id.replace(/^act_/, '') : '',
    fb_token,
    pixel_id,
    account_name
  };
}

// ============================================
// 1. CONEXIÓN Y REDIRECCIÓN OAUTH CON META
// ============================================
router.post('/connect', async (req, res) => {
  try {
    const { userId, sessionId, userAccessToken } = req.body;
    const tokenToUse = userAccessToken || FB_CONFIG.MY_ACCESS_TOKEN;

    if (!userId && !sessionId && !tokenToUse) {
      return res.status(400).json({ success: false, error: "Faltan datos requeridos (userId / sessionId o token)" });
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
      console.warn("⚠️ Advertencia al consultar Graph API en /connect:", apiErr.message);
    }

    let clientMeta = { act_id: actId, pixel_id: pixelId, account_name: accountName };
    const targetQuery = userId ? { userId } : { sessionId };

    if (userId || sessionId) {
      const clientUpdated = await Client.findOneAndUpdate(
        targetQuery,
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
      message: "Credenciales de Meta vinculadas correctamente.",
      redirectUri: FB_CONFIG.REDIRECT_URI,
      data: clientMeta
    });

  } catch (err) {
    console.error("❌ Error en /api/facebook/connect:", err);
    return res.status(500).json({ success: false, error: "Error interno al conectar con Meta." });
  }
});

// ============================================
// 2. CREACIÓN DE BORRADOR (PROCESAR EXCEL + LAL + PAUSED)
// ============================================
router.post('/crear-borrador', async (req, res) => {
  try {
    const { 
      userId, 
      sessionId, 
      usersPayload, 
      countriesFound, 
      dataSegmentacion, 
      dailyBudget 
    } = req.body;

    const metaCtx = await getUserMetaContext(userId, sessionId);

    if (!metaCtx.act_id || !metaCtx.fb_token) {
      return res.status(400).json({ 
        success: false, 
        error: "No se encontró act_id o fb_token guardado para este usuario." 
      });
    }

    // Crear la estructura de la campaña en Meta en estado PAUSED (Borrador)
    const borradorResult = await metaService.crearCampanaVentas({
      actId: metaCtx.act_id,
      token: metaCtx.fb_token,
      pixelId: metaCtx.pixel_id,
      name: "Prueba Hora 24",
      status: "PAUSED",
      dailyBudget: dailyBudget || 1000,
      targeting: dataSegmentacion,
      usersPayload,
      countriesFound
    });

    // Guardar el id de la campaña en la base de datos del cliente
    if (userId || sessionId) {
      await Client.findOneAndUpdate(
        userId ? { userId } : { sessionId },
        { $set: { 'meta.lastCampaignId': borradorResult.campaignId, 'meta.status': 'PAUSED' } }
      );
    }

    // URL para redirigir directamente al panel de Meta Ads del usuario
    const metaAdsManagerUrl = `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${metaCtx.act_id}&selected_campaign_ids=${borradorResult.campaignId}`;

    return res.status(200).json({
      success: true,
      message: "Borrador de 'Prueba Hora 24' creado exitosamente en Meta Ads. Esperando que el usuario suba sus creativos.",
      act_id: metaCtx.act_id,
      campaignId: borradorResult.campaignId,
      metaAdsManagerUrl,
      redirectUri: `${FB_CONFIG.REDIRECT_URI}?step=confirmacion_borrador&campaignId=${borradorResult.campaignId}`
    });

  } catch (err) {
    console.error("❌ Error en /api/facebook/crear-borrador:", err);
    return res.status(500).json({ success: false, error: err.message || "Error al generar borrador en Meta." });
  }
});

// ============================================
// 3. CONFIRMAR ACTIVACIÓN Y REDIRECCIÓN AL DASHBOARD
// ============================================
router.post('/confirmar-activacion', async (req, res) => {
  try {
    const { userId, sessionId, campaignId } = req.body;
    const metaCtx = await getUserMetaContext(userId, sessionId);

    const targetCampaignId = campaignId || (await Client.findOne(userId ? { userId } : { sessionId }))?.meta?.lastCampaignId;

    if (!targetCampaignId) {
      return res.status(400).json({ success: false, error: "No se encontró ID de campaña para verificar." });
    }

    // Consultar el estado directamente a Meta Graph API
    const campaignRes = await fetch(`https://graph.facebook.com/v25.0/${targetCampaignId}?fields=status,name&access_token=${metaCtx.fb_token}`);
    const campaignData = await campaignRes.json();

    if (campaignData.error) {
      throw new Error(`Meta API Error: ${campaignData.error.message}`);
    }

    const isActive = campaignData.status === 'ACTIVE';

    if (isActive) {
      await Client.findOneAndUpdate(
        userId ? { userId } : { sessionId },
        { $set: { 'meta.status': 'ACTIVE', 'meta.activatedAt': new Date() } }
      );
    }

    return res.status(200).json({
      success: true,
      status: campaignData.status,
      isActive,
      message: isActive ? "Campaña activa. Redirigiendo al Dashboard de Métricas." : "La campaña aún sigue en PAUSED. Por favor completa la configuración en Meta Ads Manager.",
      redirectToDashboard: isActive
    });

  } catch (err) {
    console.error("❌ Error en /api/facebook/confirmar-activacion:", err);
    return res.status(500).json({ success: false, error: err.message || "Error al confirmar activación." });
  }
});

// ============================================
// 4. OBTENER MÉTRICAS PARA EL DASHBOARD
// ============================================
router.get('/metrics/:userId?', async (req, res) => {
  try {
    const userId = req.params.userId || req.query.userId;
    const sessionId = req.query.sessionId;

    const metaCtx = await getUserMetaContext(userId, sessionId);

    // Buscar borrador o campaña activa "Prueba Hora 24"
    const borrador = await metaService.buscarBorrador(metaCtx.act_id, metaCtx.fb_token, 'Prueba Hora 24');
    
    let rawMetrics = {};
    if (borrador) {
      rawMetrics = await metaService.obtenerMetricas(metaCtx.fb_token, borrador.id);
    }

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

    return res.status(200).json({
      success: true,
      userId,
      act_id: metaCtx.act_id,
      meta: metaCtx,
      metrics: formattedMetrics,
      data: formattedMetrics
    });

  } catch (err) {
    console.error("❌ Error en /api/facebook/metrics:", err);
    return res.status(500).json({ success: false, error: err.message || "Error al obtener métricas del Dashboard." });
  }
});

// ============================================
// 5. PAUSA AUTOMÁTICA A LA HORA 24
// ============================================
router.post('/pausar-24h', async (req, res) => {
  try {
    const { userId, sessionId } = req.body;
    const metaCtx = await getUserMetaContext(userId, sessionId);

    const borrador = await metaService.buscarBorrador(metaCtx.act_id, metaCtx.fb_token, 'Prueba Hora 24');
    if (!borrador) {
      return res.status(404).json({ success: false, message: 'No se encontró la campaña Prueba Hora 24.' });
    }

    await metaService.pausarCampana(metaCtx.fb_token, borrador.id);

    return res.status(200).json({
      success: true,
      act_id: metaCtx.act_id,
      campaignId: borrador.id,
      status: 'PAUSED',
      message: 'Campaña "Prueba Hora 24" completó su ciclo de 24 horas y fue pausada exitosamente.'
    });

  } catch (err) {
    console.error("❌ Error en /api/facebook/pausar-24h:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
