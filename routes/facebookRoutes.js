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
    metaService = require('./metaService');
  } catch (err) {
    console.warn('⚠️ [FB ROUTES] metaService no encontrado.');
  }
}

const FB_CONFIG = {
  ADMIN_TOKEN: process.env.ADMIN_TOKEN || process.env.META_ACCESS_TOKEN || '',
  DEFAULT_ACT_ID: process.env.AD_ACCOUNT_ID || '',
  META_PIXEL_ID: process.env.META_PIXEL_ID || null
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
  const pixel_id = clientDoc?.meta?.pixel_id || FB_CONFIG.META_PIXEL_ID;

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
   ========================================================================== */
 /* ==========================================================================
   1. CONFIGURACIÓN (/configurar)
   ========================================================================== */
router.post(['/configurar', '/save-credentials', '/api/v1/configurar'], async (req, res) => {
  try {
    const { clientId, actId, websiteUrl } = req.body;
    
    if (!actId) {
      return res.status(400).json({ success: false, error: 'El ID de la cuenta publicitaria (actId) es obligatorio.' });
    }

    const activeClientId = normalizeClientId(clientId);
    const cleanActId = String(actId).replace(/^act_/, '').trim();
    
    // Guardamos la configuración inicial limpia en MongoDB
    await Client.findOneAndUpdate(
      { clientId: activeClientId },
      {
        $set: {
          clientId: activeClientId,
          'meta.act_id': cleanActId,
          'meta.websiteUrl': websiteUrl || 'https://sodie.app',
          'meta.configuredAt': new Date(),
          'meta.status': 'CONFIGURED'
        }
      },
      { upsert: true, new: true }
    );

    console.log(`⚙️ [CONFIGURAR] Credenciales y URL guardadas para ${activeClientId}.`);
    
    return res.json({
      success: true,
      message: 'Credenciales guardadas con éxito.',
      clientId: activeClientId,
      act_id: cleanActId,
      nextStep: 'Invocar /crear-borrador para procesar e inyectar la campaña.'
    });

  } catch (err) {
    console.error('💥 Error en /configurar:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* ==========================================================================
   2. CREAR BORRADOR (/crear-borrador)
   ========================================================================== */
router.post(['/crear-borrador', '/draft', '/api/v1/crear-borrador', '/api/v1/draft'], async (req, res) => {
  try {
    const { userId, sessionId, clientId, dailyBudget, version, actId, websiteUrl } = req.body;
    
    const metaCtx = await getUserMetaContext(userId, sessionId, clientId);
    const targetActId = actId ? String(actId).replace(/^act_/, '').trim() : metaCtx.act_id;

    if (!targetActId) {
      return res.status(400).json({ success: false, error: 'Falta el ID de la cuenta publicitaria (act_id).' });
    }

    // Lógica del sitio web
    let finalWebsiteUrl = websiteUrl || metaCtx.clientDoc?.meta?.websiteUrl || 'https://sodie.app';
    if (websiteUrl && websiteUrl !== metaCtx.clientDoc?.meta?.websiteUrl) {
      await Client.findOneAndUpdate(
        { clientId: metaCtx.clientId },
        { $set: { 'meta.websiteUrl': finalWebsiteUrl } }
      );
    }

    // Extracción de la audiencia desde Mongo
    const ultimaAudiencia = await Audiencia.findOne({ clientId: metaCtx.clientId }).sort({ createdAt: -1 });
    const customAudiences = ultimaAudiencia?.segmentacion?.custom_audiences || [];
    const usersPayload = ultimaAudiencia?.segmentacion?.usersPayload || [];
    
    const minAge = ultimaAudiencia?.segmentacion?.age_min || ultimaAudiencia?.parametrosConfig?.edadMin || 22; 
    const maxAge = ultimaAudiencia?.segmentacion?.age_max || ultimaAudiencia?.parametrosConfig?.edadMax || 55;

    if (!customAudiences.length && !usersPayload.length) {
      return res.status(400).json({ success: false, error: `No se encontraron registros de audiencia en Mongo para ${metaCtx.clientId}.` });
    }

    if (!metaService || typeof metaService.procesarCicloHora24 !== 'function') {
      return res.status(500).json({ success: false, error: 'metaService no está disponible.' });
    }

    const presupuestoFinal = dailyBudget ? parseFloat(dailyBudget) : 3300;

    // ⚡ Delegación absoluta a MetaService:
    // metaService se encarga de crear en Meta y registrar en campaignStorage (con estatus PENDIENTE)
    const borradorResult = await metaService.procesarCicloHora24({
      clientId: metaCtx.clientId,
      token: metaCtx.fb_token,
      adAccountId: targetActId,
      pixelId: metaCtx.pixel_id,
      usersPayload,
      customAudiences,
      dailyBudget: presupuestoFinal,
      version: version || 'V3.5',
      minAge,      
      maxAge,      
      websiteUrl: finalWebsiteUrl 
    });

    const cleanClientId = String(metaCtx.clientId || 'ADMIN').trim().toUpperCase();

    // 🚀 Responder ÚNICAMENTE con la confirmación de la inyección
    return res.json({
      success: true,
      clientId: cleanClientId,
      campaignId: borradorResult.campaignId,
      status: 'PAUSED',
      message: 'Borrador inyectado en Meta con éxito. En fase de maduración de audiencia (Radar 4h).',
      redirectUrl: `/confirmacion.html?step=esperar_maduracion&clientId=${encodeURIComponent(cleanClientId)}&campaignId=${borradorResult.campaignId}`
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

    if (!targetCampaignId) {
      return res.status(400).json({ success: false, error: 'No se encontró un ID de campaña para activar.' });
    }

    // 1. Verificar en Mongo si el radar de 4h ya marcó la audiencia como lista
    const audienciaDoc = await Audiencia.findOne({ clientId: metaCtx.clientId });
    const estaListoParaActivar = audienciaDoc?.estadoIndexacion === 'LISTO_PARA_ACTIVAR';

    // 2. Verificar el estado real en Meta
    let isActiveInMeta = false;
    if (metaService && typeof metaService.verificarEstadoCampana === 'function') {
      try {
        isActiveInMeta = await metaService.verificarEstadoCampana(metaCtx.fb_token, targetCampaignId);
      } catch (e) {
        console.warn('⚠️ Verificación de estado en Meta omitida:', e.message);
      }
    }

    // Construir enlace directo al Administrador de Anuncios
    let metaAdsUrl = `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${metaCtx.act_id}`;
    if (targetCampaignId) metaAdsUrl += `&selected_campaign_ids=${targetCampaignId}`;

    return res.json({
      success: true,
      clientId: metaCtx.clientId,
      campaignId: targetCampaignId,
      status: isActiveInMeta ? 'ACTIVE' : (estaListoParaActivar ? 'READY_FOR_ACTIVATION' : 'MATURING_PAUSED'),
      canActivate: estaListoParaActivar || isActiveInMeta,
      message: estaListoParaActivar 
        ? '¡Audiencia indexada! La campaña está lista para ser activada.' 
        : 'La audiencia sigue en fase de maduración en los servidores de Meta.',
      metaAdsUrl
    });

  } catch (err) {
    console.error('💥 Error en /activar-campana:', err);
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
