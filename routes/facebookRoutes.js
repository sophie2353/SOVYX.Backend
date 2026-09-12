const express = require('express');
const router = express.Router();
const Client = require('../models/Client');
const tokens = require('../config/tokens');
const metaService = require('../services/metaService');

const FB_CONFIG = {
  APP_ID: tokens.meta?.appId || process.env.APP_ID || '',
  MY_ACT_ID: tokens.meta?.accountId || process.env.AD_ACCOUNT_ID || '',
  MY_ACCESS_TOKEN: tokens.meta?.accessToken || process.env.META_ACCESS_TOKEN || '',
  DEFAULT_PIXEL_ID: tokens.meta?.pixelId || process.env.META_PIXEL_ID || null,
  REDIRECT_URI: process.env.META_REDIRECT_URI || 'http://localhost:3000/api/facebook/auth/callback'
};

async function getUserMetaContext(userId, sessionId) {
  let act_id = FB_CONFIG.MY_ACT_ID;
  let fb_token = FB_CONFIG.MY_ACCESS_TOKEN;
  let pixel_id = FB_CONFIG.DEFAULT_PIXEL_ID;

  if (userId || sessionId) {
    const query = userId ? { userId } : { sessionId };
    const client = await Client.findOne(query);
    if (client && client.meta) {
      if (client.meta.act_id) act_id = client.meta.act_id;
      if (client.meta.fb_token) fb_token = client.meta.fb_token;
      if (client.meta.pixel_id) pixel_id = client.meta.pixel_id;
    }
  }

  return {
    act_id: act_id ? act_id.replace(/^act_/, '') : '',
    fb_token,
    pixel_id
  };
}

// 1. POST AUTH CALLBACK
router.get('/auth/callback', async (req, res) => {
  try {
    const { state: sessionId } = req.query;
    return res.redirect(`/confirmacion.html?step=procesar_excel&sessionId=${sessionId || ''}`);
  } catch (err) {
    return res.redirect('/confirmacion.html?step=error&message=auth_failed');
  }
});

// 2. CREAR BORRADOR
router.post('/crear-borrador', async (req, res) => {
  try {
    const { userId, sessionId, usersPayload, countriesFound, dataSegmentacion } = req.body;
    const metaCtx = await getUserMetaContext(userId, sessionId);

    const borradorResult = await metaService.crearCampanaVentas({
      actId: metaCtx.act_id,
      token: metaCtx.fb_token,
      pixelId: metaCtx.pixel_id,
      name: 'Prueba Hora 24',
      status: 'PAUSED',
      targeting: dataSegmentacion,
      usersPayload,
      countriesFound
    });

    await Client.findOneAndUpdate(
      userId ? { userId } : { sessionId },
      { $set: { 'meta.lastCampaignId': borradorResult.campaignId } }
    );

    return res.json({
      success: true,
      redirectUrl: `/confirmacion.html?step=activar_campana&campaignId=${borradorResult.campaignId}&actId=${metaCtx.act_id}`
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 3. POST PAGO / CAPI / ACTIVACIÓN
router.post('/capi', async (req, res) => {
  try {
    const { sessionId, eventName } = req.body;
    const client = await Client.findOne({ sessionId });
    
    return res.json({
      success: true,
      redirectUrl: `/confirmacion.html?step=confirmar_pago&status=success&campaignId=${client?.meta?.lastCampaignId || ''}`
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 4. VERIFICAR SI META LA ACTIVÓ
router.get('/verificar-estado', async (req, res) => {
  try {
    const { userId, sessionId, campaignId } = req.query;
    const metaCtx = await getUserMetaContext(userId, sessionId);
    const targetCampaignId = campaignId || (await Client.findOne(userId ? { userId } : { sessionId }))?.meta?.lastCampaignId;

    const isNowActive = await metaService.verificarEstadoCampana(metaCtx.fb_token, targetCampaignId);

    if (isNowActive) {
      await Client.findOneAndUpdate(
        userId ? { userId } : { sessionId },
        { $set: { 'meta.status': 'ACTIVE', 'meta.activatedAt': new Date() } }
      );
    }

    return res.json({ success: true, isActive: isNowActive, campaignId: targetCampaignId, actId: metaCtx.act_id });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
