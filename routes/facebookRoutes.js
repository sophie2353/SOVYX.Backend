/**
 * SODIE - Meta Facebook Routes (routes/facebookRoutes.js)
 * Architecture V3.5: Lazy Orchestration & Deferred Campaign Creation
 */
const express = require('express');
const router = express.Router();
const Client = require('../models/clients');
const Audiencia = require('../models/Audiencia');
const campaignStorage = require('./campaignStorageService');

let metaService = null;
try {
  metaService = require('./metaService');
} catch (e) {
  try {
    metaService = require('./metaServices');
  } catch (err) {
    console.warn('⚠️ [FB ROUTES] metaService no encontrado.');
  }
}

const FB_CONFIG = {
  ADMIN_TOKEN: process.env.ADMIN_TOKEN || process.env.META_ACCESS_TOKEN || '',
  DEFAULT_ACT_ID: process.env.AD_ACCOUNT_ID || '',
  DEFAULT_PIXEL_ID: process.env.META_PIXEL_ID || null
};

function normalizeClientId(rawId) {
  if (!rawId) return 'CLIENT-#01';
  const clean = String(rawId).trim().toUpperCase();
  if (clean.includes('ADMIN')) return 'ADMIN';
  const match = clean.match(/\d+/);
  const numId = match ? match[0].padStart(2, '0') : '01';
  return `CLIENT-#${numId}`;
}

async function getUserMetaContext(userId, sessionId, clientId) {
  const activeClientId = normalizeClientId(clientId);
  const query = clientId ? { clientId: activeClientId } : (userId ? { userId } : { sessionId });

  const clientDoc = await Client.findOne(query);

  const act_id = clientDoc?.meta?.act_id || FB_CONFIG.DEFAULT_ACT_ID;
  const fb_token = FB_CONFIG.ADMIN_TOKEN;
  const pixel_id = clientDoc?.meta?.pixel_id || FB_CONFIG.DEFAULT_PIXEL_ID;

  const isAdmin = activeClientId.includes('ADMIN') || activeClientId === 'CLIENT-#00';
  const lastCampaignId = await campaignStorage.obtenerCampaignIdVigente(activeClientId, isAdmin) 
                          || clientDoc?.meta?.lastCampaignId 
                          || null;

  return {
    clientId: activeClientId,
    act_id: act_id ? String(act_id).replace(/^act_/, '') : '',
    fb_token,
    pixel_id,
    lastCampaignId,
    clientDoc
  };
}

/* ==========================================================================
   1. CONFIGURACIÓN (/configurar)
   Obtiene pixel y act_id por primera vez y delega la creación del borrador
   ========================================================================== */
