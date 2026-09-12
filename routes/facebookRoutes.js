const express = require('express');
const router = express.Router();
const Client = require('../models/Client');
const tokens = require('../config/tokens');
const metaService = require('../services/metaService');

// Configuración Admin por defecto desde config/tokens.js
const FB_CONFIG = {
  APP_ID: tokens.meta?.appId || process.env.APP_ID || '',
  MY_ACT_ID: tokens.meta?.accountId || process.env.AD_ACCOUNT_ID || '',
  MY_ACCESS_TOKEN: tokens.meta?.accessToken || process.env.META_ACCESS_TOKEN || '',
  DEFAULT_PIXEL_ID: tokens.meta?.pixelId || process.env.META_PIXEL_ID || null,
  REDIRECT_URI: process.env.META_REDIRECT_URI || 'http://localhost:3000/api/facebook/auth/callback'
};

/**
 * Plantilla genérica para generar respuestas HTML de transición con Redirección Automática
 */
function renderTransitionPage({ title, message, targetUrl, delay = 2 }) {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="refresh" content="${delay};url=${targetUrl}">
      <title>${title}</title>
      <style>
        body {
          background-color: #0b0f19;
          color: #ffffff;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          display: flex;
          height: 100vh;
          align-items: center;
          justify-content: center;
          margin: 0;
        }
        .card {
          background: #161f30;
          padding: 40px;
          border-radius: 16px;
          border: 1px solid #23324d;
          text-align: center;
          max-width: 450px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        .spinner {
          border: 4px solid #23324d;
          border-top: 4px solid #00f2fe;
          border-radius: 50%;
          width: 45px;
          height: 45px;
          animation: spin 0.8s linear infinite;
          margin: 20px auto;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        a { color: #00f2fe; text-decoration: none; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>${title}</h2>
        <div class="spinner"></div>
        <p>${message}</p>
        <p style="font-size: 12px; color: #888;">Redirigiendo automáticamente... Si tarda, <a href="${targetUrl}">haz clic aquí</a>.</p>
      </div>
      <script>
        setTimeout(() => { window.location.href = "${targetUrl}"; }, ${delay * 1000});
      </script>
    </body>
    </html>
  `;
}

/**
 * Helper para extraer contexto Meta (Mongo BD o Admin Fallback)
 */
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

// =========================================================================
// 1. PASO CLIENTE: INICIAR SESIÓN CON FACEBOOK (OAuth Callback)
// =========================================================================

// Endpoint POST esperado por sodieConnectFacebook() en app.js
router.post('/connect', (req, res) => {
  try {
    const { sessionId, email } = req.body;
    const redirectUrl = `https://www.facebook.com/v25.0/dialog/oauth?client_id=${FB_CONFIG.APP_ID}&redirect_uri=${encodeURIComponent(FB_CONFIG.REDIRECT_URI)}&state=${sessionId || ''}&scope=ads_management,ads_read`;

    return res.json({
      success: true,
      status: 'REDIRECT_REQUIRED',
      redirectUrl: redirectUrl
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/connect-login', (req, res) => {
  const { sessionId } = req.query;
  const fbLoginUrl = `https://www.facebook.com/v25.0/dialog/oauth?client_id=${FB_CONFIG.APP_ID}&redirect_uri=${encodeURIComponent(FB_CONFIG.REDIRECT_URI)}&state=${sessionId}&scope=ads_management,ads_read`;
  res.redirect(fbLoginUrl);
});

router.get('/auth/callback', async (req, res) => {
  try {
    const { code, state: sessionId } = req.query;
    
    return res.send(renderTransitionPage({
      title: " Conexión con Meta Exitosa",
      message: "Obteniendo ID de Cuenta y Píxel... Preparando borrador de campaña.",
      targetUrl: `/index.html?step=procesar_excel&sessionId=${sessionId}`
    }));
  } catch (err) {
    return res.status(500).send(renderTransitionPage({
      title: "❌ Error de Autenticación",
      message: err.message,
      targetUrl: "/index.html?error=auth_failed"
    }));
  }
});

// =========================================================================
// 2. CREAR AUDIENCIA SEMILLA + BORRADOR EN PAUSED
// =========================================================================
router.post('/crear-borrador-transicion', async (req, res) => {
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

    return res.send(renderTransitionPage({
      title: " Audiencias y Borrador Listos",
      message: "Campaña creada en estado borrador. Redirigiendo para activar campaña...",
      targetUrl: `/index.html?step=activar_campana&campaignId=${borradorResult.campaignId}&actId=${metaCtx.act_id}`
    }));

  } catch (err) {
    console.error("❌ Error al crear borrador:", err);
    return res.status(500).send(renderTransitionPage({
      title: "❌ Error al Generar Borrador",
      message: err.message,
      targetUrl: "/index.html?error=draft_failed"
    }));
  }
});

// =========================================================================
// 3. PASO CLIENTE / ADMIN: CONFIRMAR ACTIVACIÓN Y CAPI
// =========================================================================

// Endpoint POST esperado por sodieConfirmarActivacion() en app.js
router.post('/capi', async (req, res) => {
  try {
    const { sessionId, eventName, email } = req.body;
    const client = await Client.findOne({ sessionId });
    
    return res.json({
      success: true,
      message: `Evento CAPI ${eventName || 'Activation'} procesado correctamente.`,
      campaignId: client?.meta?.lastCampaignId || null
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/confirmar-activacion-transicion', async (req, res) => {
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

      return res.send(renderTransitionPage({
        title: " ¡Campaña Detectada como ACTIVA!",
        message: "Configuración confirmada por Meta Ads. Redirigiendo a tu Dashboard de Métricas...",
        targetUrl: `/index.html?view=dashboard&status=active&campaignId=${targetCampaignId}`
      }));
    } else {
      return res.send(renderTransitionPage({
        title: "⏳ Campaña Aún en Borrador",
        message: "Aún no detectamos la activación. Asegúrate de publicar tus visuales y monto en Meta Ads Manager.",
        targetUrl: `/index.html?step=activar_campana&campaignId=${targetCampaignId}&actId=${metaCtx.act_id}`,
        delay: 3
      }));
    }

  } catch (err) {
    return res.status(500).send(renderTransitionPage({
      title: "❌ Error al Confirmar Activación",
      message: err.message,
      targetUrl: "/index.html?error=activation_check_failed"
    }));
  }
});

// =========================================================================
// 4. MODO ADMIN: ACTIVACIÓN DIRECTA
// =========================================================================
router.post('/admin/activar-directo', async (req, res) => {
  try {
    const { usersPayload, countriesFound, dataSegmentacion } = req.body;

    const adminActId = FB_CONFIG.MY_ACT_ID.replace(/^act_/, '');
    const adminToken = FB_CONFIG.MY_ACCESS_TOKEN;
    const adminPixelId = FB_CONFIG.DEFAULT_PIXEL_ID;

    const borradorResult = await metaService.crearCampanaVentas({
      actId: adminActId,
      token: adminToken,
      pixelId: adminPixelId,
      name: 'Prueba Hora 24 - Admin',
      status: 'PAUSED',
      targeting: dataSegmentacion,
      usersPayload,
      countriesFound
    });

    return res.send(renderTransitionPage({
      title: " Borrador Admin Creado",
      message: "Estructura configurada con tus claves maestras. Redirigiendo a Meta Ads Manager para tus visuales...",
      targetUrl: `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${adminActId}&selected_campaign_ids=${borradorResult.campaignId}`
    }));

  } catch (err) {
    return res.status(500).send(renderTransitionPage({
      title: "❌ Error Admin",
      message: err.message,
      targetUrl: "/index.html?error=admin_launch_failed"
    }));
  }
});

// =========================================================================
// 5. OBTENER MÉTRICAS
// =========================================================================
router.get('/metrics', async (req, res) => {
  try {
    const { userId, sessionId } = req.query;
    const metaCtx = await getUserMetaContext(userId, sessionId);

    const client = await Client.findOne(userId ? { userId } : { sessionId });
    const campaignId = client?.meta?.lastCampaignId;

    if (!campaignId) {
      return res.status(400).json({ success: false, error: "No hay campaña registrada para consultar métricas." });
    }

    const metricsData = await metaService.obtenerMetricas(metaCtx.fb_token, campaignId);

    return res.status(200).json({
      success: true,
      act_id: metaCtx.act_id,
      campaignId,
      metrics: metricsData
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
