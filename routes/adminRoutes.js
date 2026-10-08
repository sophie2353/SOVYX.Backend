const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const metaServices = require('../services/metaServices');

// Cargar configuración global/tokens
let config = {};
try {
  config = require('../config/tokens');
} catch (e) {
  try {
    config = require('./config/tokens');
  } catch (err) {
    console.warn('⚠️ [ADMIN ROUTES] No se pudo cargar config/tokens, usando fallbacks de env.');
  }
}

/* ==========================================================================
   1. LOGIN DE ADMINISTRADOR
   ========================================================================== */
router.post('/login', (req, res) => {
  const { password } = req.body;
  const adminKey = process.env.ADMIN_KEY || config.ADMIN_KEY || process.env.ADMIN_KEY || '';

  if (!password) {
    return res.status(400).json({ success: false, message: 'Contraseña requerida' });
  }

  if (password === adminKey) {
    return res.json({ success: true, message: 'Acceso de administración autorizado' });
  } else {
    return res.status(401).json({ success: false, message: 'Contraseña incorrecta' });
  }
});

/* ==========================================================================
   2. ACTIVACIÓN DE CAMPAÑA & ENLACE META ADS
   ========================================================================== *
/* ==========================================================================
   a. ENDPOINT: CANJEAR SHORT TOKEN A LONG TOKEN (90 DÍAS)
   ========================================================================== */
router.post('/fb-exchange-token', async (req, res) => {
  try {
    const { shortLivedToken } = req.body;
    const appId = process.env.FB_APP_ID || config.meta?.appId;
    const appSecret = process.env.FB_APP_SECRET || config.meta?.appSecret;

    if (!shortLivedToken) {
      return res.status(400).json({ success: false, error: 'Se requiere el shortLivedToken' });
    }

    // Intercambio con Graph API para extender a ~60-90 días
    const graphUrl = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`;
    
    const response = await fetch(graphUrl);
    const data = await response.json();

    if (data.access_token) {
      return res.json({
        success: true,
        longLivedToken: data.access_token,
        expiresIn: data.expires_in
      });
    } else {
      return res.status(400).json({
        success: false,
        error: data.error?.message || 'Error al canjear el token con Meta'
      });
    }
  } catch (error) {
    console.error('💥 Error intercambiando token FB en adminRoutes:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/* ==========================================================================
   b. ENDPOINT: ACTIVAR CAMPAÑA E INYECTAR EN METASERVICES
   ========================================================================== */
router.post(['/campaigns/activate', '/activar-campana'], async (req, res) => {
  try {
    const { token, triggeredBy } = req.body;

    // 1. Extraer act_id y pixel_id PRIVADOS desde variables de entorno o config
    const rawActId = config.meta?.adAccountId || process.env.AD_ACCOUNT_ID || process.env.FB_AD_ACCOUNT_ID || '';
    const pixelId = config.meta?.pixelId || process.env.PIXEL_ID || process.env.FB_PIXEL_ID || '';

    const cleanActId = rawActId.replace(/^act_/, '');
    const fullActId = `act_${cleanActId}`;
    const effectiveToken = token || process.env.FB_ACCESS_TOKEN;

    const clientId = 'ADMIN-SUPERUSER';

    // 2. Inyectar en metaServices para crear la campaña/borrador con la segmentación del Excel
    let borradorResult = null;

    if (metaServices && typeof metaServices.procesarCicloHora24 === 'function') {
      borradorResult = await metaServices.procesarCicloHora24({
        clientId: clientId,
        token: effectiveToken,
        adAccountId: fullActId,
        pixelId: pixelId,
        usersPayload: [], // Los datos provenientes del Excel procesado
        dailyBudget: 1000
      });
    } else if (metaServices && typeof metaServices.activarBorrador === 'function') {
      borradorResult = await metaServices.activarBorrador({
        actId: fullActId,
        pixelId: pixelId,
        token: effectiveToken
      });
    }

    const campaignId = borradorResult?.campaignId || 'DRAFT_CREATED';

    // 3. Actualizar puntero en BD
    try {
      await Client.findOneAndUpdate(
        { clientId: clientId },
        { $set: { 'meta.lastCampaignId': campaignId, 'meta.status': 'PAUSED', 'meta.updatedAt': new Date() } },
        { upsert: true }
      );
    } catch (dbErr) {
      console.warn('⚠️ No se pudo guardar en BD, continuando flujo:', dbErr.message);
    }

    // 4. Construir URL directa a Facebook Ads Manager
    let metaAdsUrl = `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${cleanActId}`;
    if (pixelId) metaAdsUrl += `&pixel_id=${pixelId}`;

    // 5. Responder al frontend con la redirección a confirmacion.html
    return res.json({
      success: true,
      clientId: clientId,
      act_id: cleanActId,
      campaignId: campaignId,
      status: 'PAUSED',
      metaAdsUrl: metaAdsUrl,
      redirectUrl: `/confirmacion.html?step=activar_campana&clientId=${encodeURIComponent(clientId)}&campaignId=${campaignId}&actId=${cleanActId}`
    });

  } catch (error) {
    console.error('💥 Error al activar campaña en Admin:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno al procesar la activación en Meta: ' + error.message
    }
  });
/* ==========================================================================
   4. EXPORTACIÓN DE DATOS AUDIENCIA / CSV
   ========================================================================== */
router.get('/export/export-clientes-hora48', (req, res) => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="audiencia_sodie_48h.csv"');
  res.status(200).send('ID,Nombre,Email,Status,Presupuesto\n1,Cliente Demo,demo@sodie.app,ACTIVE,10000USD');
});
  }
});

module.exports = router;