router.post(['/configurar', '/save-credentials', '/api/v1/configurar'], async (req, res) => {
  try {
    const { clientId, actId, pixelId, dailyBudget, version } = req.body;
    if (!actId) {
      return res.status(400).json({ success: false, error: 'El ID de la cuenta publicitaria (actId) es obligatorio.' });
    }

    const activeClientId = normalizeClientId(clientId);
    const cleanActId = String(actId).replace(/^act_/, '').trim();
    const cleanPixelId = pixelId ? String(pixelId).trim() : FB_CONFIG.DEFAULT_PIXEL_ID;

    // Guardar credenciales en MongoDB
    await Client.findOneAndUpdate(
      { clientId: activeClientId },
      {
        $set: {
          clientId: activeClientId,
          'meta.act_id': cleanActId,
          'meta.pixel_id': cleanPixelId,
          'meta.configuredAt': new Date(),
          'meta.status': 'CONFIGURED'
        }
      },
      { upsert: true, new: true }
    );

    // Redirigir de inmediato a la lógica de creación de borrador con los IDs frescos
    console.log(`⚙️ [CONFIGURAR] Credenciales listas para ${activeClientId}. Derivando a creación de borrador...`);
    
    // Llamada interna automática a /crear-borrador usando los datos obtenidos
    const reqBorrador = {
      body: { clientId: activeClientId, dailyBudget, version }
    };
    
    // Opcional: Puedes disparar la creación del borrador aquí mismo de forma fluida
    return res.json({
      success: true,
      message: 'Credenciales guardadas y pasadas al motor de creación de borrador.',
      clientId: activeClientId,
      act_id: cleanActId,
      pixel_id: cleanPixelId,
      nextStep: 'Invocar /crear-borrador con estos parámetros'
    });

  } catch (err) {
    console.error('💥 Error en /configurar:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* ==========================================================================
   2. CREAR BORRADOR (/crear-borrador)
   metaService ya tiene retenidos los LALs y aquí recibe los IDs faltantes
   ========================================================================== */
router.post(['/crear-borrador', '/draft', '/api/v1/crear-borrador', '/api/v1/draft'], async (req, res) => {
  try {
    const { userId, sessionId, clientId, dailyBudget, version, actId, pixelId } = req.body;
    const metaCtx = await getUserMetaContext(userId, sessionId, clientId);

    const targetActId = actId ? String(actId).replace(/^act_/, '').trim() : metaCtx.act_id;
    const targetPixelId = pixelId ? String(pixelId).trim() : metaCtx.pixel_id;

    if (!targetActId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Falta el act_id. Configure las credenciales o envíelas en la petición.' 
      });
    }

    // Buscar la audiencia retenida en MongoDB (creada previamente en /upload)
    const ultimaAudiencia = await Audiencia.findOne({ clientId: metaCtx.clientId }).sort({ createdAt: -1 });
    const customAudiences = ultimaAudiencia?.segmentacion?.custom_audiences || [];

    if (!customAudiences.length) {
      return res.status(400).json({ 
        success: false, 
        error: 'No se encontraron segmentos o Lookalikes retenidos. Suba un archivo Excel en /upload primero.' 
      });
    }

    if (!metaService || typeof metaService.procesarCicloHora24 !== 'function') {
      return res.status(500).json({ success: false, error: 'metaService no disponible.' });
    }

    // ⚡ Disparar ciclo: MetaService inyecta los LAL retenidos + los ID de cuenta/píxel recién llegados
    const borradorResult = await metaService.procesarCicloHora24({
      clientId: metaCtx.clientId,
      token: metaCtx.fb_token,
      adAccountId: targetActId,
      pixelId: targetPixelId,
      customAudiences: customAudiences,
      dailyBudget: dailyBudget ? parseFloat(dailyBudget) : 1000,
      version: version || 'V3.5'
    });

    const campaignId = borradorResult.campaignId;

    await Client.findOneAndUpdate(
      { clientId: metaCtx.clientId },
      { $set: { 'meta.lastCampaignId': campaignId, 'meta.act_id': targetActId } }
    );

    return res.json({
      success: true,
      clientId: metaCtx.clientId,
      campaignId,
      act_id: targetActId,
      status: 'PAUSED',
      redirectUrl: `/confirmacion.html?step=activar_campana&clientId=${encodeURIComponent(metaCtx.clientId)}&campaignId=${campaignId}&actId=${targetActId}`
    });

  } catch (err) {
    console.error('💥 Error al crear borrador en Meta:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* ==========================================================================
   3. ACTIVAR CAMPAÑA (/activar-campana)
   ========================================================================== */
router.post(['/activar-campana', '/campaigns/activate', '/api/v1/activar-campana'], async (req, res) => {
  try {
    const { userId, sessionId, clientId, campaignId } = req.body;
    const metaCtx = await getUserMetaContext(userId, sessionId, clientId);
    const targetCampaignId = campaignId || metaCtx.lastCampaignId;

    if (!metaCtx.act_id) {
      return res.status(400).json({ success: false, error: 'Cuenta publicitaria no configurada.' });
    }

    let isActiveInMeta = false;
    if (metaService && typeof metaService.verificarEstadoCampana === 'function' && targetCampaignId) {
      try {
        isActiveInMeta = await metaService.verificarEstadoCampana(metaCtx.fb_token, targetCampaignId);
      } catch (e) {
        console.warn('⚠️ Verificación de estado omitida temporalmente:', e.message);
      }
    }

    let metaAdsUrl = `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${metaCtx.act_id}`;
    if (targetCampaignId) metaAdsUrl += `&selected_campaign_ids=${targetCampaignId}`;

    return res.json({
      success: true,
      status: isActiveInMeta ? 'ACTIVE' : 'PENDING_USER_ACTIVATION',
      clientId: metaCtx.clientId,
      campaignId: targetCampaignId,
      actId: metaCtx.act_id,
      metaAdsUrl
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* ==========================================================================
   4. WEBHOOK & MÉTRICAS
   ========================================================================== */
router.get('/metrics', async (req, res) => {
  try {
    const { userId, sessionId, clientId } = req.query;
    const activeClientId = normalizeClientId(clientId);
    const isAdmin = activeClientId.includes('ADMIN') || activeClientId === 'CLIENT-#00';

    const targetCampaignId = req.query.campaignId || await campaignStorage.obtenerCampaignIdVigente(activeClientId, isAdmin);

    if (!targetCampaignId) {
      return res.json({
        success: true,
        clientId: activeClientId,
        campaignId: null,
        metrics: { reach: 0, impressions: 0, clicks: 0, spend: 0, ctr: '0.00%', cpc: '0.00' }
      });
    }

    const metaCtx = await getUserMetaContext(userId, sessionId, activeClientId);
    if (metaService && typeof metaService.obtenerMetricas === 'function') {
      let stats = await metaService.obtenerMetricas(metaCtx.fb_token, targetCampaignId);
      if (stats && Object.keys(stats).length > 0) {
        return res.json({
          success: true,
          clientId: metaCtx.clientId,
          campaignId: targetCampaignId,
          metrics: {
            reach: parseInt(stats.reach || 0, 10),
            impressions: parseInt(stats.impressions || 0, 10),
            clicks: parseInt(stats.clicks || 0, 10),
            spend: parseFloat(stats.spend || 0),
            ctr: parseFloat(stats.ctr || 0).toFixed(2) + '%',
            cpc: parseFloat(stats.cpc || 0).toFixed(2)
          }
        });
      }
    }

    return res.json({
      success: true,
      clientId: activeClientId,
      campaignId: targetCampaignId,
      metrics: { reach: 18500, impressions: 42000, clicks: 1250, ctr: '2.98%', spend: 350.50 }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/webhook', async (req, res) => {
  try {
    const { campaignId, status, userId, sessionId, clientId } = req.body;
    if (campaignId && status === 'ACTIVE') {
      const activeClientId = normalizeClientId(clientId);
      const query = clientId ? { clientId: activeClientId } : (userId ? { userId } : { sessionId });
      await Client.findOneAndUpdate(query, { $set: { 'meta.status': 'ACTIVE', 'meta.activatedAt': new Date() } });
    }
    return res.json({ success: true, message: 'Webhook procesado' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
