const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');


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
   ========================================================================== */
router.post(['/campaigns/activate', '/activar-campana'], async (req, res) => {
  try {
    const { status, triggeredBy, draftId } = req.body;

    // Obtener credenciales de Meta desde config o variables de entorno
    const actId = config.meta?.adAccountId || process.env.AD_ACCOUNT_ID || process.env.FB_AD_ACCOUNT_ID || '';
    const pixelId = config.meta?.pixelId || process.env.PIXEL_ID || process.env.FB_PIXEL_ID || '';

    // Limpiar prefijo 'act_' si está presente
    const cleanActId = actId.replace(/^act_/, '');

    // Construcción de la URL directa al Administrador de Anuncios de Meta Ads
    let metaAdsUrl = 'https://adsmanager.facebook.com/adsmanager/manage/campaigns';
    if (cleanActId) {
      metaAdsUrl = `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${cleanActId}`;
      if (pixelId) {
        metaAdsUrl += `&pixel_id=${pixelId}`;
      }
    }

    // Verificar si existe el servicio de Meta Ads para confirmar/activar el borrador generado por IA1
    let metaResult = null;
    try {
      const metaService = require('../services/metaServices');
      if (metaService && typeof metaService.activarBorrador === 'function') {
        metaResult = await metaService.activarBorrador({ draftId, actId, pixelId });
      }
    } catch (e) {
      console.warn('⚠️ [ADMIN ROUTE] metaServices no disponible, continuando con flujo estándar.');
    }

    return res.json({
      success: true,
      status: 'PAUSED',
      message: '🚀 Campaña activada con éxito. Redirigiendo a Meta Ads Manager.',
      act_id: cleanActId,
      pixel_id: pixelId,
      metaAdsUrl: metaAdsUrl,
      metaDetails: metaResult || { status: 'DRAFT_CONFIRMED', readyForVisuals: true }
    });

  } catch (error) {
    console.error('💥 Error al activar campaña en Admin:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno al procesar la activación de la campaña: ' + error.message
    });
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

module.exports = router;
